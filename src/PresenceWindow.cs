using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Windows.Forms;

internal static class PresenceTheme
{
    public static readonly Color Background = Color.FromArgb(24, 24, 24);
    public static readonly Color Sidebar = Color.FromArgb(18, 18, 18);
    public static readonly Color Surface = Color.FromArgb(33, 33, 33);
    public static readonly Color Hover = Color.FromArgb(42, 42, 42);
    public static readonly Color Pressed = Color.FromArgb(52, 52, 52);
    public static readonly Color Selected = Color.FromArgb(33, 33, 33);
    public static readonly Color Foreground = Color.FromArgb(223, 223, 223);
    public static readonly Color Muted = Color.FromArgb(140, 140, 140);
    public static readonly Color Secondary = Color.FromArgb(186, 186, 186);
    public static readonly Color Border = Color.FromArgb(42, 42, 42);
    public static readonly Color Focus = Color.FromArgb(186, 186, 186);
    public static readonly Color Green = Color.FromArgb(101, 190, 148);
    public const string FontFamily = "Segoe UI";
}

internal sealed class PresenceWindow : Form
{
    private readonly Func<PresenceView> readView;
    private readonly Action<string, bool> changeSetting;
    private readonly System.Windows.Forms.Timer refreshTimer;
    private readonly Panel readingColumn;
    private readonly Panel overview;
    private readonly Panel appearance;
    private readonly NavigationButton overviewNav;
    private readonly NavigationButton appearanceNav;
    private readonly Label breadcrumb;
    private readonly Label title;
    private readonly Label subtitle;
    private readonly Label connection;
    private readonly StatusDot statusDot;
    private readonly Label details;
    private readonly Label state;
    private readonly Label elapsed;
    private readonly Label previewStatus;
    private readonly Label pausedNotice;
    private readonly Label freshValue;
    private readonly Label cacheValue;
    private readonly Label modelValue;
    private readonly PictureBox artwork;
    private readonly TerminalTile fallbackArtwork;
    private readonly SettingSwitch modelSwitch;
    private readonly SettingSwitch animationSwitch;
    private readonly SettingSwitch classicSwitch;
    private readonly SettingSwitch startupSwitch;
    private readonly Button pauseButton;
    private bool refreshing;
    private bool settingsSelected;

