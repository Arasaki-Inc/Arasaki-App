using Microsoft.JSInterop;

namespace Arasaki.UEFI.Data;

public class JSInterop
{
    public static IJSRuntime JSR { get; private set; }

    public void SetJSRuntime(IJSRuntime runtime) => JSR = runtime;

    public class RuntimeInterop
    {
        public async Task SetupPWA() => await JSR.InvokeVoidAsync("runtime.common.setupPWA");
        public async Task ListenForUpdate() => await JSR.InvokeVoidAsync("runtime.common.listenForUpdate");
        public async Task SetupAssembly() => await JSR.InvokeVoidAsync("runtime.uefi.setupAssembly");
    }

    public class UIInterop
    {
        public async Task<bool> IsMobileScreen() => await JSR.InvokeAsync<bool>("ui.common.isMobileScreen");
        public async Task<bool> IsTabletScreen() => await JSR.InvokeAsync<bool>("ui.common.isTabletScreen");
    }
}
