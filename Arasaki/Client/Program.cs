using Arasaki.Client;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Authentication;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

using Serilog;

Logger.Initialise(new LoggerConfiguration().WriteTo.Console(outputTemplate: Logger.DefaultLogFormat).CreateLogger());

WebAssemblyHost Host;
WebAssemblyHostBuilder HostBuilder = WebAssemblyHostBuilder.CreateDefault(args);
Services.SetConfiguration(HostBuilder.Configuration);
HostBuilder.RootComponents.Add<App>("#app");
HostBuilder.RootComponents.Add<HeadOutlet>("head::after");
HostBuilder.Services.AddHttpClient("Arasaki.ServerAPI", client => client.BaseAddress = new Uri(HostBuilder.HostEnvironment.BaseAddress)).AddHttpMessageHandler<BaseAddressAuthorizationMessageHandler>();
HostBuilder.Services.AddScoped(sp => sp.GetRequiredService<IHttpClientFactory>().CreateClient("Arasaki.ServerAPI"));
HostBuilder.Services.AddMsalAuthentication(options =>
{
    HostBuilder.Configuration.Bind("AzureAd", options.ProviderOptions.Authentication);
    options.ProviderOptions.DefaultAccessTokenScopes.Add("api://api.id.uri/access_as_user");
});
await HostBuilder.Build().RunAsync();