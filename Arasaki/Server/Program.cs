using System.IO.Compression;

using Microsoft.ApplicationInsights.AspNetCore.Extensions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Identity.Web;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
#if DEBUG
builder.Services.AddApplicationInsightsTelemetry(new ApplicationInsightsServiceOptions { ConnectionString = "00000000-0000-0000-0000-000000000000" });
#else
builder.Services.AddApplicationInsightsTelemetry(new ApplicationInsightsServiceOptions { ConnectionString = Services.Configuration["APPINSIGHTS_CONNECTIONSTRING"] });
#endif
//builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));
builder.Services.AddControllersWithViews();
builder.Services.AddRazorPages();
builder.Services.AddApplicationInsightsTelemetry(builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"]);
builder.Services.AddResponseCaching();
builder.Services.AddResponseCompression(options =>
{
    options.Providers.Add<BrotliCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[] { "image/svg+xml" });
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.SmallestSize);

WebApplication app = builder.Build();
Services.SetServiceProvider(app.Services.CreateScope().ServiceProvider);
References.IsDevelopmentMode = app.Environment.IsDevelopment();

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
app.UseAuthentication();
app.UseAuthorization();
app.UseResponseCaching();
app.UseResponseCompression();
app.MapRazorPages();
app.MapControllers();
app.MapFallbackToFile("index.html");
if (References.IsDevelopmentMode) await app.RunAsync("https://0.0.0.0:7107");
else await app.RunAsync();
