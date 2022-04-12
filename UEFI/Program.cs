using System.IO.Compression;
using Arasaki.UEFI.Data;
using Arasaki.UEFI.Data.States;
using Microsoft.ApplicationInsights.AspNetCore.Extensions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Identity.Web;
using Serilog;

Logger.Initialise(new LoggerConfiguration().WriteTo.Console(outputTemplate: Logger.DefaultLogFormat).CreateLogger());

WebApplicationBuilder builder;
Services.SetConfiguration((builder = WebApplication.CreateBuilder(args)).Configuration);
if (string.IsNullOrWhiteSpace(builder.Environment.WebRootPath)) builder.Environment.WebRootPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");

builder.WebHost.UseKestrel(o =>
{
    o.AddServerHeader = false;
});
builder.WebHost.ConfigureKestrel(o => 
{
#if DEBUG
    o.ListenAnyIP(7107, lo =>
#else
    o.ListenAnyIP(8080, lo =>
#endif
    {
        lo.Protocols = HttpProtocols.Http1AndHttp2AndHttp3;
        lo.UseHttps();
    });
});
#if DEBUG
builder.Services.AddApplicationInsightsTelemetry(new ApplicationInsightsServiceOptions { ConnectionString = "00000000-0000-0000-0000-000000000000" });
#else
builder.Services.AddApplicationInsightsTelemetry(new ApplicationInsightsServiceOptions { ConnectionString = Services.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"] });
#endif
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAdB2C"));
builder.Services.AddControllersWithViews();
builder.Services.AddAntiforgery();
builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor();
builder.Services.AddResponseCaching();
builder.Services.AddResponseCompression(o =>
{
    o.EnableForHttps = true;
    o.Providers.Add<BrotliCompressionProvider>();
    o.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[] { "image/svg+xml"});
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Optimal);

builder.Services.AddSingleton<JSInterop>();
builder.Services.AddSingleton<JSInterop.RuntimeInterop>();
builder.Services.AddSingleton<JSInterop.UIInterop>();
builder.Services.AddSingleton<UIState>();

WebApplication app = builder.Build();
Services.SetServiceProvider(app.Services.CreateScope().ServiceProvider);

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseWebAssemblyDebugging();
}
else
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}
app.UseBlazorFrameworkFiles();
app.UseStaticFiles();
app.UseRouting();
WebSocketOptions webSocketOptions = new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromMinutes(2)
};

#if DEBUG
webSocketOptions.AllowedOrigins.Add("https://localhost:7107");
webSocketOptions.AllowedOrigins.Add("https://www.localhost:7107");
#else
webSocketOptions.AllowedOrigins.Add("https://arasaki.xyz");
webSocketOptions.AllowedOrigins.Add("https://www.arasaki.xyz");
#endif

app.UseResponseCaching();
app.UseResponseCompression();
app.UseWebSockets(webSocketOptions);
app.UseAuthentication();
app.UseAuthorization();
app.MapRazorPages();
app.MapControllers();
app.MapBlazorHub();
app.MapFallbackToPage("/_Host");
await app.RunAsync();
