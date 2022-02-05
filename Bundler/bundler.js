import { join, resolve, dirname, sep } from 'path'
import fss from 'fs'
import fs from 'fs/promises'
import process from 'process'
import { cpus } from 'os'

import chokidar from 'chokidar'
import getFolderSize from 'get-folder-size'
import sass from 'sass'
import ffmpeg from 'ffmpeg-static'
import commandExists from 'command-exists'
import { ImagePool } from '@squoosh/lib'
import { minify } from 'terser'
import exec from 'await-exec'
import pLimit from 'p-limit'

const limit = pLimit(1);

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

async function fileExists(path)
{
    return await fs.access(path, fss.constants.R_OK | fss.constants.W_OK).then(data => true).catch(err => false)
}

async function findFiles(path)
{
    const entries = await fs.readdir(path, { withFileTypes: true }).then(data => data).catch(err => console.error(err))
    const files = entries.filter(file => !file.isDirectory()).map(file => ({ ...file, path: join(path, file.name) }));
    const folders = entries.filter(folder => folder.isDirectory())
    for (const folder of folders) files.push(...await findFiles(`${path}${sep}${folder.name}${sep}`))
    return files
}

function filterFiles(files, ext)
{
    return Object.values(files).filter(file => String(file.name).split('.').pop() == ext)
}

async function needsCaching(proc_dirname, proc_dirname_dev, itempath, outExt)
{
    const entryExists = cacheEntities.cached.map(x => x.path).indexOf(itempath) > -1
    var shouldCache = true
    if (entryExists)
    {
        const entry = cacheEntities.cached.filter(file => file.path === itempath)[0]
        const outFileExists = await fileExists(
            outExt == 'min.css' ? join(proc_dirname, 'bundle.min.css') :
                outExt == 'min.js' ? join(proc_dirname, 'bundle.min.js') :
                    itempath.replace(proc_dirname_dev, proc_dirname).substring(0, itempath.lastIndexOf('.') - 4) + '.' + outExt, err => { if (err) console.error(err) })
        shouldCache = outFileExists ? new Date(entry.lastModified).getTime() < (await fs.stat(itempath).then(data => data).catch(err => console.error(err))).mtime.getTime() : true
    }
    if (shouldCache)
    {
        if (cacheEntities.cached.map(x => x.path).indexOf(itempath) > -1) cacheEntities.cached.splice(cacheEntities.cached.map(x => x.path).indexOf(itempath), 1)
        cacheEntities.cached.push({ path: itempath, lastModified: (await fs.stat(itempath).then(data => data).catch(err => console.error(err))).mtime })
        updatesQueued = true
    }
    return shouldCache
}

async function runSimpleCopy(itempath, proc_dirname, proc_dirname_dev, identifier)
{
    if (await needsCaching(proc_dirname, proc_dirname_dev, itempath, identifier))
    {
        const output = itempath.replace(proc_dirname_dev, proc_dirname)
        console.log('  | Copying ' + identifier.toUpperCase() + ': \\wwwroot-dev' + itempath.replace(proc_dirname_dev, '') + ' > \\wwwroot' + output.replace(proc_dirname, ''))
        await fs.mkdir(dirname(output), { recursive: true }, err => { if (err) console.error(err) })
        await fs.copyFile(itempath, output).catch((error) => console.log(error))
    }
}

var hasSASSBundleCompiled = false
var hasTSBundleCompiled = false
var updatesQueued = false

