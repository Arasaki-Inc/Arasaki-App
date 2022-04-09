using System.Net.WebSockets;
using Arasaki.OS;
using Arasaki.OS.Data;
using Arasaki.OS.Data.Authentication;
using Arasaki.Sockets;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Authentication;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Serilog;

Logger.Initialise(new LoggerConfiguration().WriteTo.Console(outputTemplate: Logger.DefaultLogFormat).CreateLogger());

WebAssemblyHost host;
WebAssemblyHostBuilder builder = WebAssemblyHostBuilder.CreateDefault(args);
Services.SetConfiguration(builder.Configuration);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");
builder.Services.AddHttpClient("Arasaki.UEFIAPI", client => client.BaseAddress = new Uri(builder.HostEnvironment.BaseAddress)).AddHttpMessageHandler<BaseAddressAuthorizationMessageHandler>();
builder.Services.AddScoped(sp => sp.GetRequiredService<IHttpClientFactory>().CreateClient("Arasaki.UEFIAPI"));
builder.Services.AddMsalAuthentication(o =>
{
    builder.Configuration.Bind("AzureAdB2C", o.ProviderOptions.Authentication);
    o.ProviderOptions.DefaultAccessTokenScopes.Add("https://arasakiB2C.onmicrosoft.com/6a29b831-2d5a-4421-9c7d-4905f3c3e9e2/API.Access");
});
builder.Services.AddAuthorizationCore(o =>
{
    o.AddPolicy("UserIsAdmin", policy => policy.Requirements.Add(new UserGroupsRequirement(new string[] { "Admins" })));
});
builder.Services.AddSingleton<IAuthorizationHandler, UserGroupsHandler>();
builder.Services.AddSingleton<JSInterop>();
builder.Services.AddSingleton<JSInterop.RuntimeInterop>();
builder.Services.AddSingleton<ArasakiSocket<ClientWebSocket>>(new ArasakiSocket<ClientWebSocket>(new ClientWebSocket()));
host = builder.Build();
Services.SetServiceProvider(host.Services);
await host.RunAsync();
