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

const __project_name = 'Arasaki'
const __project_introduction = __project_name + ' Bundler by By Connor \'Stryxus\' Shearer.\n'

const __dirname = resolve()
const __cache_filename = join(__dirname, __project_name.toLocaleLowerCase() + '-cache.json')

var isDebug
var clearOnUpdate = false

var cacheEntities =
{
    cached: []
}

function fileExists(path)
{
    try
    {
        accessSync(path, constants.R_OK | constants.W_OK)
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

function needsCaching(proc_dirname, proc_dirname_dev, itempath, outExt)
{
    if (fileExists(__cache_filename))
    {
        cacheEntities = JSON.parse(readFileSync(__cache_filename))
    }
    const entryExists = cacheEntities.cached.some(file => file.path === itempath)
    var shouldCache = true
    if (entryExists)
    {
        const entry = cacheEntities.cached.filter(file => file.path === itempath)[0]
        const outFileExists = fileExists(
            outExt == 'min.css' ? join(proc_dirname, 'bundle.min.css') :
                outExt == 'min.js' ? join(proc_dirname, 'bundle.min.js') :
                    itempath.replace(proc_dirname_dev, proc_dirname).substring(0, itempath.lastIndexOf('.') - 4) + '.' + outExt)
        shouldCache = outFileExists ? new Date(entry.lastModified).getTime() < statSync(itempath).mtime.getTime() : true
    }
    if (shouldCache)
    {
        cacheEntities.cached = cacheEntities.cached.filter(f => f.path !== itempath)
        cacheEntities.cached.push({ path: itempath, lastModified: statSync(itempath).mtime })
        if (fileExists(__cache_filename))
        {
            truncateSync(__cache_filename, 0)
        }
        writeFileSync(__cache_filename, JSON.stringify(cacheEntities, null, '\t'), 'utf8')
        updatesQueued = true
    }
    return shouldCache
}

function runSimpleCopy(itempath, proc_dirname, proc_dirname_dev, identifier)
{
    if (needsCaching(proc_dirname, proc_dirname_dev, itempath, identifier))
    {
        const output = itempath.replace(proc_dirname_dev, proc_dirname)
        console.log('  | Copying ' + identifier.toUpperCase() + ': \\wwwroot-dev' + itempath.replace(proc_dirname_dev, '') + ' > \\wwwroot' + output.replace(proc_dirname, ''))
        mkdirSync(dirname(output), { recursive: true })
        copyFileSync(itempath, output)
    }
}

var hasSASSBundleCompiled = false
var hasTSBundleCompiled = false
var updatesQueued = false

async function minifyTypescript(itempath, proc_dirname, proc_dirname_dev, bundle)
{
    if (needsCaching(proc_dirname, proc_dirname_dev, itempath, 'min.js') && (!hasTSBundleCompiled || !bundle))
    {
        hasTSBundleCompiled = bundle
        try
        {
            const output = bundle ? join(proc_dirname, 'bundle.min.js') : itempath.replace(proc_dirname_dev, proc_dirname).replace('.ts', '.js')
            console.log('  | Minifying Typescript: ' + (bundle ? '\\wwwroot\\bundle.min.js - \\wwwroot\\bundle.js.map' : '\\wwwroot-dev' + itempath.replace(proc_dirname_dev, '') + ' > \\wwwroot' + output.replace(proc_dirname, '')))
            execSync('npx tsc ' + (bundle ? join(proc_dirname_dev, 'ts', 'bundle.ts') + ' --outFile "' + output + '"' : itempath + ' --outDir ' + proc_dirname) +
                ' --target ES2021 --lib DOM,ES2021,WebWorker ' + (bundle ? '--module amd --esModuleInterop --allowSyntheticDefaultImports' : '') +
                ' --forceConsistentCasingInFileNames --strict --skipLibCheck',
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
    console.log('\\   Running Bundle Pass...')
    console.log(' \\')

    hasSASSBundleCompiled = false
    hasTSBundleCompiled = false
    updatesQueued = false
    const imagePool = new ImagePool(cpus().length)
    const files = findFiles(proc_dirname_dev)
    const tsFiles = filterFiles(files,    'ts')   .filter(file => String(file.name) != 'service-worker.ts' && String(file.name) != 'service-worker.published.ts')
    const swtsFiles = filterFiles(files,  'ts')   .filter(file => String(file.name) == 'service-worker.ts' || String(file.name) == 'service-worker.published.ts')
    const sassFile = filterFiles(files,   'sass')
    const htmlFiles = filterFiles(files,  'html')
    const svgFiles = filterFiles(files,   'svg')
    const jsonFiles = filterFiles(files,  'json') .filter(file => String(file.name) != 'tsconfig.json')
    const woff2Files = filterFiles(files, 'woff2')
    const pngFiles = filterFiles(files,   'png')
    const h264Files = filterFiles(files, 'mp4')

    tsFiles.forEach(async item => await minifyTypescript(item.path, proc_dirname, proc_dirname_dev, true))
    swtsFiles.forEach(async item => await minifyTypescript(item.path, proc_dirname, proc_dirname_dev, false))
    sassFile.forEach(async item =>
    {
        if (needsCaching(proc_dirname, proc_dirname_dev, item.path, 'min.css') && !hasSASSBundleCompiled)
        {
            hasSASSBundleCompiled = true
            try
            {
                const minCSSFilePath = proc_dirname + sep + 'bundle.min.css'
                const minMapFilePath = proc_dirname + sep + 'bundle.css.map'
                console.log('  | Minifying SASS: \\wwwroot\\bundle.min.css - \\wwwroot\\bundle.css.map')
                mkdirSync(dirname(minCSSFilePath), { recursive: true })
                const result = sass.renderSync(
                    {
                        file: join(proc_dirname_dev, 'sass', 'bundle.sass'), sourceMap: true, outFile: 'bundle.css', outputStyle: isDebug ? 'expanded' : 'compressed', indentType: 'tab', indentWidth: 1, quietDeps: true
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
        }
    })
    htmlFiles.forEach(item => runSimpleCopy(item.path, proc_dirname, proc_dirname_dev, 'html'))
    svgFiles.forEach(item => runSimpleCopy(item.path, proc_dirname, proc_dirname_dev, 'svg'))
    jsonFiles.forEach(item => runSimpleCopy(item.path, proc_dirname, proc_dirname_dev, 'json'))
    woff2Files.forEach(item => runSimpleCopy(item.path, proc_dirname, proc_dirname_dev, 'woff2'))
    pngFiles.forEach(async item =>
    {
        if (needsCaching(proc_dirname, proc_dirname_dev, item.path, 'webp'))
        {
            const output = item.path.replace(proc_dirname_dev, proc_dirname).replace('.png', '.webp')
            console.log('  | Transcoding Image: \\wwwroot-dev' + item.path.replace(proc_dirname_dev, '') + ' > \\wwwroot' + output.replace(proc_dirname, ''))
            mkdirSync(dirname(output), { recursive: true })
            if (fileExists(item.path.replace(proc_dirname_dev, proc_dirname)))
            {
                unlinkSync(item.path.replace(proc_dirname_dev, proc_dirname))
            }
            try
            {
                const image = imagePool.ingestImage(readFileSync(item.path))
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
                    webp:
                    {
                        quality: 75,
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
        if (needsCaching(proc_dirname, proc_dirname_dev, item.path, 'mp4'))
        {
            const output = item.path.replace(proc_dirname_dev, proc_dirname)
            console.log(' | Transcoding Video: \\wwwroot-dev' + item.path.replace(proc_dirname_dev, '') + ' > \\wwwroot' + output.replace(proc_dirname, ''))

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

    if (!updatesQueued) console.log('  | No files have changed!')
    console.log(' /')

    const inputSize = await getFolderSize.loose(proc_dirname_dev)
    const outputSize = await getFolderSize.loose(proc_dirname)

    console.log('| > Size Before: ' + inputSize.toLocaleString('en') + ' bytes')
    console.log('| > Size After:  ' + outputSize.toLocaleString('en') + ' bytes')
    console.log('| > Efficiency: ' + (100 - (outputSize / inputSize * 100)).toFixed(4).toString() + '%')
    console.log('/')
    if (!clearOnUpdate) console.log('\n----------------------------------------------------------------------------------------------------\n')
    await imagePool.close()
}

(async () =>
{
    console.clear()
    console.log(__project_introduction)

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
            case 'build:cou':
                clearOnUpdate = true
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
        chokidar.watch(__client_wwwrootdev_dirname, { awaitWriteFinish: true }).on('change', async () =>
        {
            if (clearOnUpdate)
            {
                console.clear()
                console.log(__project_introduction)
            }
            await processing(__client_wwwroot_dirname, __client_wwwrootdev_dirname)
        });
    }
})()