import { join, sep } from 'path';
import { readFile, stat, truncate, writeFile } from 'fs/promises';
import process from 'process';
import crypto from 'crypto';

import chokidar from 'chokidar';
import getFolderSize from 'get-folder-size';
import pLimit from 'p-limit';

import { convertTTFtoWOFF2, minifySass, minifyTypescript, resetCompilationVariables, runSimpleCopy, transcodeH264ToAV1, transcodePNGToWebP } from './bundler_processors.js';
import { fileExists, filterFiles, findFiles, __client_dirname, __client_wwwrootdev_dirname, __client_wwwroot_dirname, __dirname, __project_dirname } from './bundler_utils.js';

const limit = pLimit(1);

const __project_name = 'Arasaki';
const __project_introduction = __project_name + ' Bundler By Connor \'Stryxus\' Shearer.\n';

const __cache_filename = join(__dirname, __project_name.toLocaleLowerCase() + '-cache.json');

export var isDebug = false;
var clearOnUpdate = false;

var cacheEntities =
{
    cached: []
}

var osManifest =
{
    manifest: []
}

export async function needsCaching(__client_wwwroot_dirname, __client_wwwrootdev_dirname, itempath, outExt)
{
    const entryExists = cacheEntities.cached.map(x => x.path).indexOf(itempath) > -1;
    var shouldCache = true;
    if (entryExists)
    {
        const entry = cacheEntities.cached.filter(file => file.path === itempath)[0];
        const outFileExists = await fileExists(
            outExt == 'min.css' ? join(__client_wwwroot_dirname, 'bundle.min.css') :
                outExt == 'min.js' ? join(__client_wwwroot_dirname, 'bundle.min.js') :
                    itempath.replace(__client_wwwrootdev_dirname, __client_wwwroot_dirname).substring(0, itempath.lastIndexOf('.') - 4) + '.' + outExt).catch(err => console.error(err));
        shouldCache = outFileExists ? new Date(entry.lastModified).getTime() < (await stat(itempath).then(data => data).catch(err => console.error(err))).mtime.getTime() : true;
    }
    if (shouldCache)
    {
        if (cacheEntities.cached.map(x => x.path).indexOf(itempath) > -1) cacheEntities.cached.splice(cacheEntities.cached.map(x => x.path).indexOf(itempath), 1);
        cacheEntities.cached.push({ path: itempath, lastModified: (await stat(itempath).then(data => data).catch(err => console.error(err))).mtime });
        updatesQueued = true;
    }
    return shouldCache;
}

var updatesQueued = false;