    public PresenceWindow(Func<PresenceView> readView, Action<string, bool> changeSetting)
    {
        SuspendLayout();
        this.readView = readView;
        this.changeSetting = changeSetting;
        Text = "Codex Presence";
        Icon = PresenceArtwork.TrayIcon();
        AccessibleName = Text;
        ClientSize = new Size(960, 620);
        MinimumSize = new Size(896, 639);
        BackColor = PresenceTheme.Background;
        ForeColor = PresenceTheme.Foreground;
        Font = new Font(PresenceTheme.FontFamily, 10F);
        AutoScaleDimensions = new SizeF(96F, 96F);
        AutoScaleMode = AutoScaleMode.Dpi;
        StartPosition = FormStartPosition.CenterScreen;
        DoubleBuffered = true;

        var main = new Panel { Dock = DockStyle.Fill, BackColor = PresenceTheme.Background };
        var sidebar = new Panel { Dock = DockStyle.Left, Width = 200, BackColor = PresenceTheme.Sidebar };
        Controls.Add(main);
        Controls.Add(sidebar);
        readingColumn = new Panel { Location = new Point(32, 0), Size = new Size(696, 620),
            BackColor = PresenceTheme.Background };
        main.Controls.Add(readingColumn);
        sidebar.Controls.Add(new TerminalTile { Location = new Point(20, 25), Size = new Size(23, 23) });
        AddLabel(sidebar, "Codex Presence", 52, 24, 140, 24, 10.5F, PresenceTheme.Foreground, FontStyle.Bold);
        overviewNav = new NavigationButton("Tổng quan", "overview") { Location = new Point(12, 87), Size = new Size(176, 38) };
        appearanceNav = new NavigationButton("Hiển thị", "appearance") { Location = new Point(12, 131), Size = new Size(176, 38) };
        overviewNav.Click += (sender, args) => SelectPage(false);
        appearanceNav.Click += (sender, args) => SelectPage(true);
        sidebar.Controls.Add(overviewNav);
        sidebar.Controls.Add(appearanceNav);

        var sidebarBottom = new Panel { Dock = DockStyle.Bottom, Height = 77, BackColor = PresenceTheme.Sidebar };
        sidebar.Controls.Add(sidebarBottom);
        statusDot = new StatusDot { Location = new Point(22, 27), Size = new Size(8, 8) };
        sidebarBottom.Controls.Add(statusDot);
        connection = AddLabel(sidebarBottom, "Đang kết nối Discord", 40, 18, 142, 42, 8.5F, PresenceTheme.Muted);
        connection.AutoEllipsis = false;

        breadcrumb = AddLabel(readingColumn, "Presence", 0, 24, 696, 22, 9F, PresenceTheme.Muted);
        title = AddLabel(readingColumn, "Hoạt động Codex", 0, 64, 696, 32, 17F, PresenceTheme.Foreground, FontStyle.Bold);
        subtitle = AddLabel(readingColumn, "Xem trước thẻ hoạt động trên Discord.", 0, 104, 696, 24, 9.5F, PresenceTheme.Secondary);
        breadcrumb.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
        title.Anchor = subtitle.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;

        var footer = new Panel { Dock = DockStyle.Bottom, Height = 96, BackColor = PresenceTheme.Background };
        readingColumn.Controls.Add(footer);
        AddDivider(footer, 0, 0, 696);
        var footerHint = AddLabel(footer, "Trên thẻ Discord: trạng thái, model, token và thời gian", 0, 12, 696, 24, 9F, PresenceTheme.Secondary);
        footerHint.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
        pauseButton = new RoundedButton { Text = "Tạm dừng", Location = new Point(0, 48), Size = new Size(160, 36), Primary = true };
        pauseButton.Click += (sender, args) => { changeSetting("paused", !readView().Paused); RefreshView(); };
        footer.Controls.Add(pauseButton);
        var reconnect = new RoundedButton { Text = "Kết nối lại Discord", Location = new Point(516, 48), Size = new Size(180, 36) };
        reconnect.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        reconnect.Click += (sender, args) => changeSetting("reconnect", true);
        footer.Controls.Add(reconnect);

        overview = new Panel { Location = new Point(0, 148), Size = new Size(696, 320),
            Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right,
            BackColor = PresenceTheme.Background };
        readingColumn.Controls.Add(overview);
        var preview = new RoundedSurface { Location = new Point(0, 0), Size = new Size(696, 192), CornerRadius = 12,
            BackColor = PresenceTheme.Surface, BorderColor = PresenceTheme.Border,
            Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right };
        overview.Controls.Add(preview);
        AddLabel(preview, "Thẻ Discord", 24, 16, 300, 20, 9F, PresenceTheme.Secondary);
        previewStatus = AddLabel(preview, "Chưa kết nối", 472, 16, 200, 20, 9F, PresenceTheme.Secondary);
        previewStatus.TextAlign = ContentAlignment.MiddleRight;
        previewStatus.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        fallbackArtwork = new TerminalTile { Location = new Point(24, 54), Size = new Size(96, 96) };
        preview.Controls.Add(fallbackArtwork);
        artwork = new PictureBox { Location = fallbackArtwork.Location, Size = fallbackArtwork.Size,
            SizeMode = PictureBoxSizeMode.Zoom, BackColor = PresenceTheme.Surface,
            AccessibleName = "Ảnh trạng thái Codex", Visible = false, TabStop = false };
        preview.Controls.Add(artwork);
        AddLabel(preview, "Codex", 140, 48, 500, 27, 13F, PresenceTheme.Foreground, FontStyle.Bold);
        details = AddLabel(preview, "Đang chờ Codex", 140, 80, 530, 25, 10.5F, PresenceTheme.Foreground);
        state = AddLabel(preview, String.Empty, 140, 108, 530, 23, 9.5F, PresenceTheme.Secondary);
        elapsed = AddLabel(preview, "00:00:00", 140, 141, 530, 23, 9.5F, PresenceTheme.Secondary);
        details.Anchor = state.Anchor = elapsed.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
        pausedNotice = AddLabel(preview, "Đã tạm dừng chia sẻ", 140, 141, 530, 23, 9.5F, PresenceTheme.Muted);
        pausedNotice.Visible = false;
        pausedNotice.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;

        AddLabel(overview, "Model hiện tại", 0, 212, 160, 24, 9F, PresenceTheme.Secondary);
        modelValue = AddLabel(overview, "Chờ phiên Codex", 176, 212, 520, 24, 9.5F, PresenceTheme.Foreground);
        modelValue.TextAlign = ContentAlignment.MiddleRight;
        modelValue.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
        AddDivider(overview, 0, 248, 696);
        AddLabel(overview, "Lượt xử lý gần nhất", 0, 260, 400, 24, 9F, PresenceTheme.Secondary);
        var stats = new TableLayoutPanel { Location = new Point(0, 288), Size = new Size(696, 28),
            ColumnCount = 2, RowCount = 1, BackColor = PresenceTheme.Background,
            Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right, Margin = Padding.Empty, Padding = Padding.Empty };
        stats.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        stats.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        overview.Controls.Add(stats);
        var fresh = new Panel { Dock = DockStyle.Fill, Margin = new Padding(0, 0, 24, 0), BackColor = PresenceTheme.Background };
        var cache = new Panel { Dock = DockStyle.Fill, Margin = Padding.Empty, BackColor = PresenceTheme.Background };
        stats.Controls.Add(fresh, 0, 0);
        stats.Controls.Add(cache, 1, 0);
        AddLabel(fresh, "Token mới", 0, 0, 152, 28, 9.5F, PresenceTheme.Secondary);
        AddLabel(cache, "Từ cache", 0, 0, 152, 28, 9.5F, PresenceTheme.Secondary);
        freshValue = AddLabel(fresh, "—", 152, 0, 172, 28, 11F, PresenceTheme.Foreground);
        cacheValue = AddLabel(cache, "—", 152, 0, 196, 28, 11F, PresenceTheme.Foreground);
        freshValue.TextAlign = cacheValue.TextAlign = ContentAlignment.MiddleRight;
        freshValue.Anchor = cacheValue.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;

        appearance = new Panel { Location = overview.Location, Size = new Size(696, 340), BackColor = PresenceTheme.Background,
            Anchor = overview.Anchor, Visible = false };
        readingColumn.Controls.Add(appearance);
        modelSwitch = AddSetting(appearance, "Hiện tên model", "Đưa model đang dùng vào thẻ Discord.", "showModel", 0);
        animationSwitch = AddSetting(appearance, "Ảnh động", "Thay đổi hình ảnh theo trạng thái làm việc.", "animated", 71);
        classicSwitch = AddSetting(appearance, "Thẻ token gọn", "Hiển thị hai dòng token và cache.", "classic", 142);
        startupSwitch = AddSetting(appearance, "Tự chạy cùng Windows", "Khởi động trong khay hệ thống khi đăng nhập.", "startup", 213);
        var savedHint = AddLabel(appearance, "Các thay đổi được lưu tự động.", 0, 308, 696, 24, 9F, PresenceTheme.Secondary);
        savedHint.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;

        refreshTimer = new System.Windows.Forms.Timer { Interval = 500 };
        refreshTimer.Tick += (sender, args) => RefreshView();
        Shown += (sender, args) => RefreshView();
        main.Layout += (sender, args) => LayoutReadingColumn(main);
        ResumeLayout(true);
        LayoutReadingColumn(main);
        SelectPage(false);
    }

