interface Window 
{
    runtime: any,
    ui: any
}

var GLOBAL: any = 
{
    JSRuntime:  null,
    JSUI:       null,
    runtime:    (ref: any) => { if (GLOBAL.JSRuntime === null) GLOBAL.JSRuntime = ref },
    ui:         (ref: any) => { if (GLOBAL.JSUI === null) GLOBAL.JSUI = ref }
}