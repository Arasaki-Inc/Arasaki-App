import { copyFile, mkdir, readFile, truncate, unlink, writeFile } from 'fs/promises';
import { dirname, join, sep } from 'path';
import { cpus } from 'os';

import { ImagePool } from '@squoosh/lib';
import { minify } from 'terser';
import ffmpeg from 'ffmpeg-static';
import commandExists from 'command-exists';
import exec from 'await-exec';
import ttf2woff2 from 'ttf2woff2';

import { isDebug, needsCaching } from './bundler.js';
import { fileExists } from './bundler_utils.js';
import { analyse_css } from './bundler_analysers.js';

var hasSASSBundleCompiled = false;
var hasTSBundleCompiled = false;

export function resetCompilationVariables()
{
    hasSASSBundleCompiled = false;
    hasTSBundleCompiled = false;
}

export async function runSimpleCopy(itempath, __client_wwwroot_dirname, __client_wwwrootdev_dirname, identifier)
{
    if (await needsCaching(__client_wwwroot_dirname, __client_wwwrootdev_dirname, itempath, identifier))
    {
        try
        {
            const output = itempath.replace(__client_wwwrootdev_dirname, __client_wwwroot_dirname);
            console.log('  | Copying:              [' + identifier.toUpperCase() + `] ${sep}wwwroot-dev` + itempath.replace(__client_wwwrootdev_dirname, '') + ` > ${sep}wwwroot` + output.replace(__client_wwwroot_dirname, ''));
            await mkdir(dirname(output), { recursive: true }).catch(err => { throw err; });
            await copyFile(itempath, output).catch(err => { throw err; });
        }
        catch (e)
        {
            console.error('  | ------------------------------------------------------------------------------------------------');
            console.error(`  | Copy Error: ${e}`);
            console.error('  | ------------------------------------------------------------------------------------------------');
        }
    }
}

export async function minifyTypescript(itempath, __client_wwwroot_dirname, __client_wwwrootdev_dirname, bundle)
{
    if (await needsCaching(__client_wwwroot_dirname, __client_wwwrootdev_dirname, itempath, 'min.js') && (!hasTSBundleCompiled || !bundle))
    {
        hasTSBundleCompiled = bundle;
        try
        {
            const output = bundle ? join(__client_wwwroot_dirname, 'bundle.min.js') : itempath.replace(__client_wwwrootdev_dirname, __client_wwwroot_dirname).replace('.ts', '.js');
            console.log('  | Minifying Typescript: ' + (bundle ? `${sep}wwwroot${sep}bundle.min.js - ${sep}wwwroot${sep}bundle.js.map` : `${sep}wwwroot-dev` + itempath.replace(__client_wwwrootdev_dirname, '') +
                ` > ${sep}wwwroot` + output.replace(__client_wwwroot_dirname, '')));
            await exec('npx tsc ' + (bundle ? join(__client_wwwrootdev_dirname, 'ts', 'bundle.ts') + ' --outFile "' + output + '"' : itempath + ' --outDir ' + __client_wwwroot_dirname) +
                ' --target ES2021 --lib DOM,ES2021' + (bundle ? ' --module amd' : ',WebWorker') +
                ' --forceConsistentCasingInFileNames --strict --skipLibCheck --noImplicitAny --importsNotUsedAsValues preserve',
                (error, stdout, stderr) =>
                {
                    if (error) console.log(`  | [ERROR] Typescript CLI: ${error.message}`);
                    else if (stderr) console.log(` | [ERROR] Typescript CLI: ${stderr}`);
                    else console.log(`  | [INFO] Typescript CLI: ${stdout}`);
                });
            const result = await minify((bundle ? await readFile(join(__client_wwwrootdev_dirname, 'node_modules', 'requirejs', 'require.js'), 'utf-8').then(data => data).catch(err => { throw err; }) : '') +
                await readFile(output, 'utf-8').then(data => data).catch(err => { throw err; }), { sourceMap: isDebug, module: false, mangle: false, ecma: 2021, compress: !isDebug });
            await truncate(output, 0).catch(err => { throw err; });
            const mapFilename = output.replace('.js', '.js.map');
            if (isDebug && await fileExists(mapFilename)) await truncate(mapFilename, 0).catch(err => { throw err; });
            await writeFile(output, result.code).catch(err => { throw err; });
            if (isDebug) await writeFile(mapFilename, result.map).catch(err => { throw err; });
        }
        catch (e)
        {
            console.error('  | ------------------------------------------------------------------------------------------------');
            console.error(`  | Typescript Minification Error: ${e}`);
            console.error('  | ------------------------------------------------------------------------------------------------');
        }
    }
}

