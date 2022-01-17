public static class References
{
    public static string YearVersion { get; set; } = "2022";
    public static string MonthVersion { get; set; } = "01";
    public static string DayVersion { get; set; } = "01";
    public static string IterationVersion { get; set; } = "a";
    public static string VersionString { get { return YearVersion + "." + MonthVersion + "." + DayVersion + IterationVersion; } }
    public static bool IsDevelopmentMode { get; set; } = false;
}
