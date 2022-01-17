using System.Runtime.InteropServices;

public static class Runtime
{
    public static bool IsMono => RuntimeInformation.FrameworkDescription.Contains("Mono");

    public static bool IsWASM => RuntimeInformation.OSDescription.Contains("Browser");
}