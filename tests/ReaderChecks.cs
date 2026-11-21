using System;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;

internal static class ReaderChecks
{
    private static readonly UTF8Encoding Utf8 = new UTF8Encoding(false);
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 4 * 1024 * 1024 };

    public static void Main(string[] args)
    {
        if (args.Length == 2 && args[0] == "live")
        {
            var liveSample = new ActivityReader(args[1], DateTimeOffset.UtcNow.AddHours(-12)).ReadLatest();
            Console.WriteLine(Json.Serialize(liveSample));
            return;
        }

        string folder = args[0];
        Directory.CreateDirectory(folder);
        string main = Path.Combine(folder, "rollout-desktop.jsonl");
        string background = Path.Combine(folder, "rollout-background.jsonl");
        DateTimeOffset now = DateTimeOffset.UtcNow;
        File.WriteAllText(main, Metadata("codex_work_desktop", "vscode") +
            Record(now.AddSeconds(-5), "turn_context", new { model = "gpt-6.1-sol" }) +
            Event(now.AddSeconds(-4), "task_started") +
            Record(now.AddSeconds(-2), "response_item", new { type = "custom_tool_call", name = "apply_patch", input = "private file content" }) +
            Token(now.AddSeconds(-1), 76700, 75000, 600), Utf8);
        File.WriteAllText(Path.Combine(folder, "rollout-cli.jsonl"), Metadata("codex_cli_rs", "cli") + Event(now, "task_started"), Utf8);
        File.WriteAllText(Path.Combine(folder, "rollout-subagent.jsonl"), Metadata("codex_work_desktop", new { subagent = new { } }) + Event(now, "task_started"), Utf8);
        File.WriteAllText(background, Metadata("codex_work_desktop", "vscode") + Token(now, 5, 0, 0), Utf8);
        var reader = new ActivityReader(folder, now.AddMinutes(-1));
        ActivitySample sample = reader.ReadLatestAt(now);
        Require(sample.Phase == "coding" && sample.Model == "GPT-6.1 Sol", "A desktop tool call should select coding and its safe model label.");
        Require(sample.HasUsage && sample.InputTokens == 76700 && sample.CachedTokens == 75000 && sample.OutputTokens == 600,
            "The selected thread must keep its exact last input, cache, and output counters.");

        string output = Record(now.AddSeconds(3), "response_item", new { type = "custom_tool_call_output", output = "private data" });
        File.AppendAllText(main, output.TrimEnd('\n'), Utf8);
        Require(reader.ReadLatestAt(now.AddSeconds(4)).Phase == "coding", "An incomplete append must leave the previous complete state intact.");
        File.AppendAllText(main, "\n", Utf8);
        Require(reader.ReadLatestAt(now.AddSeconds(6)).Phase == "thinking", "Completing an appended tool result should move to thinking.");

        File.AppendAllText(main, Event(now.AddSeconds(7), "task_complete"), Utf8);
        File.AppendAllText(background, Token(now.AddSeconds(8), 6, 0, 0), Utf8);
        sample = reader.ReadLatestAt(now.AddSeconds(9));
        Require(sample.Phase == "success" && sample.InputTokens == 76700, "A token-only background thread must not take the card.");
        Require(reader.ReadLatestAt(now.AddSeconds(31)).Phase == "idle", "The completion state should become idle after its display interval.");

        File.AppendAllText(main, Event(now.AddSeconds(33), "task_started") +
            Record(now.AddSeconds(34), "response_item", new { type = "custom_tool_call", name = "exec", input = "await tools.exec_command({cmd: 'rg foo'});" }), Utf8);
        File.SetLastWriteTimeUtc(main, now.UtcDateTime.AddHours(-3));
        sample = reader.ReadLatestAt(now.AddSeconds(35));
        Require(sample.Phase == "searching", "A changed-size resumed file with a stale write time must still update.");
        File.AppendAllText(main, Token(now.AddSeconds(70), 1000, 900, 25), Utf8);
        Require(reader.ReadLatestAt(now.AddSeconds(100)).Phase == "searching", "Active usage updates should keep a live tool state fresh.");
        Require(reader.ReadLatestAt(now.AddSeconds(170)).Phase == "idle", "A quiet active state should fall back to idle.");

        File.AppendAllText(main, Record(now.AddSeconds(172), "turn_context", new { model = "codex-auto-review" }) + Event(now.AddSeconds(173), "task_started"), Utf8);
        Require(reader.ReadLatestAt(now.AddSeconds(174)).Phase == "idle", "Internal reviewer sessions must stay unselected.");
        File.AppendAllText(main, Record(now.AddSeconds(176), "turn_context", new { model = "private name / unsafe" }) + Event(now.AddSeconds(177), "task_started"), Utf8);
        sample = reader.ReadLatestAt(now.AddSeconds(178));
        Require(sample.Model == "" && sample.Phase == "thinking", "Unknown model text must stay out of the public sample.");

        string huge = new string('x', 1100000);
        File.WriteAllText(main, Metadata("codex_work_desktop", "vscode") +
            Record(now.AddSeconds(180), "response_item", new { type = "function_call_output", output = huge }) +
            Event(now.AddSeconds(181), "task_started") + Token(now.AddSeconds(182), 50, 10, 5), Utf8);
        sample = reader.ReadLatestAt(now.AddSeconds(184));
        Require(sample.Phase == "thinking" && sample.InputTokens == 50, "Truncation and a tool output larger than the tail limit must recover at a complete record.");
        Require(new ActivityReader(folder, now.AddDays(1)).ReadLatestAt(now.AddDays(1)).HasUsage == false,
            "A new app session must not publish usage from an earlier day.");
        VerifyModelNames(Path.Combine(folder, "models"), now);
        VerifyLongContext(Path.Combine(folder, "long-context"), now);
        VerifyHistoricalCap(Path.Combine(folder, "historical-cap"), now);
        Console.WriteLine("Passed desktop filtering, tool states, partial appends, token ownership, idle aging, malformed models, progressive context recovery, reviewer exclusion, and newest-first history limits.");
    }

    private static void VerifyModelNames(string directory, DateTimeOffset now)
    {
        Directory.CreateDirectory(directory);
        string file = Path.Combine(directory, "rollout-model.jsonl");
        foreach (string model in new[] { "gpt-6.2--sol", "gpt-6.2-sol-", "gpt-6.2..sol", "gpt-" })
        {
            File.WriteAllText(file, Metadata("codex_work_desktop", "vscode") +
                Record(now, "turn_context", new { model = model }) + Event(now, "task_started"), Utf8);
            Require(new ActivityReader(directory, now.AddMinutes(-1)).ReadLatestAt(now).Model == "",
                "Malformed model separators must be rejected without a crash.");
        }
    }

    private static void VerifyLongContext(string directory, DateTimeOffset now)
    {
        Directory.CreateDirectory(directory);
        string file = Path.Combine(directory, "rollout-long.jsonl");
        string large = Record(now, "response_item", new { type = "message", role = "user", content = new string('x', 720000) });
        string tail = Record(now.AddSeconds(1), "response_item", new { type = "function_call_output", output = new string('x', 2100000) });
        File.WriteAllText(file, Metadata("codex_work_desktop", "vscode") +
            Record(now, "turn_context", new { model = "gpt-6.1-sol" }) + large +
            Record(now.AddSeconds(1), "turn_context", new { model = "gpt-6.2-sol" }) + tail +
            Event(now.AddSeconds(2), "task_started") + Token(now.AddSeconds(3), 100, 90, 5), Utf8);
        var reader = new ActivityReader(directory, now.AddMinutes(-1));
        Require(reader.ReadLatestAt(now.AddSeconds(4)).Phase == "idle", "A tail without its latest context should wait for bounded recovery.");
        ActivitySample sample = reader.ReadLatestAt(now.AddSeconds(7));
        Require(sample.Model == "GPT-6.2 Sol" && sample.Phase == "thinking" && sample.InputTokens == 100,
            "A long resumed turn should recover the nearest context instead of reusing its first model.");

        File.WriteAllText(file, Metadata("codex_work_desktop", "vscode") +
            Record(now, "turn_context", new { model = "gpt-6.1-sol" }) + large +
            Record(now.AddSeconds(1), "turn_context", new { model = "codex-auto-review" }) + tail +
            Event(now.AddSeconds(2), "task_started") + Token(now.AddSeconds(3), 100, 90, 5), Utf8);
        reader = new ActivityReader(directory, now.AddMinutes(-1));
        reader.ReadLatestAt(now.AddSeconds(4));
        Require(reader.ReadLatestAt(now.AddSeconds(7)).Phase == "idle", "A recovered reviewer context must keep its tail events private.");
    }

    private static void VerifyHistoricalCap(string directory, DateTimeOffset now)
    {
        string old = Path.Combine(directory, "2020", "01", "01");
        string recent = Path.Combine(directory, "2026", "11", "20");
        Directory.CreateDirectory(old);
        Directory.CreateDirectory(recent);
        string archived = Metadata("codex_work_desktop", "vscode") + Event(now.AddDays(-1), "task_complete");
        for (int index = 0; index < 4100; index++)
            File.WriteAllText(Path.Combine(old, "rollout-" + index.ToString("0000") + ".jsonl"), archived, Utf8);
        File.WriteAllText(Path.Combine(recent, "rollout-latest.jsonl"), Metadata("codex_work_desktop", "vscode") +
            Record(now, "turn_context", new { model = "gpt-6.2-sol" }) + Event(now, "task_started"), Utf8);
        Require(new ActivityReader(directory, now.AddMinutes(-1)).ReadLatestAt(now).Model == "GPT-6.2 Sol",
            "More than4096 old files must not crowd out the newest dated session.");
    }

    private static string Metadata(string origin, object source)
    {
        return Json.Serialize(new { type = "session_meta", payload = new { originator = origin, source = source } }) + "\n";
    }

    private static string Event(DateTimeOffset when, string kind)
    {
        return Record(when, "event_msg", new { type = kind });
    }

    private static string Token(DateTimeOffset when, int input, int cached, int output)
    {
        return Record(when, "event_msg", new { type = "token_count", info = new { last_token_usage = new
        {
            input_tokens = input, cached_input_tokens = cached, output_tokens = output
        } } });
    }

    private static string Record(DateTimeOffset when, string type, object payload)
    {
        return Json.Serialize(new { timestamp = when.ToString("O"), type = type, payload = payload }) + "\n";
    }

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }
}
