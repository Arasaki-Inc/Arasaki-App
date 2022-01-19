import { join, resolve, dirname, sep } from 'path'
import { constants, readFileSync, writeFileSync, statSync, accessSync, truncateSync, unlinkSync, readdirSync, mkdirSync, copyFileSync } from 'fs'
import { execSync } from 'child_process'
import process from 'process'

import chokidar from 'chokidar'
import getFolderSize from 'get-folder-size'
import sass from 'sass'
import ffmpeg from 'ffmpeg-static'
import commandExistsSync from 'command-exists'
import { ImagePool } from '@squoosh/lib'
import { cpus } from 'os'
import { minify } from 'terser'

// Global Variables //

const __project_name = 'Arasaki'

const __dirname = resolve()
const __cache_filename = join(__dirname, __project_name.toLocaleLowerCase() + '-cache.json')

var isDebug

//const imagePool = new ImagePool()

// Global Variables //

// JSON //

var cacheEntities =
{
    cached: []
}

// JSON //

function fileExists(filepath)
{
    try
    {
        accessSync(filepath, constants.R_OK | constants.W_OK)
        return true
    }
    catch (e)
    {
        return false
    }
}

function findFiles(path)
{
    const entries = readdirSync(path, { withFileTypes: true })
    const files = entries.filter(file => !file.isDirectory()).map(file => ({ ...file, path: join(path, file.name) }));
    const folders = entries.filter(folder => folder.isDirectory())
    for (const folder of folders)
    {
        files.push(...findFiles(`${path}${sep}${folder.name}${sep}`))
    }
    return files
}

function filterFiles(files, ext)
{
    return Object.values(files).filter(file => String(file.name).split('.').pop() == ext)
}

function addCacheEntry(proc_dirname_dev, proc_dirname)
{
    const relativeFilePath = proc_dirname_dev.replace(proc_dirname, '')
    cacheEntities.cached = cacheEntities.cached.filter(f => f.relativeFilePath !== relativeFilePath)
    cacheEntities.cached.push({ relativeFilePath: relativeFilePath, lastModified: statSync(proc_dirname_dev).mtime })
    if (fileExists(__cache_filename))
    {
        truncateSync(__cache_filename, 0)
    }
    writeFileSync(__cache_filename, JSON.stringify(cacheEntities, null, "\t"), 'utf8')
}

function needsCaching(proc_dirname_dev, proc_dirname, procExt)
{
    if (fileExists(__cache_filename))
    {
        cacheEntities = JSON.parse(readFileSync(__cache_filename))
    }
    const procFilePath = proc_dirname_dev.replace(proc_dirname, proc_dirname_dev)
    const containsEntry = cacheEntities.cached.some(file => file.relativeFilePath === proc_dirname_dev.replace(proc_dirname, ''))
    if (!containsEntry)
    {
        addCacheEntry(proc_dirname_dev)
    }
    return !(containsEntry && fileExists(procFilePath.substring(0, procFilePath.lastIndexOf('.')) + '.' + procExt))
}

function needsProcessing(proc_dirname_dev, proc_dirname)
{
    const cachedFile = cacheEntities.cached.filter(file => file.relativeFilePath === proc_dirname_dev.replace(proc_dirname, ''))[0]
    const needsProc = new Date(cachedFile.lastModified).getTime() < statSync(proc_dirname_dev).mtime.getTime()
    if (needsProc)
    {
        addCacheEntry(proc_dirname_dev)
    }
    return needsProc
}

function runFileAction(identifier, proc_dirname, proc_dirname_dev, itempath)
{
    if (needsCaching(itempath, identifier.toLocaleLowerCase()) || needsProcessing(itempath))
    {
        const output = itempath.replace(proc_dirname_dev, proc_dirname)
        console.log('  | Copying ' + identifier.toUpperCase() + ': ' + itempath.replace(proc_dirname_dev, '') + ' > ' + output.replace(proc_dirname, ''))
        mkdirSync(dirname(output), { recursive: true })
        copyFileSync(itempath, output)
    }
}

async function minifyTypescript(item, proc_dirname, proc_dirname_dev, bundle)
{
    if (needsCaching(item.path, 'ts') || needsProcessing(item.path))
    {
        try
        {
            const output = bundle ? join(proc_dirname, 'bundle.min.js') : item.path.replace(proc_dirname_dev, proc_dirname).replace('.ts', '.js')
            console.log('  | Minifying Typescript: ' + item.path.replace(proc_dirname_dev, '') + ' > ' + output.replace(proc_dirname, ''))
            execSync('npx tsc ' + (bundle ? join(proc_dirname_dev, 'ts', 'core.ts') : item.path) + ' --outFile "' + output + '" --target ES2021 --lib DOM,ES2021,WebWorker --module amd --allowSyntheticDefaultImports --esModuleInterop --forceConsistentCasingInFileNames --strict --skipLibCheck',
                err =>
            {
                if (err)
                {
                    throw err
                }
            })
            const result = await minify(readFileSync(output, 'utf8'), { sourceMap: true, module: false, mangle: false, ecma: 2021, compress: true })
            truncateSync(output)
            const mapFilename = output.replace('.js', '.js.map')
            if (fileExists(mapFilename))
            {
                truncateSync(mapFilename)
            }
            writeFileSync(output, result.code, 'utf8')
            writeFileSync(mapFilename, result.map, 'utf8')
        }
        catch (e)
        {
            console.error('  | ------------------------------------------------------------------------------------------------')
            console.error('  | Typescript Minification Error: ' + e)
            console.error('  | ------------------------------------------------------------------------------------------------')
        }
    }
}

