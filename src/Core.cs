using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        bool owner;
        using (var mutex = new Mutex(true, @"Local\CodexDiscordPresence", out owner))
        {
            if (!owner)
            {
                try { using (var signal = EventWaitHandle.OpenExisting(@"Local\CodexPresence.Open")) signal.Set(); }
                catch (WaitHandleCannotBeOpenedException) { }
                return;
            }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            bool background = Array.IndexOf(args, "--background") >= 0;
            bool verify = Array.IndexOf(args, "--verify") >= 0;
            using (var tray = new PresenceTray(background, verify)) Application.Run(tray);
        }
    }
}

internal sealed class PresenceView
{
    public string Details, State, Model, Phase, Connection, FreshLabel, CacheLabel;
    public long StartedAt;
    public bool HasUsage, Paused, ShowModel, Animated, Classic, Startup;
}

internal sealed class PresenceSettings
{
    public bool ShowModel = true, Animated = true, Classic, Paused;
    private static readonly string FilePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "presence-settings.json");

    public static PresenceSettings Load()
    {
        try
        {
            if (new FileInfo(FilePath).Length > 4096) return new PresenceSettings();
            var values = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(File.ReadAllText(FilePath));
            var settings = new PresenceSettings();
            settings.ShowModel = Bool(values, "showModel", true);
            settings.Animated = Bool(values, "animated", true);
            settings.Classic = Bool(values, "classic", false);
            settings.Paused = Bool(values, "paused", false);
            return settings;
        }
        catch (IOException) { return new PresenceSettings(); }
        catch (UnauthorizedAccessException) { return new PresenceSettings(); }
        catch (ArgumentException) { return new PresenceSettings(); }
        catch (InvalidOperationException) { return new PresenceSettings(); }
    }

    public void Save()
    {
        string temporary = FilePath + ".tmp";
        var json = new JavaScriptSerializer().Serialize(new { showModel = ShowModel, animated = Animated, classic = Classic, paused = Paused });
        File.WriteAllText(temporary, json, new UTF8Encoding(false));
        if (File.Exists(FilePath)) File.Replace(temporary, FilePath, null);
        else File.Move(temporary, FilePath);
    }

    private static bool Bool(Dictionary<string, object> values, string key, bool fallback)
    {
        object value;
        return values != null && values.TryGetValue(key, out value) && value is bool ? (bool)value : fallback;
    }
}

internal static class PresenceArtwork
{
    // Artwork only, MIT (c) 2026 SSHdotCodes. See ARTWORK-LICENSE.txt.
    public static string Revision = "386660f2658773c5913f2d0b2a545017d2dcec43";
    private static readonly Dictionary<string, Image> images = new Dictionary<string, Image>();

    public static string Asset(string phase)
    {
        if (phase == "idle" || phase == "success") return "sleeping";
        if (phase == "thinking") return "thinking";
        return "coding";
    }

    public static Image GetImage(string phase)
    {
        string name = Asset(phase);
        Image image;
        if (!images.TryGetValue(name, out image))
        {
            // Image keeps its resource stream alive for animated frames.
            Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name + ".gif");
            image = stream == null ? null : Image.FromStream(stream);
            images.Add(name, image);
        }
        return image;
    }

    public static string Url(string phase)
    {
        return "https://raw.githubusercontent.com/SSHdotCodes/codex-rpc/" + Revision + "/assets/" + Asset(phase) + ".gif";
    }

    public static Icon TrayIcon()
    {
        using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("codex.ico"))
            return new Icon(stream);
    }
}

internal static class PresenceCard
{
    public static string PhaseLabel(string phase)
    {
        switch (phase)
        {
            case "thinking": return "Thinking";
            case "coding": return "Writing code";
            case "reading": return "Reading files";
            case "searching": return "Searching";
            case "running": return "Working";
            case "success": return "Task complete";
            case "error": return "Needs attention";
            default: return "Idle";
        }
    }

    public static string FormatCount(decimal count)
    {
        if (count >= 999950) return (count / 1000000).ToString("0.#", CultureInfo.InvariantCulture) + "m";
        if (count >= 1000) return (count / 1000).ToString("0.#", CultureInfo.InvariantCulture) + "k";
        return count.ToString("0", CultureInfo.InvariantCulture);
    }

