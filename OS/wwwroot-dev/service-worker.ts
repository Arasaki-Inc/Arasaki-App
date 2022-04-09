/// <reference lib="webworker" />

interface Window 
{
    assetsManifest: any
}

self.addEventListener('install', (event: any) => event.waitUntil(onInstall(event)))
self.addEventListener('activate', (event: any) => event.waitUntil(onActivate(event)))
self.addEventListener('fetch', (event: any) => event.respondWith(onFetch(event)))
//const cacheNamePrefix = 'offline-cache-'
//const cacheName = `${cacheNamePrefix}${self.assetsManifest.version}`
const cacheName = `arasaki-os-cache`

async function onInstall(event: any)
{
    
}

async function onActivate(event: any)
{

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
    return cachedResponse
}