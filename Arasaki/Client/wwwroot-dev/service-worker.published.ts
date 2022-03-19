/// <reference lib="webworker" />

interface Window 
{
    assetsManifest: any
}

self.importScripts('./service-worker-assets.js');

const cacheNamePrefix = 'offline-cache-'
const cacheName = `${cacheNamePrefix}${self.assetsManifest.version}`
const offlineAssetsInclude = [ /\.dll$/, /\.wasm/, /\.blat$/, /\.dat$/, /\.html/, /\.js$/, /\.css$/, /\.json$/, /\.woff2$/, /\.aac$/, /\.webp$/, /\.mp4$/];
//const offlineAssetsExclude = [ ]

self.addEventListener('install', (event: any) => event.waitUntil(async () => await caches.open(cacheName).then(cache => cache.addAll(self.assetsManifest.assets
    .filter((asset: any) => offlineAssetsInclude.some(pattern => pattern.test(asset.url)))
    //.filter((asset: any) => !offlineAssetsExclude.some(pattern => pattern.test(asset.url)))
    .map((asset: any) => new Request(asset.url, { integrity: asset.hash, cache: 'no-cache' }))))));
self.addEventListener('activate', (event: any) => event.waitUntil(async () => await Promise.all((await caches.keys())
    .filter(key => key.startsWith(cacheNamePrefix) && key !== cacheName)
    .map(key => caches.delete(key)))));
self.addEventListener('fetch', (event: any) => event.respondWith(async () => (event.request.method === 'GET' 
    && await (await caches.open(cacheName)).match(event.request.mode === 'navigate' ? 'index.html' : event.request)) 
    || fetch(event.request)));