    private void LayoutReadingColumn(Control main)
    {
        float scale = DeviceDpi / 96F;
        int edge = (int)Math.Round(32 * scale);
        int width = Math.Min((int)Math.Round(760 * scale), Math.Max(0, main.ClientSize.Width - edge * 2));
        readingColumn.SetBounds((main.ClientSize.Width - width) / 2, 0, width, main.ClientSize.Height);
    }

    private void SelectPage(bool settings)
    {
        settingsSelected = settings;
        overview.Visible = !settings;
        appearance.Visible = settings;
        overviewNav.Selected = !settings;
        appearanceNav.Selected = settings;
        breadcrumb.Text = settings ? "Presence  /  Hiển thị" : "Presence";
        title.Text = settings ? "Hiển thị" : "Hoạt động Codex";
        RefreshView();
    }

    private SettingSwitch AddSetting(Control parent, string label, string description, string key, int y)
    {
        var row = new Panel { Location = new Point(0, y), Size = new Size(696, 71),
            Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right, BackColor = PresenceTheme.Background };
        parent.Controls.Add(row);
        var name = AddLabel(row, label, 0, 8, 584, 24, 10F, PresenceTheme.Foreground);
        var explanation = AddLabel(row, description, 0, 36, 584, 24, 9F, PresenceTheme.Secondary);
        name.Anchor = explanation.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
        var toggle = new SettingSwitch { AccessibleName = label, Location = new Point(600, 16), Size = new Size(96, 40),
            BackColor = PresenceTheme.Background, ForeColor = PresenceTheme.Foreground,
            Anchor = AnchorStyles.Top | AnchorStyles.Right };
        toggle.CheckedChanged += (sender, args) =>
        {
            if (!refreshing) { changeSetting(key, toggle.Checked); RefreshView(); }
        };
        row.Controls.Add(toggle);
        if (y < 213) AddDivider(row, 0, 70, 696);
        return toggle;
    }