async function processing(__client_wwwroot_dirname, __client_wwwrootdev_dirname)
{
    console.log('\\   Running Bundle Pass...');
    console.log(' \\');

    resetCompilationVariables();
    updatesQueued = false;
    const files = (await findFiles(__client_wwwrootdev_dirname)).filter(file => !file.path.includes('node_modules') && !file.path.includes('package.json') && !file.path.includes('package-lock.json'));
    const tsFiles = filterFiles(files, 'ts').filter(file => file.name != 'service-worker.ts' && file.name != 'service-worker.published.ts');
    const swtsFiles = filterFiles(files, 'ts').filter(file => file.name == 'service-worker.ts' || file.name == 'service-worker.published.ts');
    const sassFile = filterFiles(files, 'sass');
    const htmlFiles = filterFiles(files, 'html');
    const svgFiles = filterFiles(files, 'svg');
    const jsonFiles = filterFiles(files, 'json').filter(file => file.name != 'tsconfig.json');
    const ttfFiles = filterFiles(files, 'ttf');
    const woff2Files = filterFiles(files, 'woff2');
    const pngFiles = filterFiles(files, 'png').filter(file => file.name != 'pwa-192.png' && file.name != 'pwa-512.png');
    const pwapngFiles = filterFiles(files, 'png').filter(file => file.name == 'pwa-192.png' || file.name == 'pwa-512.png');
    const mp4Files = filterFiles(files, 'mp4');
    if (osManifest.manifest.length > 0) osManifest.manifest = [];

    await Promise.all(tsFiles.map(item => limit(async () => await minifyTypescript(item.path, __client_wwwroot_dirname, __client_wwwrootdev_dirname, true))));
    await Promise.all(swtsFiles.map(item => limit(async () => await minifyTypescript(item.path, __client_wwwroot_dirname, __client_wwwrootdev_dirname, false))));
    await Promise.all(sassFile.map(item => limit(async () => await minifySass(item.path, __client_wwwroot_dirname, __client_wwwrootdev_dirname))));
    await Promise.all(htmlFiles.map(item => limit(async () => await runSimpleCopy(item.path, __client_wwwroot_dirname, __client_wwwrootdev_dirname, 'html'))));
    await Promise.all(svgFiles.map(item => limit(async () => await runSimpleCopy(item.path, __client_wwwroot_dirname, __client_wwwrootdev_dirname, 'svg'))));
    await Promise.all(jsonFiles.map(item => limit(async () => await runSimpleCopy(item.path, __client_wwwroot_dirname, __client_wwwrootdev_dirname, 'json'))));
    await Promise.all(woff2Files.map(item => limit(async () => await runSimpleCopy(item.path, __client_wwwroot_dirname, __client_wwwrootdev_dirname, 'woff2'))));
    await Promise.all(ttfFiles.map(item => limit(async () => await convertTTFtoWOFF2(item.path, __client_wwwroot_dirname, __client_wwwrootdev_dirname))));
    await Promise.all(pngFiles.map(item => limit(async () => await transcodePNGToWebP(item.path, __client_wwwroot_dirname, __client_wwwrootdev_dirname))));
    await Promise.all(pwapngFiles.map(item => limit(async () => await runSimpleCopy(item.path, __client_wwwroot_dirname, __client_wwwrootdev_dirname, 'png'))));
    await Promise.all(mp4Files.map(item => limit(async () => await transcodeH264ToAV1(item.path, __client_wwwroot_dirname, __client_wwwrootdev_dirname))));

    if (!updatesQueued) console.log('  | No files have changed!');
    console.log(' /');

    if (await fileExists(__cache_filename)) { await truncate(__cache_filename, 0).catch(err => console.error(err)) };
    await writeFile(__cache_filename, JSON.stringify(cacheEntities, null, '\t')).catch(err => console.error(err));

    const inputSize = await getFolderSize.loose(__client_wwwrootdev_dirname);
    const outputSize = await getFolderSize.loose(__client_wwwroot_dirname);

    console.log('| > Size Before: ' + inputSize.toLocaleString('en') + ' bytes');
    console.log('| > Size After:  ' + outputSize.toLocaleString('en') + ' bytes');
    console.log('| > Efficiency: ' + (100 - (outputSize / inputSize * 100)).toFixed(4).toString() + '%');
    console.log('/');
    if (!clearOnUpdate) console.log('\n----------------------------------------------------------------------------------------------------\n');
}

async function createManifest(__client_wwwroot_dirname)
{
    await Promise.all((await findFiles(__client_wwwroot_dirname)).filter(item => !item.name.includes('arasaki-os-caches-manifest.json')).map(item => limit(async () =>
    {
        const data = await readFile(item.path).then(data => data);
        if (data) 
        {
            let sha = crypto.createHash('sha256');
            sha.setEncoding('hex');
            sha.write(data);
            sha.end();
            osManifest.manifest.push({
                path: String(item.name), hash: sha.read()
            });
        }
    })));
    const cachesManifestFile = join(__client_wwwroot_dirname, 'arasaki-os-caches-manifest.json');
    if (await fileExists(cachesManifestFile)) await truncate(cachesManifestFile, 0).catch(err => console.error(err));
    await writeFile(cachesManifestFile, JSON.stringify(osManifest, null, '\t')).catch(err => console.error(err));
}

(async () =>
{
    console.clear();
    console.log(__project_introduction);

    process.argv.forEach(item => {
        switch (item) {
            case 'build:debug': ;
                isDebug = true
                break;
            case 'build:release':
                isDebug = false;
                break;
            case 'build:cou':
                clearOnUpdate = true;
                break;
        }
    });

    if (await fileExists(__cache_filename)) cacheEntities = JSON.parse(await readFile(__cache_filename, 'utf-8').then(data => data).catch(err => console.error(err)));

    process.title = __project_name + " Bundler";

    await processing(__client_wwwroot_dirname, __client_wwwrootdev_dirname);
    await createManifest(__client_wwwroot_dirname);

    if (isDebug)
    {
        chokidar.watch(__project_dirname, { awaitWriteFinish: true }).on('change', async (e, p) =>
        {
            const strp = String(p);
            if ([`${sep}UEFI${sep}`, `${sep}OS${sep}`].some(x => strp.includes(x)) &&
               ![`${sep}bin${sep}`, `${sep}obj${sep}`, `${sep}Properties${sep}`, `${sep}wwwroot${sep}` ].some(x => strp.includes(x)))
            {
                if (clearOnUpdate)
                {
                    console.clear();
                    console.log(__project_introduction);
                }
                await processing(__client_wwwroot_dirname, __client_wwwrootdev_dirname);
                await createManifest(__client_wwwroot_dirname);
            }
        });
    }
})()