export async function minifySass(itempath, __client_wwwroot_dirname, __client_wwwrootdev_dirname)
{
    if (await needsCaching(__client_wwwroot_dirname, __client_wwwrootdev_dirname, itempath, 'min.css') && !hasSASSBundleCompiled)
    {
        hasSASSBundleCompiled = true;
        try
        {
            if (commandExists('dart').then(data => data).catch(err => { throw err; }))
            {
                console.log(`  | Minifying SASS:       ${sep}wwwroot${sep}bundle.min.css - ${sep}wwwroot${sep}bundle.css.map`);
                const output = join(__client_wwwroot_dirname, 'bundle.min.css');
                await exec(`start /min cmd /C dart sass-minify.dart ${join(__client_wwwrootdev_dirname, 'sass', 'bundle.sass')} ${output}`,
                    (error, stdout, stderr) =>
                    {
                        if (error) console.log(`  | [ERROR] Dart-Sass CLI: ${error.message}`)
                        else if (stderr) console.log(` | [ERROR] Dart-Sass CLI: ${stderr}`)
                        else console.log(`  | [INFO] Dart-Sass CLI: ${stdout}`)
                    });
            }
            else throw 'Dart is not installed or command path index has not been updated if you did install it!';
        }
        catch (e)
        {
            console.error('  | ------------------------------------------------------------------------------------------------');
            console.error(`  | SASS Minification Error: ${e}`);
            console.error('  | ------------------------------------------------------------------------------------------------');
        }
        const output = join(__client_wwwroot_dirname, 'bundle.min.css');
        const minified = await analyse_css(await readFile(output, 'utf-8').then(data => data).catch(err => { throw err; }));
        await truncate(output, 0).catch(err => { throw err; });
        await writeFile(output, minified).catch(err => { throw err; });
    }
}

export async function convertTTFtoWOFF2(itempath, __client_wwwroot_dirname, __client_wwwrootdev_dirname)
{
    if (await needsCaching(__client_wwwroot_dirname, __client_wwwrootdev_dirname, itempath, 'woff2'))
    {
        try 
        {
            const output = itempath.replace(__client_wwwrootdev_dirname, __client_wwwroot_dirname).replace('.ttf', '.woff2');
            console.log(`  | Optimising TTF:       ${sep}wwwroot-dev` + itempath.replace(__client_wwwrootdev_dirname, '') + ` > ${sep}wwwroot` + output.replace(__client_wwwroot_dirname, ''));
            await mkdir(dirname(output), { recursive: true }).catch(err => { throw err; });
            await writeFile(output, ttf2woff2(await readFile(itempath).then(data => data).catch(err => { throw err; }))).catch(err => { throw err; });
        }
        catch (e)
        {
            console.error('  | ------------------------------------------------------------------------------------------------');
            console.error(`  | TTF To WOFF2 Conversion Error: ${e}`);
            console.error('  | ------------------------------------------------------------------------------------------------');
        }
    }
}

