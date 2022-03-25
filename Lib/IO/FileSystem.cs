using System.Runtime.InteropServices;

namespace UEESA.IO
{
    public static class FileSystem
    {
        public static DirectoryInfo ApplicationDirectory { get; }
        public static DirectoryInfo AppDataDirectory { get; }

        static FileSystem()
        {
            ApplicationDirectory = new(AppDomain.CurrentDomain.BaseDirectory);
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) AppDataDirectory = new(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData));
            else RuntimeInformation.IsOSPlatform(OSPlatform.Linux);
        }

        public static void Create(FileInfo info)
        {
            if (info == null) throw new ArgumentNullException(nameof(info));
            File.Create(info.FullName).Dispose();
        }

        public static void Create(DirectoryInfo info)
        {
            if (info == null) throw new ArgumentNullException(nameof(info));
            Directory.CreateDirectory(info.FullName);
        }

        public static void Delete(FileInfo info)
        {
            if (info == null) throw new ArgumentNullException(nameof(info));
            File.Delete(info.FullName);
        }

        public static void Delete(DirectoryInfo info)
        {
            if (info == null) throw new ArgumentNullException(nameof(info));
            Directory.Delete(info.FullName);
        }

        public static void Move(FileInfo from, FileInfo to)
        {
            if (from == null) throw new ArgumentNullException(nameof(from));
            if (to == null) throw new ArgumentNullException(nameof(to));
            File.Move(from.FullName, to.FullName);
        }

        public static void Move(DirectoryInfo from, DirectoryInfo to)
        {
            if (from == null) throw new ArgumentNullException(nameof(from));
            if (to == null) throw new ArgumentNullException(nameof(to));
            Directory.Move(from.FullName, to.FullName);
        }

        public static void Copy(FileInfo from, FileInfo to, bool overwrite = false)
        {
            if (from == null) throw new ArgumentNullException(nameof(from));
            if (to == null) throw new ArgumentNullException(nameof(to));
            File.Copy(from.FullName, to.FullName, overwrite);
        }

        public static void Copy(DirectoryInfo from, DirectoryInfo to, bool overwrite = false)
        {
            if (from == null) throw new ArgumentNullException(nameof(from));
            if (to == null) throw new ArgumentNullException(nameof(to));
            string[] directories = Directory.GetDirectories(from.FullName, "*.*", SearchOption.AllDirectories);
            for (int i = 0; i < directories.Length; i++) Directory.CreateDirectory(directories[i].Replace(from.FullName, to.FullName));
            directories = Directory.GetFiles(from.FullName, "*.*", SearchOption.AllDirectories);
            foreach (string obj in directories) File.Copy(obj, obj.Replace(from.FullName, to.FullName), overwrite);
        }

        public static void Cut(FileInfo from, FileInfo to, bool overwrite = false)
        {
            if (from == null) throw new ArgumentNullException(nameof(from));
            if (to == null) throw new ArgumentNullException(nameof(to));
            File.Copy(from.FullName, to.FullName, overwrite);
            File.Delete(from.FullName);
        }

        public static void Cut(DirectoryInfo from, DirectoryInfo to, bool overwrite = false)
        {
            if (from == null) throw new ArgumentNullException(nameof(from));
            if (to == null) throw new ArgumentNullException(nameof(to));
            string[] directories = Directory.GetDirectories(from.FullName, "*.*", SearchOption.AllDirectories);
            for (int i = 0; i < directories.Length; i++) Directory.CreateDirectory(directories[i].Replace(from.FullName, to.FullName));
            directories = Directory.GetFiles(from.FullName, "*.*", SearchOption.AllDirectories);
            foreach (string obj in directories) File.Copy(obj, obj.Replace(from.FullName, to.FullName), overwrite);
            directories = Directory.GetFiles(from.FullName, "*.*", SearchOption.AllDirectories);
            for (int i = 0; i < directories.Length; i++) File.Delete(directories[i]);
            directories = Directory.GetDirectories(from.FullName, "*.*", SearchOption.AllDirectories);
            for (int i = 0; i < directories.Length; i++) Directory.Delete(directories[i]);
        }

        public static bool Exists(FileInfo info)
        {
            if (info == null) throw new ArgumentNullException(nameof(info));
            return File.Exists(info.FullName);
        }

        public static bool Exists(DirectoryInfo info)
        {
            if (info == null) throw new ArgumentNullException(nameof(info));
            return Directory.Exists(info.FullName);
        }
    }
}