    private static void AddDivider(Control parent, int x, int y, int width)
    {
        parent.Controls.Add(new Panel { Location = new Point(x, y), Size = new Size(width, 1),
            BackColor = PresenceTheme.Border, Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right });
    }

    private static Label AddLabel(Control parent, string text, int x, int y, int width, int height, float size,
        Color color, FontStyle style = FontStyle.Regular)
    {
        var label = new Label { Text = text, Location = new Point(x, y), Size = new Size(width, height),
            Font = new Font(PresenceTheme.FontFamily, size, style), ForeColor = color,
            BackColor = Color.Transparent, AutoEllipsis = true, TextAlign = ContentAlignment.MiddleLeft };
        parent.Controls.Add(label);
        return label;
    }

    private void RefreshView()
    {
        PresenceView view = readView();
        if (view == null) return;
        refreshing = true;
        try
        {
            connection.Text = view.Paused ? "Đã tạm dừng chia sẻ" : view.Connection ?? "Đang kết nối Discord";
            bool connected = !view.Paused && connection.Text == "Đã kết nối Discord";
            statusDot.Active = connected;
            previewStatus.Text = view.Paused ? "Tạm dừng" : connected ? "Đang chia sẻ"
                : connection.Text == "Chờ mở Codex" ? "Chờ Codex" : "Chưa kết nối";
            previewStatus.ForeColor = connected ? PresenceTheme.Green : PresenceTheme.Secondary;
            subtitle.Text = settingsSelected ? "Tùy chỉnh thông tin và hình ảnh trên thẻ Discord."
                : view.Paused ? "Chia sẻ đang tạm dừng. Bạn vẫn có thể xem trước thẻ."
                : connected ? "Hoạt động Codex đang được chia sẻ trên Discord."
                : connection.Text == "Chờ mở Codex" ? "Mở Codex để bắt đầu chia sẻ hoạt động."
                : "Bản xem trước. Thẻ sẽ được chia sẻ khi Discord kết nối.";
            details.Text = view.Details ?? "Đang chờ Codex";
            state.Text = view.State ?? String.Empty;
            pauseButton.Text = view.Paused ? "Tiếp tục chia sẻ" : "Tạm dừng";
            elapsed.Visible = !view.Paused;
            pausedNotice.Visible = view.Paused;
            if (view.StartedAt > 0)
            {
                TimeSpan duration = DateTimeOffset.UtcNow - DateTimeOffset.FromUnixTimeSeconds(view.StartedAt);
                if (duration < TimeSpan.Zero) duration = TimeSpan.Zero;
                elapsed.Text = String.Format("Thời gian · {0:00}:{1:00}:{2:00}", (long)duration.TotalHours, duration.Minutes, duration.Seconds);
            }
            else elapsed.Text = "Chờ mở Codex";
            freshValue.Text = view.HasUsage ? (view.FreshLabel ?? "").Replace(" fresh tokens", "") : "—";
            cacheValue.Text = view.HasUsage ? (view.CacheLabel ?? "").Replace(" from cache", "") : "—";
            modelValue.Text = String.IsNullOrEmpty(view.Model) ? "Chờ phiên Codex" : view.Model;
            modelSwitch.Checked = view.ShowModel;
            animationSwitch.Checked = view.Animated;
            classicSwitch.Checked = view.Classic;
            startupSwitch.Checked = view.Startup;
            Image image = view.Animated ? PresenceArtwork.GetImage(view.Phase ?? "idle") : null;
            if (!Object.ReferenceEquals(artwork.Image, image)) artwork.Image = image;
            artwork.Visible = image != null;
            fallbackArtwork.Visible = image == null;
        }
        finally { refreshing = false; }
    }

