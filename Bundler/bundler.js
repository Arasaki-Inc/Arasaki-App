import { join, resolve, dirname, sep } from 'path'
import { constants, readFileSync, writeFileSync, statSync, accessSync, truncateSync, unlinkSync, readdirSync, mkdirSync, copyFileSync } from 'fs'
import { execSync } from 'child_process'

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
const __client_dirname = join(__dirname, '../', __project_name, 'Client')
const __client_wwwroot_dirname = join(__client_dirname, 'wwwroot')
const __client_wwwrootdev_dirname = join(__client_dirname, 'wwwroot-dev')
const __config_filename = join(__dirname, __project_name.toLocaleLowerCase() + '-config.json')
const __cache_filename = join(__dirname, __project_name.toLocaleLowerCase() + '-cache.json')

var isDebug

//const imagePool = new ImagePool()

// Global Variables //

// JSON //

var config =
{
    jsDependencies: []
}

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

function loadConfig()
{
    if (fileExists(__config_filename))
    {
        config = JSON.parse(readFileSync(__config_filename))
    }
    else
    {
        writeFileSync(__config_filename, JSON.stringify(config, null, "\t"), 'utf8')
    }
}

function addCacheEntry(filepath)
{
    const relativeFilePath = filepath.replace(__client_wwwrootdev_dirname, '')
    cacheEntities.cached = cacheEntities.cached.filter(f => f.relativeFilePath !== relativeFilePath)
    cacheEntities.cached.push({ relativeFilePath: relativeFilePath, lastModified: statSync(filepath).mtime })
    if (fileExists(__cache_filename))
    {
        truncateSync(__cache_filename, 0)
    }
    writeFileSync(__cache_filename, JSON.stringify(cacheEntities, null, "\t"), 'utf8')
}

function needsCaching(filepath, procExt)
{
    if (fileExists(__cache_filename))
    {
        cacheEntities = JSON.parse(readFileSync(__cache_filename))
    }
    const procFilePath = filepath.replace(__client_wwwrootdev_dirname, __client_wwwroot_dirname)
    const containsEntry = cacheEntities.cached.some(file => file.relativeFilePath === filepath.replace(__client_wwwrootdev_dirname, ''))
    if (!containsEntry)
    {
        addCacheEntry(filepath)
    }
    return !(containsEntry && fileExists(procFilePath.substring(0, procFilePath.lastIndexOf('.')) + '.' + procExt))
}

function needsProcessing(filepath)
{
    const cachedFile = cacheEntities.cached.filter(file => file.relativeFilePath === filepath.replace(__client_wwwrootdev_dirname, ''))[0]
    const needsProc = new Date(cachedFile.lastModified).getTime() < statSync(filepath).mtime.getTime()
    if (needsProc)
    {
        addCacheEntry(filepath)
    }
    return needsProc
}

