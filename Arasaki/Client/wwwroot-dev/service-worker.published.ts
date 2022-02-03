/// <reference lib="webworker" />

interface Window 
{
    assetsManifest: any
}

self.importScripts('./service-worker-assets.js')
self.addEventListener('install', (event: any) => event.waitUntil(onInstall(event)))
self.addEventListener('activate', (event: any) => event.waitUntil(onActivate(event)))
self.addEventListener('fetch', (event: any) => event.respondWith(onFetch(event)))

const cacheNamePrefix = 'offline-cache-'
const cacheName = `${cacheNamePrefix}${self.assetsManifest.version}`
const offlineAssetsInclude = [ /\.dll$/, /\.pdb$/, /\.wasm/, /\.html/, /\.js$/, /\.json$/, /\.css$/, /\.woff2$/, /\.blat$/, /\.dat$/, /\.webp$/, /\.avif$/, /\.aac$/ ]
const offlineAssetsExclude = [ /^service-worker\.js$/ ]

async function onInstall(event: any)
{
    console.info('Arasaki: Installing...')
    const assetsRequests = self.assetsManifest.assets
        .filter((asset: any) => offlineAssetsInclude.some(pattern => pattern.test(asset.url)))
        .filter((asset: any) => !offlineAssetsExclude.some(pattern => pattern.test(asset.url)))
        .map((asset: any) => new Request(asset.url, { integrity: asset.hash, cache: 'no-cache' }))
    await caches.open(cacheName).then(cache => cache.addAll(assetsRequests))
    console.info('Arasaki: Installation Complete')
}

async function onActivate(event: any)
{
    console.info('Arasaki: Activating...')
    const cacheKeys = await caches.keys()
    await Promise.all(cacheKeys
        .filter(key => key.startsWith(cacheNamePrefix) && key !== cacheName)
        .map(key => caches.delete(key)))
    console.info('Arasaki: Activated')
}

async function onFetch(event: any)
{
    let cachedResponse;
    if (event.request.method === 'GET') 
    {
        const shouldServeIndexHtml = event.request.mode === 'navigate'
        const request = shouldServeIndexHtml ? 'index.html' : event.request
        const cache = await caches.open(cacheName)
        cachedResponse = await cache.match(request)
    }
    return cachedResponse || fetch(event.request)
}