    protected override void OnHandleCreated(EventArgs args)
    {
        base.OnHandleCreated(args);
        // Windows DWM cosmetics affect only this window's title bar.
        try
        {
            int dark = 1;
            DwmSetWindowAttribute(Handle, 20, ref dark, sizeof(int));
            int caption = ColorTranslator.ToWin32(PresenceTheme.Background);
            DwmSetWindowAttribute(Handle, 35, ref caption, sizeof(int));
        }
        catch (DllNotFoundException) { }
        catch (EntryPointNotFoundException) { }
    }

    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmSetWindowAttribute(IntPtr window, int attribute, ref int value, int size);

    protected override void OnVisibleChanged(EventArgs args)
    {
        base.OnVisibleChanged(args);
        if (refreshTimer != null) refreshTimer.Enabled = Visible;
        if (Visible && refreshTimer != null) RefreshView();
    }

    protected override void OnFormClosing(FormClosingEventArgs args)
    {
        if (args.CloseReason == CloseReason.UserClosing) { args.Cancel = true; Hide(); }
        base.OnFormClosing(args);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            if (refreshTimer != null) refreshTimer.Dispose();
            if (artwork != null) artwork.Image = null;
        }
        base.Dispose(disposing);
    }
}

internal sealed class NavigationButton : Button
{
    private bool selected;
    private bool hovering;
    private bool pressed;
    private readonly string kind;
    public bool Selected { get { return selected; } set { selected = value; Invalidate(); } }

    public NavigationButton(string text, string kind)
    {
        Text = text;
        this.kind = kind;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Font = new Font(PresenceTheme.FontFamily, 9.5F);
        ForeColor = PresenceTheme.Foreground;
        FlatStyle = FlatStyle.Flat;
        FlatAppearance.BorderSize = 0;
        Cursor = Cursors.Hand;
    }

    protected override void OnPaint(PaintEventArgs args)
    {
        Graphics graphics = args.Graphics;
        graphics.SmoothingMode = SmoothingMode.AntiAlias;
        graphics.Clear(PresenceTheme.Sidebar);
        float scale = DeviceDpi / 96F;
        Color fill = pressed && Enabled ? PresenceTheme.Pressed : hovering && Enabled ? PresenceTheme.Hover : PresenceTheme.Selected;
        if (selected || hovering || pressed)
            using (var shape = RoundedSurface.Round(new Rectangle(0, 0, Width - 1, Height - 1), (int)(8 * scale)))
            using (var brush = new SolidBrush(fill)) graphics.FillPath(brush, shape);
        using (var pen = new Pen(selected && Enabled ? PresenceTheme.Foreground : PresenceTheme.Muted, 1.4F * scale))
        {
            float x = 12 * scale, y = Height / 2F - 7 * scale, step = 14 * scale;
            if (kind == "overview")
            {
                graphics.DrawRectangle(pen, x, y, step, step);
                graphics.DrawLine(pen, x, y + step * .42F, x + step, y + step * .42F);
            }
            else
            {
                graphics.DrawLine(pen, x, y + 3 * scale, x + step, y + 3 * scale);
                graphics.DrawLine(pen, x, y + 11 * scale, x + step, y + 11 * scale);
                graphics.DrawRectangle(pen, x + 3 * scale, y, 4 * scale, 6 * scale);
                graphics.DrawRectangle(pen, x + 8 * scale, y + 8 * scale, 4 * scale, 6 * scale);
            }
        }
        TextRenderer.DrawText(graphics, Text, Font, new Rectangle((int)(38 * scale), 0, Width - (int)(44 * scale), Height),
            !Enabled ? PresenceTheme.Muted : selected ? PresenceTheme.Foreground : PresenceTheme.Secondary,
            TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);
        if (Focused && ShowFocusCues) PresenceControlPaint.Focus(graphics, ClientRectangle, DeviceDpi, PresenceTheme.Focus);
    }

