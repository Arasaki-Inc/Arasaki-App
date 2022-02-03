interface Window 
{
    runtime: any
}

class GLOBAL
{
    static JSRuntime: any
    static runtime: any
}

GLOBAL.JSRuntime = null
GLOBAL.runtime = (ref: any) => { if (GLOBAL.JSRuntime === null) GLOBAL.JSRuntime = ref }
(() =>
{
    window.runtime = 
    {

    }
})()