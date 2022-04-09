using Microsoft.JSInterop;

namespace Arasaki.OS.Data;

public class JSInterop
{
    public static IJSRuntime JSR { get; private set; }

    public void SetJSRuntime(IJSRuntime runtime) => JSR = runtime;

    public class RuntimeInterop
    {
        public async Task SetupServer() => await JSR.InvokeVoidAsync("runtime.os.setupServer");
    }
}