    protected override void OnMouseEnter(EventArgs args) { hovering = true; Invalidate(); base.OnMouseEnter(args); }
    protected override void OnMouseLeave(EventArgs args) { hovering = false; pressed = false; Invalidate(); base.OnMouseLeave(args); }
    protected override void OnMouseDown(MouseEventArgs args) { if (args.Button == MouseButtons.Left) pressed = true; Invalidate(); base.OnMouseDown(args); }
    protected override void OnMouseUp(MouseEventArgs args) { pressed = false; Invalidate(); base.OnMouseUp(args); }
    protected override void OnKeyDown(KeyEventArgs args) { if (args.KeyCode == Keys.Space || args.KeyCode == Keys.Enter) pressed = true; Invalidate(); base.OnKeyDown(args); }
    protected override void OnKeyUp(KeyEventArgs args) { pressed = false; Invalidate(); base.OnKeyUp(args); }
    protected override void OnGotFocus(EventArgs args) { base.OnGotFocus(args); Invalidate(); }
    protected override void OnLostFocus(EventArgs args) { pressed = false; base.OnLostFocus(args); Invalidate(); }
    protected override void OnEnabledChanged(EventArgs args) { pressed = false; base.OnEnabledChanged(args); Invalidate(); }
}

internal sealed class RoundedButton : Button
{
    public bool Primary;
    private bool hovering;
    private bool pressed;
    public RoundedButton()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Font = new Font(PresenceTheme.FontFamily, 9.5F, FontStyle.Bold);
        FlatStyle = FlatStyle.Flat;
        FlatAppearance.BorderSize = 0;
        Cursor = Cursors.Hand;
    }

    protected override void OnPaint(PaintEventArgs args)
    {
        Graphics graphics = args.Graphics;
        graphics.SmoothingMode = SmoothingMode.AntiAlias;
        graphics.Clear(Parent == null ? PresenceTheme.Background : Parent.BackColor);
        Color fill = !Enabled ? PresenceTheme.Surface
            : Primary ? (pressed ? PresenceTheme.Secondary : hovering ? Color.FromArgb(207, 207, 207) : PresenceTheme.Foreground)
            : (pressed ? PresenceTheme.Pressed : hovering ? PresenceTheme.Hover : Color.FromArgb(36, 36, 36));
        using (var shape = RoundedSurface.Round(new Rectangle(0, 0, Width - 1, Height - 1), (int)(8 * DeviceDpi / 96F)))
        using (var brush = new SolidBrush(fill))
        {
            graphics.FillPath(brush, shape);
            if (!Primary) using (var pen = new Pen(PresenceTheme.Border)) graphics.DrawPath(pen, shape);
        }
        TextRenderer.DrawText(graphics, Text, Font, ClientRectangle, !Enabled ? PresenceTheme.Muted : Primary ? PresenceTheme.Background : PresenceTheme.Foreground,
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);
        if (Focused && ShowFocusCues) PresenceControlPaint.Focus(graphics, ClientRectangle, DeviceDpi,
            Primary && Enabled ? PresenceTheme.Background : PresenceTheme.Focus);
    }

    protected override void OnMouseEnter(EventArgs args) { hovering = true; Invalidate(); base.OnMouseEnter(args); }
    protected override void OnMouseLeave(EventArgs args) { hovering = false; pressed = false; Invalidate(); base.OnMouseLeave(args); }
    protected override void OnMouseDown(MouseEventArgs args) { if (args.Button == MouseButtons.Left) pressed = true; Invalidate(); base.OnMouseDown(args); }
    protected override void OnMouseUp(MouseEventArgs args) { pressed = false; Invalidate(); base.OnMouseUp(args); }
    protected override void OnKeyDown(KeyEventArgs args) { if (args.KeyCode == Keys.Space || args.KeyCode == Keys.Enter) pressed = true; Invalidate(); base.OnKeyDown(args); }
    protected override void OnKeyUp(KeyEventArgs args) { pressed = false; Invalidate(); base.OnKeyUp(args); }
    protected override void OnGotFocus(EventArgs args) { base.OnGotFocus(args); Invalidate(); }
    protected override void OnLostFocus(EventArgs args) { pressed = false; base.OnLostFocus(args); Invalidate(); }
    protected override void OnEnabledChanged(EventArgs args) { pressed = false; base.OnEnabledChanged(args); Invalidate(); }
    protected override void OnTextChanged(EventArgs args) { base.OnTextChanged(args); Invalidate(); }
}

