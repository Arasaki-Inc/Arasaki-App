namespace Arasaki.Server.Data;

using Microsoft.JSInterop;

public class JSInterop
{
    public async Task InitialiseJSDotNetRuntimeReferences<T>(IJSRuntime jsr, T tiedObject, string functionName) where T : class => await jsr.InvokeVoidAsync("GLOBAL." + functionName, DotNetObjectReference.Create(tiedObject));

    public class RuntimeInterop
    {
        public async Task<bool> IsMobileScreen(IJSRuntime jsr) => await jsr.InvokeAsync<bool>("runtime.isMobileScreen");
    }

    public class UIInterop
    {

    }
}
