interface Window 
{
    runtime: any;
}

var Blazor: any
var GLOBAL: any

function setupAssembly() 
{
    let server = document.getElementById('blazorScript')
    server?.parentNode?.removeChild(server)
    let auth = document.createElement('script')
    auth.type = 'text/javascript'
    auth.src = '_content/Microsoft.Authentication.WebAssembly.Msal/AuthenticationService.js'
    document.body.appendChild(auth)
    let wasm = document.createElement('script')
    wasm.type = 'text/javascript'
    wasm.src = '_framework/blazor.webassembly.js'
    document.body.appendChild(wasm)

    GLOBAL.JSRuntime = null
    GLOBAL.runtime = (ref: any) => { if (GLOBAL.JSRuntime === null) GLOBAL.JSRuntime = ref }
    (() =>
    {
        window.runtime = 
        {

        }
    })()
}