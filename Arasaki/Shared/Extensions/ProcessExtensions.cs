using System.Diagnostics;

public static class ProcessExtensions
{
    public static Task WaitForExitAsync(this Process process, CancellationToken cancellationToken = default)
    {
        if (process == null) throw new ArgumentNullException(nameof(process));
        TaskCompletionSource<object> tcs = new();
        process.EnableRaisingEvents = true;
        process.Exited += delegate { tcs.TrySetResult(null); };
        if (cancellationToken != default) cancellationToken.Register(new Action(tcs.SetCanceled));
        return tcs.Task;
    }

    public static void RestartSync(this Process process, bool force = false)
    {
        if (process == null) throw new ArgumentNullException(nameof(process));
        if (force) process.Kill();
        else
        {
            process.StandardInput.Write("exit");
            process.WaitForExit();
        }
        process.Start();
    }

    public static async Task RestartAsync(this Process process, bool force = false)
    {
        if (process == null) throw new ArgumentNullException(nameof(process));
        if (!force)
        {
            await process.StandardInput.WriteAsync("exit").ConfigureAwait(continueOnCapturedContext: false);
            await process.WaitForExitAsync().ConfigureAwait(continueOnCapturedContext: false);
        }
        else process.Kill();
        process.Start();
    }

    public static void StartThenWaitSync(this Process process, string arguments = null)
    {
        if (process == null) throw new ArgumentNullException(nameof(process));
        if (arguments != null) process.StartInfo.Arguments = "/C " + arguments;
        process.Start();
        process.WaitForExit();
    }

    public static async Task StartThenWaitAsync(this Process process, string arguments = null)
    {
        if (process == null) throw new ArgumentNullException(nameof(process));
        if (arguments != null) process.StartInfo.Arguments = "/C " + arguments;
        process.Start();
        await process.WaitForExitAsync().ConfigureAwait(continueOnCapturedContext: false);
    }

    public static void StartThenWaitRefreshSync(this Process process, string arguments = null)
    {
        if (process == null) throw new ArgumentNullException(nameof(process));
        if (arguments != null) process.StartInfo.Arguments = "/C " + arguments;
        process.Start();
        process.WaitForExit();
        process.Refresh();
    }

    public static async Task StartThenWaitRefreshAsync(this Process process, string arguments = null)
    {
        if (process == null) throw new ArgumentNullException(nameof(process));
        if (arguments != null) process.StartInfo.Arguments = "/C " + arguments;
        process.Start();
        await process.WaitForExitAsync().ConfigureAwait(continueOnCapturedContext: false);
        process.Refresh();
    }

    public static void StartThenWaitDisposeSync(this Process process, string arguments = null)
    {
        if (process == null) throw new ArgumentNullException(nameof(process));
        if (arguments != null) process.StartInfo.Arguments = "/C " + arguments;
        process.Start();
        process.WaitForExit();
        process.Dispose();
    }

    public static async Task StartThenWaitDisposeAsync(this Process process, string arguments = null)
    {
        if (process == null) throw new ArgumentNullException(nameof(process));
        if (arguments != null) process.StartInfo.Arguments = "/C " + arguments;
        process.Start();
        await process.WaitForExitAsync().ConfigureAwait(continueOnCapturedContext: false);
        process.Dispose();
    }
}