async function processing()
{
    console.log('\\  Changes Made > Running Bundle Pass...')
    console.log(' \\')

    const imagePool = new ImagePool(cpus().length)
    const files = findFiles(__client_wwwrootdev_dirname)
    const swjsFiles = filterFiles(files, 'js').filter(file => String(file.name) == 'service-worker.js' || String(file.name) == 'service-worker.published.js')
    const sassFile = join(__client_wwwrootdev_dirname, 'sass', 'bundle.sass')
    const htmlFiles = filterFiles(files, 'html')
    const svgFiles = filterFiles(files, 'svg')
    const jsonFiles = filterFiles(files, 'json')
    const woff2Files = filterFiles(files, 'woff2')
    const pngFiles = filterFiles(files, 'png')
    const h264Files = filterFiles(files, 'mp4')

    try
    {
        const minCSSFilePath = __client_wwwroot_dirname + sep + 'bundle.min.css'
        const minMapFilePath = __client_wwwroot_dirname + sep + 'bundle.css.map'
        console.log('  | Minifying SASS: ' + minCSSFilePath.replace(__client_wwwroot_dirname, ''))
        const result = sass.renderSync(
        {
            file: sassFile, sourceMap: true, outFile: isDebug ? 'bundle.css' : 'bundle.min.css', outputStyle: isDebug ? 'expanded' : 'compressed', indentType: 'tab', indentWidth: 1, quietDeps: true
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
        console.error('  | sass Minification Error: ' + e)
        console.error('  | ------------------------------------------------------------------------------------------------')
    }

    swjsFiles.forEach(async item =>
    {
        if (needsCaching(item.path, 'js') || needsProcessing(item.path))
        {
            const output = item.path.replace('wwwroot-dev', 'wwwroot')
            console.log('  | Minifying Service Worker: ' + item.path.replace(__client_wwwrootdev_dirname, '') + ' > ' + output.replace(__client_wwwroot_dirname, ''))
            const result = await minify(readFileSync(item.path, 'utf8'), { sourceMap: false, module: false, mangle: false, ecma: 2021, compress: true })
            writeFileSync(output, result.code, 'utf8')
        }
    })

    htmlFiles.forEach(item =>
    {
        if (needsCaching(item.path, 'html') || needsProcessing(item.path))
        {
            const output = item.path.replace('wwwroot-dev', 'wwwroot')
            console.log('  | Copying HTML: ' + item.path.replace(__client_wwwrootdev_dirname, '') + ' > ' + output.replace(__client_wwwroot_dirname, ''))
            mkdirSync(dirname(output), { recursive: true })
            copyFileSync(item.path, output)
        }
    })

    svgFiles.forEach(item =>
    {
        if (needsCaching(item.path, 'svg') || needsProcessing(item.path))
        {
            const output = item.path.replace('wwwroot-dev', 'wwwroot')
            console.log('  | Copying SVG: ' + item.path.replace(__client_wwwrootdev_dirname, '') + ' > ' + output.replace(__client_wwwroot_dirname, ''))
            mkdirSync(dirname(output), { recursive: true })
            copyFileSync(item.path, output)
        }
    })

    jsonFiles.forEach(item =>
    {
        if (needsCaching(item.path, 'json') || needsProcessing(item.path))
        {
            const output = item.path.replace(__client_wwwrootdev_dirname, __client_wwwroot_dirname)
            console.log('  | Copying JSON: ' + item.path.replace(__client_wwwrootdev_dirname, '') + ' > ' + output.replace(__client_wwwroot_dirname, ''))
            mkdirSync(dirname(output), { recursive: true })
            copyFileSync(item.path, output)
        }
    })

    woff2Files.forEach(item =>
    {
        if (needsCaching(item.path, 'woff2') || needsProcessing(item.path))
        {
            const output = item.path.replace(__client_wwwrootdev_dirname, __client_wwwroot_dirname)
            console.log('  | Copying Font: ' + item.path.replace(__client_wwwrootdev_dirname, '') + ' > ' + output.replace(__client_wwwroot_dirname, ''))
            mkdirSync(dirname(output), { recursive: true })
            copyFileSync(item.path, output)
        }
    })

    pngFiles.forEach(async item =>
    {
        if (needsCaching(item.path, 'webp') || needsProcessing(item.path))
        {
            const output = item.path.replace('wwwroot-dev', 'wwwroot').replace('.png', '.webp')
            console.log('  | Transcoding Image: ' + item.path.replace(__client_wwwrootdev_dirname, '') + ' > ' + output.replace(__client_wwwroot_dirname, ''))
            mkdirSync(dirname(output), { recursive: true })
            if (fileExists(item.path.replace(__client_wwwrootdev_dirname, __client_wwwroot_dirname)))
            {
                unlinkSync(item.path.replace(__client_wwwrootdev_dirname, __client_wwwroot_dirname))
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
            const output = item.path.replace('wwwroot-dev', 'wwwroot')
            console.log('  | Transcoding Video: ' + item.path.replace(__client_wwwrootdev_dirname, '') + ' > ' + output.replace(__client_wwwroot_dirname, ''))
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
    })

    const inputSize = await getFolderSize.loose(__client_wwwrootdev_dirname)
    const outputSize = await getFolderSize.loose(__client_wwwroot_dirname)
    console.log('  |')
    console.log('  | > Size Before: ' + inputSize.toLocaleString('en') + ' bytes')
    console.log('  | > Size After:  ' + outputSize.toLocaleString('en') + ' bytes')
    console.log('  | > Compression: ' + (100 - (outputSize / inputSize * 100)).toFixed(4).toString() + '%')
    console.log(' /')
    console.log('/')
    console.log('\n----------------------------------------------------------------------------------------------------\n')
    await imagePool.close()
}

(async () =>
{
    // Dramatic Intro
    console.clear()
    console.log('####################################################################################################')
    console.log('##                                                                                                ##')
    console.log('##                                        ' + __project_name + ' Bundler                                         ##')
    console.log('##                                                                                                ##')
    console.log('##                                  By Connor \'Stryxus\' Shearer.                                  ##')
    console.log('##                                                                                                ##')
    console.log('####################################################################################################\n')
    //

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

    loadConfig()
    await processing()
    chokidar.watch(__client_wwwrootdev_dirname, { awaitWriteFinish: true }).on('change', async () =>
    {
        await processing()
    });
})()