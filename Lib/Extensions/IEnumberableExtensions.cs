public static class IEnumberableExtensions
{
    public static bool Contains(this IEnumerable<FileInfo> enumerable, string lookingFor)
    {
        if (enumerable == null) throw new ArgumentNullException(nameof(enumerable));
        if (lookingFor == null) throw new ArgumentNullException(nameof(lookingFor));
        foreach (FileInfo item in enumerable) if (item.Name == lookingFor) return true;
        return false;
    }

    public static IEnumerable<T> Append<T>(this IEnumerable<T> enumerable, IEnumerable<T> appending)
    {
        if (enumerable == null) throw new ArgumentNullException(nameof(enumerable));
        if (appending == null) throw new ArgumentNullException(nameof(appending));
        foreach (T item in appending) appending = appending.Append(item);
        return enumerable.Distinct();
    }
}
