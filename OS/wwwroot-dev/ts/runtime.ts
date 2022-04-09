(() =>
{
    window.runtime = 
    {
        common:
        {
            setupPWA: async () => navigator.serviceWorker.register('service-worker.js').catch(err => console.error(err)),
            getUpdateDetails: async () => 
            {
                /*
                var fileUpdates =
                {
                    files: [] as string[]
                }

                self.osManifest.assets.filter((asset: any) => caches.open(cacheName).then(async cache => 
                    {
                        var response: Response | undefined;
                        var contentLength: string | null;
                        response = await cache.match(asset.url);
                        if (response != null)
                        {
                            contentLength = response.headers.get("content-length");
                            if (contentLength != null) fileUpdates.files.push(`{"url":"${response.url}","size":${contentLength}}`);
                        }
                    }));
                */
            },
            performUpdate: async () => 
            {
                /*
                var filesToUpdate = []
                var assetCount = 0;
                var updateSize = 0;
                const filtered = self.osManifest.assets.filter((asset: any) => caches.open(cacheName).then(async cache => 
                        {
                            var response: Response | undefined;
                            var contentLength: string | null;
                            response = await cache.match(asset.url);
                            if (response != null)
                            {
                                contentLength = response.headers.get("content-length");
                                if (contentLength != null) 
                                {
                                    updateSize += parseInt(contentLength);
                                }
                            }
                        }));
                const assetsRequests = self.assetsManifest.assets.map((asset: any) => new Request(asset.url, { integrity: asset.hash, cache: 'no-cache' }))

                await caches.open(cacheName).then(cache => cache.addAll(assetsRequests))
                */
            },
            clearCaches: async () => 
            {

            },
            getOSSize: async () => 
            {
                /*
                var osSize = 0;
                self.osManifest.assets.filter((asset: any) => caches.open(cacheName).then(async cache => 
                    {
                        var response: Response | undefined;
                        var contentLength: string | null;
                        response = await cache.match(asset.url);
                        if (response != null)
                        {
                            contentLength = response.headers.get("content-length");
                            if (contentLength != null) osSize += parseInt(contentLength);
                        }
                    }));
                return osSize;
                */
            }
        },
        uefi:
        {
            setupAssembly: async () => 
            {
                Blazor.disconnect();
                let wasmBootstrapper = document.getElementById('server-js-bootstrapper');
                if (wasmBootstrapper != null && wasmBootstrapper.parentNode != null) 
                {
                    wasmBootstrapper.parentNode.removeChild(wasmBootstrapper);
                    let auth =    document.createElement('script');
                    let wasm =    document.createElement('script');
                    auth.id =     'wasm-js-msip';
                    wasm.id =     'wasm-js-bootstrapper';
                    auth.type =   'text/javascript';
                    wasm.type =   'text/javascript';
                    auth.src =    '/_content/Microsoft.Authentication.WebAssembly.Msal/AuthenticationService.js';
                    wasm.src =    '/_framework/blazor.webassembly.js';
                    window.history.pushState('', '', '/');
                    document.body.appendChild(auth);
                    document.body.appendChild(wasm);
                    window.runtime.common.setupPWA();
                }            
            }
        },
        os:
        {
            setupServer: async () => 
            {
                navigator.serviceWorker.getRegistrations().then((sws) => { for(let sw of sws) sw.unregister(); });
                await Promise.all((await caches.keys()).map(key => caches.delete(key)))
                window.location.reload()
            }
        }
    }
})()