async function processing(proc_dirname, proc_dirname_dev)
{
    console.log('\\  Changes Made > Running Bundle Pass...')
    console.log(' \\')

    const imagePool = new ImagePool(cpus().length)
    const files = findFiles(proc_dirname_dev)
    const tsFiles = filterFiles(files, 'ts').filter(file => String(file.name) != 'service-worker.ts' && String(file.name) != 'service-worker.published.ts')
    const swtsFiles = filterFiles(files, 'ts').filter(file => String(file.name) == 'service-worker.ts' || String(file.name) == 'service-worker.published.ts')
    const sassFile = join(proc_dirname_dev, 'sass', 'bundle.sass')
    const htmlFiles = filterFiles(files, 'html')
    const svgFiles = filterFiles(files, 'svg')
    const jsonFiles = filterFiles(files, 'json').filter(file => String(file.name) != 'tsconfig.json')
    const woff2Files = filterFiles(files, 'woff2')
    const pngFiles = filterFiles(files, 'png')
    const h264Files = filterFiles(files, 'mp4')

    try
    {
        const minCSSFilePath = proc_dirname + sep + 'bundle.min.css'
        const minMapFilePath = proc_dirname + sep + 'bundle.css.map'
        console.log('  | Minifying SASS: ' + minCSSFilePath.replace(proc_dirname, ''))
        const result = sass.renderSync(
        {
            file: sassFile, sourceMap: true, outFile: 'bundle.css', outputStyle: isDebug ? 'expanded' : 'compressed', indentType: 'tab', indentWidth: 1, quietDeps: true
        })
        if (fileExists(minCSSFilePath))
        {
            truncateSync(minCSSFilePath, 0)
        }
        if (fileExists(minMapFilePath))
        {
            truncateSync(minMapFilePath, 0)
        }
        writeFileSync(minCSSFilePath, result.css.toString(), 'utf8')
        writeFileSync(minMapFilePath, result.map.toString(), 'utf8')
    }
    catch (e)
    {
        console.error('  | ------------------------------------------------------------------------------------------------')
        console.error('  | SASS Minification Error: ' + e)
        console.error('  | ------------------------------------------------------------------------------------------------')
    }

    tsFiles.forEach(async item => await minifyTypescript(item, proc_dirname, proc_dirname_dev, true))
    swtsFiles.forEach(async item => await minifyTypescript(item, proc_dirname, proc_dirname_dev, false))
    htmlFiles.forEach(item => runFileAction('html', proc_dirname, proc_dirname_dev, item.path))
    svgFiles.forEach(item => runFileAction('svg', proc_dirname, proc_dirname_dev, item.path))
    jsonFiles.forEach(item => runFileAction('json', proc_dirname, proc_dirname_dev, item.path))
    woff2Files.forEach(item => runFileAction('woff2', proc_dirname, proc_dirname_dev, item.path))
    pngFiles.forEach(async item =>
    {
        if (needsCaching(item.path, 'webp') || needsProcessing(item.path))
        {
            const output = item.path.replace(proc_dirname_dev, proc_dirname).replace('.png', '.webp')
            console.log('  | Transcoding Image: ' + item.path.replace(proc_dirname_dev, '') + ' > ' + output.replace(proc_dirname, ''))
            mkdirSync(dirname(output), { recursive: true })
            if (fileExists(item.path.replace(proc_dirname_dev, proc_dirname)))
            {
                unlinkSync(item.path.replace(proc_dirname_dev, proc_dirname))
            }
            try
            {
                const image = imagePool.ingestImage(item.path)
                await image.decoded
                await image.encode({
                    // Use AVIF as soon as the memory and path bugs are fixed
                    /*
                    avif:
                    {
                        cqLevel: 45,
                        cqAlphaLevel: -1,
                        denoiseLevel: 0,
                        tileColsLog2: 0,
                        tileRowsLog2: 0,
                        speed: 0,
                        subsample: 1,
                        chromaDeltaQ: false,
                        sharpness: 0,
                        tune: 0
                    }
                    */
                    webp: {
                        quality: 90,
                        target_size: 0,
                        target_PSNR: 0,
                        method: 4,
                        sns_strength: 100,
                        filter_strength: 100,
                        filter_sharpness: 0,
                        filter_type: 1,
                        partitions: 0,
                        segments: 4,
                        pass: 1,
                        show_compressed: 0,
                        preprocessing: 0,
                        autofilter: 0,
                        partition_limit: 0,
                        alpha_compression: 1,
                        alpha_filtering: 1,
                        alpha_quality: 100,
                        lossless: 0,
                        exact: 0,
                        image_hint: 0,
                        emulate_jpeg_size: 0,
                        thread_level: 0,
                        low_memory: 0,
                        near_lossless: 100,
                        use_delta_palette: 0,
                        use_sharp_yuv: 0
                    },
                })
                writeFileSync(output, (await image.encodedWith.webp).binary)
            }
            catch (e)
            {
                console.error(e)
            }
        }
    })

    h264Files.forEach(item =>
    {
        if (needsCaching(item.path, 'mp4') || needsProcessing(item.path))
        {
            const output = item.path.replace(proc_dirname_dev, proc_dirname)
            console.log('  | Transcoding Video: ' + item.path.replace(proc_dirname_dev, '') + ' > ' + output.replace(proc_dirname, ''))

            try
            {
                mkdirSync(dirname(output), { recursive: true })
                if (commandExistsSync('ffmpeg'))
                {
                    execSync('start cmd /C ffmpeg -y -i ' + item.path + (isDebug ? ' -c:v librav1e -rav1e-params speed=10:low_latency=true' : ' -c:v librav1e -b:v 200K -rav1e-params speed=0:low_latency=true') + ' -movflags +faststart -c:a libopus -q:a 128 ' + output, err =>
                    {
                        if (err)
                        {
                            throw err
                        }
                    })
                }
                else
                {
                    console.error('No non-GPL compliant FFmpeg build detected in enviroment variables - falling back to libaom, video transcoding will take substantially longer and will be much lower quality!')
                    execSync('start cmd /C ' + ffmpeg + ' -y -i ' + item.path + ' -c:v libaom-av1 ' + (isDebug ? '-crf 52' : '-crf 30 -b:v 200k') + ' -movflags +faststart -c:a libopus -q:a 128 ' + output, err =>
                    {
                        if (err)
                        {
                            throw err
                        }
                    })
                }
            }
            catch (e)
            {
                console.error('  | ------------------------------------------------------------------------------------------------')
                console.error('  | FFMPEG Transcoding Error: ' + e)
                console.error('  | ------------------------------------------------------------------------------------------------')
            }
        }
    })

    const inputSize = await getFolderSize.loose(proc_dirname_dev)
    const outputSize = await getFolderSize.loose(proc_dirname)
    console.log('  |')
    console.log('  | > Size Before: ' + inputSize.toLocaleString('en') + ' bytes')
    console.log('  | > Size After:  ' + outputSize.toLocaleString('en') + ' bytes')
    console.log('  | > Efficiency: ' + (100 - (outputSize / inputSize * 100)).toFixed(4).toString() + '%')
    console.log(' /')
    console.log('/')
    console.log('\n----------------------------------------------------------------------------------------------------\n')
    await imagePool.close()
}