    public static PresenceView Compose(ActivitySample sample, PresenceSettings settings, long startedAt)
    {
        var view = new PresenceView
        {
            Phase = sample.Phase, Model = sample.Model, StartedAt = startedAt,
            HasUsage = sample.HasUsage, ShowModel = settings.ShowModel, Animated = settings.Animated,
            Classic = settings.Classic, Paused = settings.Paused, Connection = "Đang kết nối Discord",
            FreshLabel = "Chờ số liệu", CacheLabel = "Lượt xử lý gần nhất"
        };
        if (sample.HasUsage)
        {
            decimal total = (decimal)sample.InputTokens + sample.OutputTokens;
            view.FreshLabel = FormatCount(total - sample.CachedTokens) + " fresh tokens";
            view.CacheLabel = total > 0 ? (100m * sample.CachedTokens / total).ToString("0", CultureInfo.InvariantCulture) + "% from cache" : "0% from cache";
        }
        view.Details = settings.Classic ? view.FreshLabel : PhaseLabel(sample.Phase);
        if (!settings.Classic && settings.ShowModel && !string.IsNullOrEmpty(sample.Model)) view.Details += " · " + sample.Model;
        view.State = settings.Classic ? view.CacheLabel : sample.HasUsage
            ? view.FreshLabel.Replace(" tokens", "") + " · " + view.CacheLabel.Replace("from cache", "cache") : "Ready for your next idea";
        return view;
    }

    public static Dictionary<string, object> Payload(PresenceView view)
    {
        var assets = new Dictionary<string, object>
        {
            { "large_image", view.Animated ? PresenceArtwork.Url(view.Phase) : "codex" },
            { "large_text", PhaseLabel(view.Phase) + " · " + view.FreshLabel + " · " + view.CacheLabel }
        };
        if (view.Animated)
        {
            assets.Add("small_image", "codex");
            assets.Add("small_text", "Codex Desktop");
        }
        return new Dictionary<string, object>
        {
            { "type", 0 }, { "details", view.Details }, { "state", view.State },
            { "timestamps", new { start = view.StartedAt } }, { "assets", assets }
        };
    }
}

internal static class StartupShortcut
{
    private static readonly string LinkPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "Codex Discord Presence.lnk");
    public static bool Enabled()
    {
        if (!File.Exists(LinkPath)) return false;
        object shell = null, link = null;
        try
        {
            shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
            link = shell.GetType().InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { LinkPath });
            string target = (string)link.GetType().InvokeMember("TargetPath", BindingFlags.GetProperty, null, link, null);
            return string.Equals(target, Application.ExecutablePath, StringComparison.OrdinalIgnoreCase);
        }
        catch (COMException) { return false; }
        finally
        {
            if (link != null) Marshal.FinalReleaseComObject(link);
            if (shell != null) Marshal.FinalReleaseComObject(shell);
        }
    }

    public static void Set(bool enabled)
    {
        if (!enabled) { if (Enabled()) File.Delete(LinkPath); return; }
        if (File.Exists(LinkPath) && !Enabled()) throw new IOException("Startup shortcut belongs to another program.");
        object shell = null, link = null;
        try
        {
            shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
            link = shell.GetType().InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { LinkPath });
            link.GetType().InvokeMember("TargetPath", BindingFlags.SetProperty, null, link, new object[] { Application.ExecutablePath });
            link.GetType().InvokeMember("Arguments", BindingFlags.SetProperty, null, link, new object[] { "--background" });
            link.GetType().InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, link, new object[] { AppDomain.CurrentDomain.BaseDirectory });
            link.GetType().InvokeMember("Save", BindingFlags.InvokeMethod, null, link, null);
        }
        finally
        {
            if (link != null) Marshal.FinalReleaseComObject(link);
            if (shell != null) Marshal.FinalReleaseComObject(shell);
        }
    }
}

internal sealed class PresenceTray : ApplicationContext
{
    private readonly PresenceController controller = new PresenceController();
    private readonly CancellationTokenSource stopping = new CancellationTokenSource();
    private readonly EventWaitHandle open = new EventWaitHandle(false, EventResetMode.AutoReset, @"Local\CodexPresence.Open");
    private readonly NotifyIcon tray;
    private readonly System.Windows.Forms.Timer uiTimer;
    private readonly Task worker;
    private PresenceWindow window;
    private bool startup;