async function minifyTypescript(itempath, proc_dirname, proc_dirname_dev, bundle)
{
    if (await needsCaching(proc_dirname, proc_dirname_dev, itempath, 'min.js') && (!hasTSBundleCompiled || !bundle))
    {
        hasTSBundleCompiled = bundle
        try
        {
            const output = bundle ? join(proc_dirname, 'bundle.min.js') : itempath.replace(proc_dirname_dev, proc_dirname).replace('.ts', '.js')
            console.log('  | Minifying Typescript: ' + (bundle ? '\\wwwroot\\bundle.min.js - \\wwwroot\\bundle.js.map' : '\\wwwroot-dev' + itempath.replace(proc_dirname_dev, '') + ' > \\wwwroot' + output.replace(proc_dirname, '')))
            await exec('npx tsc ' + (bundle ? join(proc_dirname_dev, 'ts', 'bundle.ts') + ' --outFile "' + output + '"' : itempath + ' --outDir ' + proc_dirname) +
                ' --target ES2021 --lib DOM,ES2021' + (bundle ? ' --module none --esModuleInterop --allowSyntheticDefaultImports' : ',WebWorker') +
                ' --forceConsistentCasingInFileNames --strict --skipLibCheck',
                (error, stdout, stderr) =>
                {
                    if (error) console.log(`  | [ERROR] Typescript CLI: ${error.message}`)
                    else if (stderr) console.log(` | [ERROR] Typescript CLI: ${stderr}`)
                    else console.log(`  | [INFO] Typescript CLI: ${stdout}`)
                })
            const result = await minify(await fs.readFile(output, 'utf-8').then(data => data).catch(err => console.error(err)), { sourceMap: true, module: false, mangle: false, ecma: 2021, compress: true })
            await fs.truncate(output, 0, err => { if (err) console.error(err) })
            const mapFilename = output.replace('.js', '.js.map')
            if (await fileExists(mapFilename, err => { if (err) console.error(err) })) { await fs.truncate(mapFilename, 0, err => { if (err) console.error(err) }) }
            await fs.writeFile(output, result.code, err => { if (err) console.error(err) })
            await fs.writeFile(mapFilename, result.map, err => { if (err) console.error(err) })
        }
        catch (err)
        {
            console.error('  | ------------------------------------------------------------------------------------------------')
            console.error('  | Typescript Minification Error: ' + err)
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
    const files = await findFiles(proc_dirname_dev)
    const tsFiles = filterFiles(files,    'ts')   .filter(file => String(file.name) != 'service-worker.ts' && String(file.name) != 'service-worker.published.ts')
    const swtsFiles = filterFiles(files,  'ts')   .filter(file => String(file.name) == 'service-worker.ts' || String(file.name) == 'service-worker.published.ts')
    const sassFile = filterFiles(files,   'sass')
    const htmlFiles = filterFiles(files,  'html')
    const svgFiles = filterFiles(files,   'svg')
    const jsonFiles = filterFiles(files,  'json') .filter(file => String(file.name) != 'tsconfig.json')
    const woff2Files = filterFiles(files, 'woff2')
    const pngFiles = filterFiles(files,   'png')
    const h264Files = filterFiles(files, 'mp4')

    await Promise.all(tsFiles.map(item => limit(async () => await minifyTypescript(item.path, proc_dirname, proc_dirname_dev, true))))
    await Promise.all(swtsFiles.map(item => limit(async () => await minifyTypescript(item.path, proc_dirname, proc_dirname_dev, false))))
    await Promise.all(sassFile.map(item => limit(async () =>
    {
        if (await needsCaching(proc_dirname, proc_dirname_dev, item.path, 'min.css') && !hasSASSBundleCompiled)
        {
            hasSASSBundleCompiled = true
            try
            {
                const minCSSFilePath = proc_dirname + sep + 'bundle.min.css'
                const minMapFilePath = proc_dirname + sep + 'bundle.css.map'
                console.log('  | Minifying SASS: \\wwwroot\\bundle.min.css - \\wwwroot\\bundle.css.map')
                await fs.mkdir(dirname(minCSSFilePath), { recursive: true }, err => { if (err) console.error(err) })
                const result = sass.renderSync(
                    {
                        file: join(proc_dirname_dev, 'sass', 'bundle.sass'), sourceMap: true, outFile: 'bundle.css', outputStyle: isDebug ? 'expanded' : 'compressed', indentType: 'tab', indentWidth: 1, quietDeps: true
                    })
                if (await fileExists(minCSSFilePath), err => { if (err) console.error(err) }) { await fs.truncate(minCSSFilePath, 0, err => { if (err) console.error(err) }) }
                if (await fileExists(minMapFilePath), err => { if (err) console.error(err) }) { await fs.truncate(minMapFilePath, 0, err => { if (err) console.error(err) }) }
                await fs.writeFile(minCSSFilePath, result.css.toString(), err => { if (err) console.error(err) })
                await fs.writeFile(minMapFilePath, result.map.toString(), err => { if (err) console.error(err) })
            }
            catch (err)
            {
                console.error('  | ------------------------------------------------------------------------------------------------')
                console.error('  | SASS Minification Error: ' + err)
                console.error('  | ------------------------------------------------------------------------------------------------')
            }
        }
    })))
    await Promise.all(htmlFiles.map(item => limit(async () => await runSimpleCopy(item.path, proc_dirname, proc_dirname_dev, 'html'))))
    await Promise.all(svgFiles.map(item => limit(async () => await runSimpleCopy(item.path, proc_dirname, proc_dirname_dev, 'svg'))))
    await Promise.all(jsonFiles.map(item => limit(async () => await runSimpleCopy(item.path, proc_dirname, proc_dirname_dev, 'json'))))
    await Promise.all(woff2Files.map(item => limit(async () => await runSimpleCopy(item.path, proc_dirname, proc_dirname_dev, 'woff2'))))
    await Promise.all(pngFiles.map(item => limit(async () =>
    {
        if (await needsCaching(proc_dirname, proc_dirname_dev, item.path, 'webp'))
        {
            const output = item.path.replace(proc_dirname_dev, proc_dirname).replace('.png', '.webp')
            console.log('  | Transcoding Image: \\wwwroot-dev' + item.path.replace(proc_dirname_dev, '') + ' > \\wwwroot' + output.replace(proc_dirname, ''))
            await fs.mkdir(dirname(output), { recursive: true }, err => { if (err) console.error(err) })
            if (await fileExists(item.path.replace(proc_dirname_dev, proc_dirname))) await fs.unlink(item.path.replace(proc_dirname_dev, proc_dirname))
            try
            {
                const image = imagePool.ingestImage(await fs.readFile(item.path).then(data => data).catch(err => console.error(err)))
                await image.decoded
                await image.encode({
                    webp:
                    {
                        quality: 60,
                        target_size: 0,
                        target_PSNR: 0,
                        method: 6,
                        sns_strength: 100,
                        filter_strength: 100,
                        filter_sharpness: 1,
                        filter_type: 1,
                        partitions: 0,
                        segments: 4,
                        pass: 10,
                        show_compressed: 0,
                        preprocessing: 0,
                        autofilter: 0,
                        partition_limit: 0,
                        alpha_compression: 1,
                        alpha_filtering: 1,
                        alpha_quality: 75,
                        lossless: 0,
                        exact: 0,
                        image_hint: 0,
                        emulate_jpeg_size: 0,
                        thread_level: 1,
                        low_memory: 0,
                        near_lossless: 100,
                        use_delta_palette: 0,
                        use_sharp_yuv: 0
                    },
                })
                await fs.writeFile(output, (await image.encodedWith.webp).binary, err => { if (err) console.error(err) })
            }
            catch (err) { console.error(err) }
        }
    })))
    await Promise.all(h264Files.map(item => limit(async () =>
    {
        if (await needsCaching(proc_dirname, proc_dirname_dev, item.path, 'mp4'))
        {
            const output = item.path.replace(proc_dirname_dev, proc_dirname)
            console.log(' | Transcoding Video: \\wwwroot-dev' + item.path.replace(proc_dirname_dev, '') + ' > \\wwwroot' + output.replace(proc_dirname, ''))

            try
            {
                await mkdir(dirname(output), { recursive: true }, err => { if (err) console.error(err) })
                if (commandExists('ffmpeg').then(data => data).catch((err) => console.error(err)))
                {
                    await exec('start cmd /C ffmpeg -y -i ' + item.path + (isDebug ? ' -c:v librav1e -rav1e-params speed=10:low_latency=true' : ' -c:v librav1e -b:v 200K -rav1e-params speed=0:low_latency=true') +
                        ' -movflags +faststart -c:a libopus -q:a 128 ' + output,
                        (error, stdout, stderr) =>
                    {
                            if (error) console.log(`  | [ERROR] FFMpeg CLI: ${error.message}`)
                            else if (stderr) console.log(` | [ERROR] FFMpeg CLI: ${stderr}`)
                            else console.log(`  | [INFO] FFMpeg CLI: ${stdout}`)
                    })
                }
                else
                {
                    console.error('No non-GPL compliant FFmpeg build detected in enviroment variables - falling back to libaom, video transcoding will take substantially longer and will be much lower quality!')
                    await exec('start cmd /C ' + ffmpeg + ' -y -i ' + item.path + ' -c:v libaom-av1 ' + (isDebug ? '-crf 52' : '-crf 30 -b:v 200k') + ' -movflags +faststart -c:a libopus -q:a 128 ' + output,
                        (error, stdout, stderr) =>
                    {
                        if (error) console.log(`  | [ERROR] FFMpeg CLI: ${error.message}`)
                        else if (stderr) console.log(` | [ERROR] FFMpeg CLI: ${stderr}`)
                        else console.log(`  | [INFO] FFMpeg CLI: ${stdout}`)
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
    })))

    if (!updatesQueued) console.log('  | No files have changed!')
    console.log(' /')

    if (await fileExists(__cache_filename, err => { if (err) console.error(err) })) { await fs.truncate(__cache_filename, 0, err => { if (err) console.error(err) }) }
    await fs.writeFile(__cache_filename, JSON.stringify(cacheEntities, null, '\t'), err => { if (err) console.error(err) })
    await imagePool.close()

    const inputSize = await getFolderSize.loose(proc_dirname_dev)
    const outputSize = await getFolderSize.loose(proc_dirname)

    console.log('| > Size Before: ' + inputSize.toLocaleString('en') + ' bytes')
    console.log('| > Size After:  ' + outputSize.toLocaleString('en') + ' bytes')
    console.log('| > Efficiency: ' + (100 - (outputSize / inputSize * 100)).toFixed(4).toString() + '%')
    console.log('/')
    if (!clearOnUpdate) console.log('\n----------------------------------------------------------------------------------------------------\n')
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

    if (await fileExists(__cache_filename)) cacheEntities = JSON.parse(await fs.readFile(__cache_filename, 'utf-8').then(data => data).catch(err => console.error(err)))

    process.title = __project_name + " Bundler"

    const __client_dirname = join(__dirname, '../', __project_name, 'Client')
    const __client_wwwroot_dirname = join(__client_dirname, 'wwwroot')
    const __client_wwwrootdev_dirname = join(__client_dirname, 'wwwroot-dev')
    await processing(__client_wwwroot_dirname, __client_wwwrootdev_dirname)

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