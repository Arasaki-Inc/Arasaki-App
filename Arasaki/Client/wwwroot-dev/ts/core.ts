interface Window 
{
    runtime: any;
}

var GLOBAL: any
GLOBAL.JSRuntime = null
GLOBAL.runtime = (ref: any) => { if (GLOBAL.JSRuntime === null) GLOBAL.JSRuntime = ref }
(() =>
{
    window.runtime = 
    {

    }
})()