    public PresenceTray(bool background, bool verify)
    {
        startup = StartupShortcut.Enabled();
        var menu = new ContextMenu(new[]
        {
            new MenuItem("Mở Codex Presence", (s, e) => ShowWindow()),
            new MenuItem("Tạm dừng / Tiếp tục", (s, e) => Change("paused", !controller.ReadView().Paused)),
            new MenuItem("Thoát", (s, e) => ExitThread())
        });
        tray = new NotifyIcon { Icon = PresenceArtwork.TrayIcon(), Text = "Codex Presence", Visible = true, ContextMenu = menu };
        tray.DoubleClick += (s, e) => ShowWindow();
        uiTimer = new System.Windows.Forms.Timer { Interval = 300 };
        uiTimer.Tick += (s, e) => { if (open.WaitOne(0)) ShowWindow(); };
        uiTimer.Start();
        worker = Task.Run(() => controller.RunAsync(stopping.Token, verify));
        if (!background) ShowWindow();
    }

    private PresenceView ReadView()
    {
        PresenceView view = controller.ReadView();
        view.Startup = startup;
        return view;
    }

    private void ShowWindow()
    {
        if (window == null || window.IsDisposed) window = new PresenceWindow(ReadView, Change);
        window.Show();
        window.WindowState = FormWindowState.Normal;
        window.Activate();
    }

    private void Change(string key, bool value)
    {
        try
        {
            if (key == "startup") { StartupShortcut.Set(value); startup = StartupShortcut.Enabled(); }
            else controller.Change(key, value);
        }
        catch (IOException) { MessageBox.Show("Chưa lưu được cài đặt. Kiểm tra quyền ghi thư mục ứng dụng.", "Codex Presence"); }
        catch (UnauthorizedAccessException) { MessageBox.Show("Windows chưa cho phép lưu cài đặt tại thư mục này.", "Codex Presence"); }
        catch (COMException) { MessageBox.Show("Chưa cập nhật được lối tắt khởi động Windows.", "Codex Presence"); }
    }

    protected override void ExitThreadCore()
    {
        stopping.Cancel();
        try { worker.Wait(2000); } catch (AggregateException) { }
        if (window != null) window.Dispose();
        uiTimer.Dispose();
        tray.Visible = false;
        tray.Icon.Dispose();
        tray.ContextMenu.Dispose();
        tray.Dispose();
        open.Dispose();
        stopping.Dispose();
        base.ExitThreadCore();
    }
}

internal sealed class PresenceController
{
    private readonly object gate = new object();
    private readonly PresenceSettings settings = PresenceSettings.Load();
    private PresenceView view;
    private bool reconnect;
    private static readonly int WindowsSession = Process.GetCurrentProcess().SessionId;

    public PresenceController()
    {
        view = PresenceCard.Compose(new ActivitySample { Phase = "idle", Model = "" }, settings, 0);
        view.Connection = "Chờ mở Codex";
    }

    public PresenceView ReadView()
    {
        lock (gate) return new PresenceView
        {
            Details = view.Details, State = view.State, Phase = view.Phase, Model = view.Model,
            Connection = view.Connection, StartedAt = view.StartedAt, FreshLabel = view.FreshLabel,
            CacheLabel = view.CacheLabel, HasUsage = view.HasUsage,
            Paused = settings.Paused, ShowModel = settings.ShowModel, Animated = settings.Animated, Classic = settings.Classic
        };
    }

    public void Change(string key, bool value)
    {
        lock (gate)
        {
            switch (key)
            {
                case "paused": settings.Paused = value; break;
                case "showModel": settings.ShowModel = value; break;
                case "animated": settings.Animated = value; break;
                case "classic": settings.Classic = value; break;
                case "reconnect": reconnect = true; return;
                default: return;
            }
            settings.Save();
        }
    }

