using System.Globalization;
using System.Reflection;
using System.Runtime.InteropServices;

public static class Runtime
{
    public static Assembly RuntimeAssembly { get => Assembly.GetCallingAssembly(); }
    public static Assembly LibraryAssembly { get => Assembly.GetExecutingAssembly(); }

    public static bool IsMono => RuntimeInformation.FrameworkDescription.Contains("Mono");
    public static bool IsWASM => RuntimeInformation.OSDescription.Contains("Browser");
#if DEBUG
    public static bool IsDevelopmentMode { get; } = true;
#else
    public static bool IsDevelopmentMode { get; } = false;
#endif

    public static DateTime RuntimeBuildDate
    {
        get
        {
            const string BuildVersionMetadataPrefix = "+build";
            AssemblyInformationalVersionAttribute attribute = RuntimeAssembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>();
            if (attribute?.InformationalVersion != null)
            {
                string value = attribute.InformationalVersion;
                int index = value.IndexOf(BuildVersionMetadataPrefix);
                if (index > 0 && DateTime.TryParseExact(value[(index + BuildVersionMetadataPrefix.Length)..], "yyyyMMddHHmmss", CultureInfo.InvariantCulture, DateTimeStyles.None, out var result)) return result;
            }
            return default;
        }
    }

    public static long Version
    {
        get => long.Parse(RuntimeBuildDate.Year + string.Empty + RuntimeBuildDate.Month + string.Empty + RuntimeBuildDate.Day + string.Empty + RuntimeBuildDate.Hour + string.Empty +
        RuntimeBuildDate.Minute + string.Empty + RuntimeBuildDate.Second);
    }
}