(async () =>
{
    console.clear()
    console.log('####################################################################################################')
    console.log('##                                                                                                ##')
    console.log('##                                        ' + __project_name + ' Bundler                                         ##')
    console.log('##                                                                                                ##')
    console.log('##                                  By Connor \'Stryxus\' Shearer.                                  ##')
    console.log('##                                                                                                ##')
    console.log('####################################################################################################\n')

    process.argv.forEach(item =>
    {
        switch (item)
        {
            case 'build:debug':
                isDebug = true
                break
            case 'build:release':
                isDebug = false
                break
        }
    })

    process.title = __project_name + " Bundler"

    const __client_dirname = join(__dirname, '../', __project_name, 'Client')
    const __client_wwwroot_dirname = join(__client_dirname, 'wwwroot')
    const __client_wwwrootdev_dirname = join(__client_dirname, 'wwwroot-dev')
    //const __server_dirname = join(__dirname, '../', __project_name, 'Server')
    //const __server_wwwroot_dirname = join(__server_dirname, 'wwwroot')
    //const __server_wwwrootdev_dirname = join(__server_dirname, 'wwwroot-dev')
    await processing(__client_wwwroot_dirname, __client_wwwrootdev_dirname)
    //await processing(__server_wwwroot_dirname, __server_wwwrootdev_dirname)
    if (isDebug)
    {
        chokidar.watch(__client_wwwrootdev_dirname, { awaitWriteFinish: true }).on('change', async path =>
        {
            await processing(__client_wwwroot_dirname, __client_wwwrootdev_dirname)
        });
    }
})()