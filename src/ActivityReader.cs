using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

internal sealed class ActivitySample
{
    public DateTimeOffset Timestamp;
    public string Phase = "idle";
    public string Model = "";
    public long InputTokens;
    public long CachedTokens;
    public long OutputTokens;
    public bool HasUsage;
}

// Reads only Codex's local desktop session records. Returned data has no prompt,
// path, project, command, response text, account identifier, or credential field.
internal sealed class ActivityReader
{
    private const int MaximumFiles = 4096;
    private const int MaximumTail = 1024 * 1024;
    private const int MaximumRecord = 256 * 1024;
    private const int MaximumHead = 64 * 1024;
    private readonly DirectoryInfo sessions;
    private readonly DateTimeOffset sessionStart;
    private readonly Dictionary<string, SessionFile> files = new Dictionary<string, SessionFile>(StringComparer.OrdinalIgnoreCase);
    private readonly byte[] buffer = new byte[MaximumTail];
    private readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = MaximumRecord, RecursionLimit = 64 };
    private DateTimeOffset nextPoll;
    private static readonly Regex ModelName = new Regex(@"^(?:gpt-[a-z0-9]+(?:[.-][a-z0-9]+)*|o[134](?:-[a-z0-9]+(?:[.-][a-z0-9]+)*)?)$", RegexOptions.CultureInvariant);
    private static readonly Regex CommandRead = new Regex(@"\b(?:Get-Content|Select-String|cat|head|tail|sed|more|less)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex CommandSearch = new Regex(@"\b(?:rg|grep|find|Get-ChildItem|Get-Item)\b|web__run|search_query", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    public ActivityReader(string sessionsPath, DateTimeOffset sessionStart)
    {
        sessions = new DirectoryInfo(sessionsPath);
        this.sessionStart = sessionStart;
    }

    public ActivitySample ReadLatest()
    {
        return ReadLatestAt(DateTimeOffset.UtcNow);
    }

    internal ActivitySample ReadLatestAt(DateTimeOffset now)
    {
        if (now >= nextPoll)
        {
            nextPoll = now.AddSeconds(2);
            Scan(now);
        }

        SessionFile latest = null;
        foreach (SessionFile file in files.Values)
        {
            if (!file.Eligible || !file.ContextKnown || file.Reviewer || file.ActivityAt < sessionStart)
                continue;
            if (latest == null || file.ActivityAt > latest.ActivityAt)
                latest = file;
        }

        if (latest == null)
            return new ActivitySample();

        string phase = latest.Phase;
        if ((phase == "success" && now - latest.ActivityAt > TimeSpan.FromSeconds(20)) ||
            (phase == "error" && now - latest.ActivityAt > TimeSpan.FromSeconds(30)) ||
            (phase != "success" && phase != "error" && now - latest.HeartbeatAt > TimeSpan.FromSeconds(90)))
            phase = "idle";

        return new ActivitySample
        {
            Timestamp = latest.ActivityAt,
            Phase = phase,
            Model = latest.Model,
            HasUsage = latest.HasUsage,
            InputTokens = latest.Input,
            CachedTokens = latest.Cached,
            OutputTokens = latest.Output
        };
    }

    private void Scan(DateTimeOffset now)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        try
        {
            int visited = 0;
            int contextBudget = 4;
            foreach (FileInfo info in NewestFiles(sessions, 0))
            {
                if (++visited > MaximumFiles)
                    break;
                seen.Add(info.FullName);
                try
                {
                    SessionFile file;
                    if (!files.TryGetValue(info.FullName, out file))
                    {
                        file = new SessionFile();
                        files.Add(info.FullName, file);
                    }
                    // Open-file modification times can stay stale on Windows.
                    // Length changes pick up resumed conversations as well.
                    if (file.Length != info.Length || file.Modified != info.LastWriteTimeUtc)
                        ReadFile(info, file, now);
                    if (file.Eligible && !file.ContextKnown && contextBudget > 0)
                    {
                        contextBudget--;
                        RecoverContext(info.FullName, file, now);
                    }
                }
                catch (IOException) { }
                catch (UnauthorizedAccessException) { }
                catch (System.Security.SecurityException) { }
            }
            var removed = new List<string>();
            foreach (string path in files.Keys)
                if (!seen.Contains(path)) removed.Add(path);
            foreach (string path in removed) files.Remove(path);
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
        catch (System.Security.SecurityException) { }
    }

    private static IEnumerable<FileInfo> NewestFiles(DirectoryInfo directory, int depth)
    {
        // Codex stores yyyy/MM/dd. ISO folder and rollout names sort by date,
        // ensuring a large historical archive cannot consume the file cap first.
        DirectoryInfo[] children = directory.GetDirectories();
        Array.Sort(children, (left, right) => StringComparer.Ordinal.Compare(right.Name, left.Name));
        foreach (DirectoryInfo child in children)
        {
            if (depth >= 3 || (child.Attributes & FileAttributes.ReparsePoint) != 0) continue;
            foreach (FileInfo file in NewestFiles(child, depth + 1)) yield return file;
        }
        FileInfo[] files = directory.GetFiles("rollout-*.jsonl");
        Array.Sort(files, (left, right) => StringComparer.Ordinal.Compare(right.Name, left.Name));
        foreach (FileInfo file in files) yield return file;
    }

    private void ReadFile(FileInfo info, SessionFile file, DateTimeOffset now)
    {
        using (var stream = new FileStream(info.FullName, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
        {
            long length = stream.Length;
            bool reset = file.Length < 0 || length < file.Offset ||
                (file.Length == length && file.Modified != info.LastWriteTimeUtc);
            if (reset)
            {
                file.Reset();
                int read = ReadBytes(stream, (int)Math.Min(length, MaximumHead));
                int end = Array.IndexOf(buffer, (byte)'\n', 0, read);
                if (end < 0)
                    return; // Metadata may still be being appended.
                file.Eligible = DesktopSession(Parse(0, end));
                if (file.Eligible)
                {
                    int headStart = end + 1;
                    for (int index = headStart; index < read; index++)
                    {
                        if (buffer[index] != '\n') continue;
                        TryContext(Parse(headStart, index - headStart), file, now);
                        headStart = index + 1;
                    }
                    // A later model switch may be outside this initial head.
                    file.ContextKnown = false;
                    file.Reviewer = false;
                }
            }

            file.Length = length;
            file.Modified = info.LastWriteTimeUtc;
            if (!file.Eligible)
                return;

            long offset = reset ? Math.Max(0, length - MaximumTail) : file.Offset;
            if (length - offset > MaximumTail)
                offset = length - MaximumTail;
            bool skipFirst = offset > 0 && (reset || offset != file.Offset);
            if (skipFirst)
            {
                file.ContextKnown = false;
                file.ContextEnd = offset;
            }
            stream.Position = offset;
            int count = ReadBytes(stream, (int)(length - offset));
            int start = 0;
            int complete = 0;
            for (int index = 0; index < count; index++)
            {
                if (buffer[index] != '\n')
                    continue;
                int size = index - start;
                if (!skipFirst && size > 0 && size <= MaximumRecord)
                    Consume(Parse(start, size), file, now, sessionStart);
                skipFirst = false;
                start = index + 1;
                complete = start;
            }
            file.Offset = offset + complete;
            if (offset == 0 && !file.ContextKnown)
                file.ContextKnown = true; // Entire file inspected, including context-free older logs.
        }
    }

    private void RecoverContext(string path, SessionFile file, DateTimeOffset now)
    {
        // Older context is recovered progressively. Each poll reads at most four
        // extra 1MiB chunks overall. The overlap catches records split at a tail edge.
        using (var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
        {
            long end = Math.Min(file.ContextEnd, stream.Length);
            long offset = Math.Max(0, end - (MaximumTail - MaximumRecord));
            stream.Position = offset;
            int count = ReadBytes(stream, (int)Math.Min(MaximumTail, stream.Length - offset));
            if (count == 0)
            {
                file.ContextKnown = true;
                file.ContextEnd = 0;
                return;
            }
            int lineEnd = Array.LastIndexOf(buffer, (byte)'\n', count - 1, count);
            while (lineEnd > 0)
            {
                int newline = Array.LastIndexOf(buffer, (byte)'\n', lineEnd - 1, lineEnd);
                int start = newline + 1;
                if ((newline >= 0 || offset == 0) && offset + start < end && lineEnd - start <= MaximumRecord &&
                    TryContext(Parse(start, lineEnd - start), file, now))
                    return;
                lineEnd = newline;
            }
            file.ContextEnd = offset;
            if (offset == 0) file.ContextKnown = true;
        }
    }

    private int ReadBytes(Stream stream, int count)
    {
        int used = 0;
        while (used < count)
        {
            int read = stream.Read(buffer, used, count - used);
            if (read == 0) break;
            used += read;
        }
        return used;
    }

    private Dictionary<string, object> Parse(int start, int count)
    {
        // Unknown transcript records and oversized tool outputs are ignored.
        string prefix = Encoding.UTF8.GetString(buffer, start, Math.Min(count, 160));
        if (prefix.IndexOf("\"type\":\"session_meta\"", StringComparison.Ordinal) < 0 &&
            prefix.IndexOf("\"type\":\"turn_context\"", StringComparison.Ordinal) < 0 &&
            prefix.IndexOf("\"type\":\"event_msg\"", StringComparison.Ordinal) < 0 &&
            prefix.IndexOf("\"type\":\"response_item\"", StringComparison.Ordinal) < 0)
            return null;
        try
        {
            return json.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(buffer, start, count).TrimStart('\ufeff'));
        }
        catch (ArgumentException) { return null; }
        catch (InvalidOperationException) { return null; }
    }

    private static bool DesktopSession(Dictionary<string, object> record)
    {
        if (Text(record, "type") != "session_meta") return false;
        Dictionary<string, object> meta = Object(record, "payload");
        string origin = Text(meta, "originator");
        string source = Text(meta, "source");
        return source != "" && source != "cli" && source != "exec" &&
            (origin == "codex_work_desktop" || origin == "codex_desktop" || origin == "Codex Desktop");
    }

    private static void Consume(Dictionary<string, object> record, SessionFile file, DateTimeOffset now, DateTimeOffset started)
    {
        if (record == null) return;
        DateTimeOffset timestamp;
        if (!DateTimeOffset.TryParse(Text(record, "timestamp"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out timestamp) ||
            timestamp > now.AddMinutes(5)) return;

        string type = Text(record, "type");
        Dictionary<string, object> payload = Object(record, "payload");
        if (type == "turn_context")
        {
            TryContext(record, file, now);
            return;
        }
        if (file.Reviewer || timestamp < started) return;

        string item = Text(payload, "type");
        if (type == "event_msg")
        {
            if (item == "token_count")
            {
                Dictionary<string, object> usage = Object(Object(payload, "info"), "last_token_usage");
                long input, cached, output;
                if (Count(usage, "input_tokens", out input) && Count(usage, "cached_input_tokens", out cached) &&
                    Count(usage, "output_tokens", out output) && cached <= input && (input > 0 || output > 0))
                {
                    file.Input = input;
                    file.Cached = cached;
                    file.Output = output;
                    file.HasUsage = true;
                }
                if (file.Phase != "idle" && file.Phase != "success" && file.Phase != "error")
                    file.HeartbeatAt = timestamp;
                return;
            }
            if (item == "task_started" || item == "user_message" || item == "agent_reasoning")
                Activity(file, "thinking", timestamp);
            else if (item == "task_complete")
                Activity(file, "success", timestamp);
            else if (item == "turn_aborted")
                Activity(file, "idle", timestamp);
            else if (item == "error" || item == "stream_error")
                Activity(file, "error", timestamp);
            else if (item == "patch_apply_begin" || item == "patch_apply_end")
                Activity(file, "coding", timestamp);
            else if (item == "web_search_begin" || item == "web_search_end")
                Activity(file, "searching", timestamp);
            else if (item == "mcp_tool_call_begin")
                Activity(file, "running", timestamp);
            else if (item == "mcp_tool_call_end")
                Activity(file, "thinking", timestamp);
            return;
        }

        if (type != "response_item") return;
        if (item == "reasoning")
            Activity(file, "thinking", timestamp);
        else if (item == "web_search_call")
            Activity(file, "searching", timestamp);
        else if (item == "function_call" || item == "custom_tool_call")
        {
            string phase = ToolPhase(Text(payload, "name"), Text(payload, "arguments"), Text(payload, "input"));
            Activity(file, phase, timestamp);
        }
        else if ((item == "function_call_output" || item == "custom_tool_call_output") &&
            file.Phase != "idle" && file.Phase != "success" && file.Phase != "error")
            Activity(file, "thinking", timestamp);
        else if (item == "message" && Text(payload, "role") == "assistant")
        {
            if (Text(payload, "channel") == "final") Activity(file, "success", timestamp);
            else if (file.Phase != "success") Activity(file, "thinking", timestamp);
        }
    }

    private static bool TryContext(Dictionary<string, object> record, SessionFile file, DateTimeOffset now)
    {
        if (Text(record, "type") != "turn_context") return false;
        DateTimeOffset timestamp;
        if (!DateTimeOffset.TryParse(Text(record, "timestamp"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out timestamp) ||
            timestamp > now.AddMinutes(5)) return false;
        if (timestamp >= file.ContextAt)
        {
            string model = Text(Object(record, "payload"), "model");
            file.Reviewer = model == "codex-auto-review";
            file.Model = file.Reviewer ? "" : PrettyModel(model);
            file.ContextAt = timestamp;
        }
        file.ContextKnown = true;
        file.ContextEnd = -1;
        return true;
    }

    private static void Activity(SessionFile file, string phase, DateTimeOffset timestamp)
    {
        if (timestamp < file.ActivityAt) return;
        file.ActivityAt = timestamp;
        file.HeartbeatAt = timestamp;
        file.Phase = phase;
    }

    private static string ToolPhase(string name, string arguments, string input)
    {
        string tool = name.ToLowerInvariant();
        if (tool.Contains("apply_patch") || tool.Contains("edit_file") || tool.Contains("write_file")) return "coding";
        if (tool.Contains("search") || tool.Contains("browse") || tool.Contains("web__") || tool == "js") return "searching";
        if (tool.Contains("read_file") || tool.Contains("get_content") || tool == "view_image") return "reading";
        if (tool == "exec" || tool == "exec_command" || tool == "shell" || tool == "local_shell")
        {
            // Commands are examined in memory solely for a generic activity label.
            // No command or argument is retained or returned by the reader.
            string command = arguments.Length > 0 ? arguments : input;
            if (command.IndexOf("apply_patch", StringComparison.OrdinalIgnoreCase) >= 0) return "coding";
            if (CommandSearch.IsMatch(command)) return "searching";
            if (CommandRead.IsMatch(command)) return "reading";
            return "running";
        }
        if (tool == "wait" || tool == "write_stdin") return "running";
        return "running";
    }

    private static string PrettyModel(string model)
    {
        if (model.Length > 64 || !ModelName.IsMatch(model)) return "";
        string[] parts = model.Split('-');
        if (parts.Length < 2) return model.ToUpperInvariant();
        var result = new StringBuilder(parts[0].ToUpperInvariant());
        for (int index = 1; index < parts.Length; index++)
        {
            result.Append(index == 1 && parts[0] == "gpt" ? "-" : " ");
            result.Append(char.ToUpperInvariant(parts[index][0]));
            if (parts[index].Length > 1) result.Append(parts[index].Substring(1));
        }
        return result.ToString();
    }

    private static bool Count(Dictionary<string, object> record, string field, out long count)
    {
        object value = Field(record, field);
        count = value is int ? (int)value : value is long ? (long)value : -1;
        return count >= 0;
    }

    private static string Text(Dictionary<string, object> record, string field)
    {
        return Field(record, field) as string ?? "";
    }

    private static Dictionary<string, object> Object(Dictionary<string, object> record, string field)
    {
        return Field(record, field) as Dictionary<string, object>;
    }

    private static object Field(Dictionary<string, object> record, string field)
    {
        object value;
        return record != null && record.TryGetValue(field, out value) ? value : null;
    }

    private sealed class SessionFile
    {
        public long Length = -1;
        public long Offset;
        public DateTime Modified;
        public bool Eligible;
        public bool Reviewer;
        public bool ContextKnown;
        public long ContextEnd = -1;
        public DateTimeOffset ContextAt;
        public string Model = "";
        public string Phase = "idle";
        public DateTimeOffset ActivityAt;
        public DateTimeOffset HeartbeatAt;
        public bool HasUsage;
        public long Input, Cached, Output;

        public void Reset()
        {
            Offset = 0;
            Eligible = false;
            Reviewer = false;
            ContextKnown = false;
            ContextEnd = -1;
            ContextAt = DateTimeOffset.MinValue;
            Model = "";
            Phase = "idle";
            ActivityAt = DateTimeOffset.MinValue;
            HeartbeatAt = DateTimeOffset.MinValue;
            HasUsage = false;
            Input = Cached = Output = 0;
        }
    }
}