export async function transcodePNGToWebP(itempath, __client_wwwroot_dirname, __client_wwwrootdev_dirname)
{
    if (await needsCaching(__client_wwwroot_dirname, __client_wwwrootdev_dirname, itempath, 'webp'))
    {
        try 
        {
            const imagePool = new ImagePool(cpus().length);
            const output = itempath.replace(__client_wwwrootdev_dirname, __client_wwwroot_dirname).replace('.png', '.webp');
            console.log(`  | Transcoding Image:    ${sep}wwwroot-dev` + itempath.replace(__client_wwwrootdev_dirname, '') + ` > ${sep}wwwroot` + output.replace(__client_wwwroot_dirname, ''));
            await mkdir(dirname(output), { recursive: true }).catch(err => { throw err; });
            if (await fileExists(itempath.replace(__client_wwwrootdev_dirname, __client_wwwroot_dirname))) await unlink(itempath.replace(__client_wwwrootdev_dirname, __client_wwwroot_dirname));
            const image = imagePool.ingestImage(await readFile(itempath).then(data => data).catch(err => { throw err; }));
            await image.decoded;
            await image.encode({
                webp:
                {
                    quality: 60,
                    method: 6,
                    pass: 10,
                    alpha_compression: 1,
                    alpha_filtering: 1,
                    alpha_quality: 75,
                    lossless: 0,
                    exact: 0,
                    thread_level: 1,
                    near_lossless: 100,
                    use_sharp_yuv: 0
                },
            });
            await writeFile(output, (await image.encodedWith.webp).binary).catch(err => { throw err; });
            await imagePool.close();
        }
        catch (e)
        {
            console.error('  | ------------------------------------------------------------------------------------------------');
            console.error(`  | PNG To WebP Trancoding Error: ${e}`);
            console.error('  | ------------------------------------------------------------------------------------------------');
        }
    }
}

export async function transcodeH264ToAV1(itempath, __client_wwwroot_dirname, __client_wwwrootdev_dirname)
{
    if (await needsCaching(__client_wwwroot_dirname, __client_wwwrootdev_dirname, itempath, 'mp4'))
    {
        const output = itempath.replace(__client_wwwrootdev_dirname, __client_wwwroot_dirname);
        try
        {
            console.log(` | Transcoding Video:    ${sep}wwwroot-dev` + itempath.replace(__client_wwwrootdev_dirname, '') + ` > ${sep}wwwroot` + output.replace(__client_wwwroot_dirname, ''));
            await mkdir(dirname(output), { recursive: true }).catch(err => { throw err; });
            if (commandExists('ffmpeg').then(data => data).catch(err => { throw err; }))
            {
                await exec('start cmd /C ffmpeg -y -i ' + itempath + (isDebug ? ' -c:v librav1e -rav1e-params speed=10:low_latency=true' : ' -c:v librav1e -b:v 200K -rav1e-params speed=0:low_latency=true') +
                    ' -movflags +faststart -c:a libopus -q:a 128 ' + output,
                    (error, stdout, stderr) =>
                    {
                        if (error) console.log(`  | [ERROR] FFMpeg CLI: ${error.message}`)
                        else if (stderr) console.log(` | [ERROR] FFMpeg CLI: ${stderr}`)
                        else console.log(`  | [INFO] FFMpeg CLI: ${stdout}`)
                    });
            }
            else
            {
                console.error('No non-GPL compliant FFmpeg build detected in enviroment variables - falling back to libaom, video transcoding will take substantially longer and will be much lower quality!');
                await exec('start cmd /C ' + ffmpeg + ' -y -i ' + itempath + ' -c:v libaom-av1 ' + (isDebug ? '-crf 52' : '-crf 30 -b:v 200k') + ' -movflags +faststart -c:a libopus -q:a 128 ' + output,
                    (error, stdout, stderr) =>
                    {
                        if (error) console.log(`  | [ERROR] FFMpeg CLI: ${error.message}`);
                        else if (stderr) console.log(` | [ERROR] FFMpeg CLI: ${stderr}`);
                        else console.log(`  | [INFO] FFMpeg CLI: ${stdout}`);
                    });
            }
        }
        catch (e)
        {
            console.error('  | ------------------------------------------------------------------------------------------------');
            console.error(`  | FFMPEG Transcoding Error: ${e}`);
            console.error('  | ------------------------------------------------------------------------------------------------');
        }
    }
}