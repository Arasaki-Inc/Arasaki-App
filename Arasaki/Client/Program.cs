using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Authentication;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

using Arasaki.Client;
using Arasaki.Client.Data.Authentication;

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
HostBuilder.Services.AddAuthorizationCore(o =>
{
    o.AddPolicy("UserIsAdmin", policy => policy.Requirements.Add(new UserGroupsRequirement(new string[] { "Admins" })));
});
HostBuilder.Services.AddSingleton<IAuthorizationHandler, UserGroupsHandler>();
Host = HostBuilder.Build();
Services.SetServiceProvider(Host.Services);
await Host.RunAsync();