internal sealed class SettingSwitch : CheckBox
{
    private bool hovering;
    private bool pressed;
    public SettingSwitch()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        AutoSize = false;
        Font = new Font(PresenceTheme.FontFamily, 9F);
        Cursor = Cursors.Hand;
    }

    protected override void OnPaint(PaintEventArgs args)
    {
        Graphics graphics = args.Graphics;
        graphics.SmoothingMode = SmoothingMode.AntiAlias;
        graphics.Clear(BackColor);
        float scale = DeviceDpi / 96F;
        int width = (int)(36 * scale), height = (int)(22 * scale);
        var track = new Rectangle((int)(4 * scale), (Height - height) / 2, width, height);
        Color fill = !Enabled ? PresenceTheme.Pressed
            : Checked ? (pressed ? PresenceTheme.Secondary : hovering ? Color.FromArgb(207, 207, 207) : PresenceTheme.Foreground)
            : (pressed ? Color.FromArgb(110, 110, 110) : hovering ? Color.FromArgb(92, 92, 92) : Color.FromArgb(74, 74, 74));
        using (var shape = RoundedSurface.Round(track, height / 2))
        using (var brush = new SolidBrush(fill)) graphics.FillPath(brush, shape);
        int padding = (int)(3 * scale), diameter = height - padding * 2;
        int thumb = Checked ? track.Right - padding - diameter : track.Left + padding;
        using (var brush = new SolidBrush(!Enabled ? PresenceTheme.Muted : Checked ? PresenceTheme.Sidebar : PresenceTheme.Foreground))
            graphics.FillEllipse(brush, thumb, track.Top + padding, diameter, diameter);
        int textLeft = (int)(48 * scale);
        TextRenderer.DrawText(graphics, Checked ? "Bật" : "Tắt", Font, new Rectangle(textLeft, 0, Width - textLeft, Height),
            Enabled ? PresenceTheme.Secondary : PresenceTheme.Muted, TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);
        if (Focused && ShowFocusCues) PresenceControlPaint.Focus(graphics, ClientRectangle, DeviceDpi, PresenceTheme.Focus);
    }

    protected override void OnCheckedChanged(EventArgs args) { base.OnCheckedChanged(args); Invalidate(); }
    protected override void OnMouseEnter(EventArgs args) { hovering = true; Invalidate(); base.OnMouseEnter(args); }
    protected override void OnMouseLeave(EventArgs args) { hovering = false; pressed = false; Invalidate(); base.OnMouseLeave(args); }
    protected override void OnMouseDown(MouseEventArgs args) { if (args.Button == MouseButtons.Left) pressed = true; Invalidate(); base.OnMouseDown(args); }
    protected override void OnMouseUp(MouseEventArgs args) { pressed = false; Invalidate(); base.OnMouseUp(args); }
    protected override void OnKeyDown(KeyEventArgs args) { if (args.KeyCode == Keys.Space) pressed = true; Invalidate(); base.OnKeyDown(args); }
    protected override void OnKeyUp(KeyEventArgs args) { pressed = false; Invalidate(); base.OnKeyUp(args); }
    protected override void OnGotFocus(EventArgs args) { base.OnGotFocus(args); Invalidate(); }
    protected override void OnLostFocus(EventArgs args) { pressed = false; base.OnLostFocus(args); Invalidate(); }
    protected override void OnEnabledChanged(EventArgs args) { pressed = false; base.OnEnabledChanged(args); Invalidate(); }
}