    public async Task RunAsync(CancellationToken stopping, bool verify)
    {
        DiscordConnection discord = null;
        ActivityReader reader = null;
        int windowId = 0;
        DateTimeOffset lastClosed = DateTimeOffset.MinValue;
        long start = 0;
        string previous = null;
        DateTime nextPublish = DateTime.MinValue;
        DateTime retryAt = DateTime.MinValue;
        int failures = 0;
        try
        {
            while (!stopping.IsCancellationRequested)
            {
                DateTimeOffset processStart;
                int currentWindow = FindWindow(out processStart);
                bool force, paused;
                lock (gate) { force = reconnect; reconnect = false; paused = settings.Paused; }
                if (currentWindow != windowId || paused || force)
                {
                    if (discord != null) { await discord.ClearAsync(); discord.Dispose(); discord = null; }
                    previous = null;
                    retryAt = DateTime.MinValue;
                    if (currentWindow == 0) { reader = null; start = 0; }
                    else if (currentWindow != windowId)
                    {
                        DateTimeOffset opened = processStart < lastClosed ? DateTimeOffset.UtcNow : processStart;
                        start = opened.ToUnixTimeSeconds();
                        reader = new ActivityReader(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".codex", "sessions"), opened);
                    }
                }
                windowId = currentWindow;
                if (windowId == 0) lastClosed = DateTimeOffset.UtcNow;
                ActivitySample sample = reader == null ? new ActivitySample { Phase = "idle", Model = "" } : reader.ReadLatest();
                PresenceView desired;
                lock (gate)
                {
                    desired = PresenceCard.Compose(sample, settings, start);
                    desired.Connection = paused ? "Đã tạm dừng chia sẻ" : windowId == 0 ? "Chờ mở Codex" : view.Connection;
                    view = desired;
                }

                if (windowId != 0 && !paused && DateTime.UtcNow >= retryAt)
                {
                    string fingerprint = new JavaScriptSerializer().Serialize(PresenceCard.Payload(desired));
                    try
                    {
                        if (discord == null || discord.Closed.IsCompleted)
                        {
                            if (discord != null) discord.Dispose();
                            lock (gate) view.Connection = "Đang kết nối Discord";
                            discord = await DiscordConnection.OpenAsync(stopping);
                            previous = null;
                            nextPublish = DateTime.MinValue;
                        }
                        lock (gate) paused = settings.Paused;
                        if (paused)
                        {
                            await discord.ClearAsync();
                            discord.Dispose();
                            discord = null;
                            previous = null;
                            lock (gate) view.Connection = "Đã tạm dừng chia sẻ";
                        }
                        else if (fingerprint != previous && DateTime.UtcNow >= nextPublish)
                        {
                            Dictionary<string, object> receipt = await discord.PublishAsync(PresenceCard.Payload(desired), stopping);
                            previous = fingerprint;
                            nextPublish = DateTime.UtcNow.AddSeconds(6);
                            failures = 0;
                            lock (gate) view.Connection = "Đã kết nối Discord";
                            if (verify)
                            {
                                WriteReceipt(receipt);
                                verify = false;
                            }
                        }
                    }
                    catch (IOException) { failures++; }
                    catch (TimeoutException) { failures++; }
                    catch (UnauthorizedAccessException) { failures++; }
                    if (failures > 0)
                    {
                        if (discord != null) discord.Dispose();
                        discord = null;
                        retryAt = DateTime.UtcNow.AddSeconds(Math.Min(30, failures * 3));
                        lock (gate) view.Connection = "Chờ Discord desktop · đang thử lại";
                    }
                }
                await Task.Delay(1500, stopping);
            }
        }
        catch (OperationCanceledException) { }
        finally { if (discord != null) { discord.ClearAsync().GetAwaiter().GetResult(); discord.Dispose(); } }
    }

    private static void WriteReceipt(Dictionary<string, object> receipt)
    {
        // Fixed diagnostic path. No user-supplied output path is accepted.
        var assets = DiscordConnection.Field(receipt, "assets") as Dictionary<string, object>;
        var timestamps = DiscordConnection.Field(receipt, "timestamps") as Dictionary<string, object>;
        var safe = new { acknowledged = true, name = DiscordConnection.Field(receipt, "name"),
            details = DiscordConnection.Field(receipt, "details"), state = DiscordConnection.Field(receipt, "state"),
            image = DiscordConnection.Field(assets, "large_image"), start = DiscordConnection.Field(timestamps, "start") };
        File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "presence-verification.json"), new JavaScriptSerializer().Serialize(safe));
    }

    private static int FindWindow(out DateTimeOffset opened)
    {
        opened = DateTimeOffset.MaxValue;
        int id = 0;
        string prefix = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "WindowsApps", "OpenAI.Codex_");
        foreach (var process in Process.GetProcessesByName("ChatGPT"))
        {
            using (process)
            {
                try
                {
                    if (process.SessionId != WindowsSession || process.MainWindowHandle == IntPtr.Zero) continue;
                    ProcessModule module = process.MainModule;
                    if (module == null || !module.FileName.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) continue;
                    DateTimeOffset started = process.StartTime;
                    if (started < opened) { opened = started; id = process.Id; }
                }
                catch (Win32Exception) { }
                catch (InvalidOperationException) { }
            }
        }
        return id;
    }
}