internal static class PresenceControlPaint
{
    public static void Focus(Graphics graphics, Rectangle bounds, int dpi, Color color)
    {
        float scale = dpi / 96F;
        int inset = Math.Max(3, (int)Math.Round(3 * scale));
        bounds.Inflate(-inset, -inset);
        using (var shape = RoundedSurface.Round(bounds, (int)(5 * scale)))
        using (var pen = new Pen(color, Math.Max(1F, scale))) graphics.DrawPath(pen, shape);
    }
}

internal sealed class RoundedSurface : Panel
{
    public int CornerRadius = 12;
    public Color BorderColor = PresenceTheme.Border;
    public RoundedSurface() { SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true); }

    protected override void OnPaintBackground(PaintEventArgs args)
    {
        args.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        args.Graphics.Clear(Parent == null ? BackColor : Parent.BackColor);
        using (var shape = Round(new Rectangle(0, 0, Width - 1, Height - 1), (int)(CornerRadius * DeviceDpi / 96F)))
        using (var brush = new SolidBrush(BackColor))
        using (var pen = new Pen(BorderColor))
        {
            args.Graphics.FillPath(brush, shape);
            args.Graphics.DrawPath(pen, shape);
        }
    }

    public static GraphicsPath Round(Rectangle rectangle, int radius)
    {
        int diameter = Math.Max(2, Math.Min(radius * 2, Math.Min(rectangle.Width, rectangle.Height)));
        var path = new GraphicsPath();
        path.AddArc(rectangle.Left, rectangle.Top, diameter, diameter, 180, 90);
        path.AddArc(rectangle.Right - diameter, rectangle.Top, diameter, diameter, 270, 90);
        path.AddArc(rectangle.Right - diameter, rectangle.Bottom - diameter, diameter, diameter, 0, 90);
        path.AddArc(rectangle.Left, rectangle.Bottom - diameter, diameter, diameter, 90, 90);
        path.CloseFigure();
        return path;
    }
}

internal sealed class StatusDot : Control
{
    private bool active;
    public bool Active { get { return active; } set { if (active != value) { active = value; Invalidate(); } } }
    public StatusDot() { SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer, true); }
    protected override void OnPaint(PaintEventArgs args)
    {
        args.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        args.Graphics.Clear(Parent == null ? PresenceTheme.Sidebar : Parent.BackColor);
        using (var brush = new SolidBrush(active ? PresenceTheme.Green : PresenceTheme.Muted))
            args.Graphics.FillEllipse(brush, 0, 0, Width - 1, Height - 1);
    }
}

internal sealed class TerminalTile : Control
{
    public TerminalTile()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer, true);
        AccessibleName = "Biểu tượng Codex";
    }

    protected override void OnPaint(PaintEventArgs args)
    {
        Graphics graphics = args.Graphics;
        graphics.SmoothingMode = SmoothingMode.AntiAlias;
        graphics.Clear(Parent == null ? PresenceTheme.Background : Parent.BackColor);
        float width = Width;
        using (var pen = new Pen(PresenceTheme.Foreground, Math.Max(1.7F, width / 22F)))
        {
            pen.StartCap = LineCap.Round;
            pen.EndCap = LineCap.Round;
            graphics.DrawLines(pen, new[] { new PointF(width * .18F, Height * .24F),
                new PointF(width * .42F, Height * .48F), new PointF(width * .18F, Height * .72F) });
            graphics.DrawLine(pen, width * .52F, Height * .74F, width * .84F, Height * .74F);
        }
    }
}
