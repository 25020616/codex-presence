using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Pipes;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

internal static class RuntimeChecks
{
    public static void Main()
    {
        var sample = new ActivitySample { Phase = "coding", Model = "GPT-6.2 Sol", HasUsage = true,
            InputTokens = 76700, CachedTokens = 75000, OutputTokens = 600 };
        var settings = new PresenceSettings();
        var view = PresenceCard.Compose(sample, settings, 1794459653);
        Assert(view.Details == "Writing code · GPT-6.2 Sol" && view.State == "2.3k fresh · 97% cache", "Detailed card math");
        settings.Classic = true;
        view = PresenceCard.Compose(sample, settings, 1794459653);
        Assert(view.Details == "2.3k fresh tokens" && view.State == "97% from cache", "Classic format compatibility");
        settings.Classic = false;
        settings.ShowModel = false;
        settings.Animated = false;
        view = PresenceCard.Compose(sample, settings, 1794459653);
        Assert(view.Details == "Writing code", "Hidden model");
        var payload = PresenceCard.Payload(view);
        Assert((string)((Dictionary<string, object>)payload["assets"])["large_image"] == "codex", "Static artwork");
        CheckRpc(view, false).GetAwaiter().GetResult();
        CheckRpc(view, true).GetAwaiter().GetResult();
        Console.WriteLine("Passed real card math, classic/model/art switches, RPC acknowledgement, PING/PONG, clear, and disconnect recovery.");
    }

    private static async Task CheckRpc(PresenceView view, bool disconnect)
    {
        string name = @"LOCAL\CodexPresence.Check." + Guid.NewGuid().ToString("N");
        using (var server = new NamedPipeServerStream(name, PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous))
        using (var client = new NamedPipeClientStream(".", name, PipeDirection.InOut, PipeOptions.Asynchronous))
        {
            Task accepted = server.WaitForConnectionAsync();
            client.Connect(2000);
            await accepted;
            var constructor = typeof(DiscordConnection).GetConstructor(BindingFlags.Instance | BindingFlags.NonPublic,
                null, new[] { typeof(NamedPipeClientStream) }, null);
            using (var connection = (DiscordConnection)constructor.Invoke(new object[] { client }))
            {
                Task loop = (Task)typeof(DiscordConnection).GetMethod("ReadLoopAsync", BindingFlags.Instance | BindingFlags.NonPublic).Invoke(connection, null);
                typeof(DiscordConnection).GetProperty("Closed").SetValue(connection, loop, null);
                Task serverSide = Task.Run(async () =>
                {
                    var request = await Receive(server);
                    Assert((string)request["cmd"] == "SET_ACTIVITY", "Publish command");
                    string nonce = (string)request["nonce"];
                    if (disconnect) { server.Dispose(); return; }
                    var args = (Dictionary<string, object>)request["args"];
                    var activity = (Dictionary<string, object>)args["activity"];
                    Assert((string)activity["details"] == view.Details && (string)activity["state"] == view.State, "Published live fields");
                    await Send(server, 3, new { probe = true });
                    var pongHeader = await Read(server, 8);
                    Assert(BitConverter.ToInt32(pongHeader, 0) == 4, "PING/PONG");
                    await Read(server, BitConverter.ToInt32(pongHeader, 4));
                    await Send(server, 1, new { cmd = "SET_ACTIVITY", nonce, data = activity });
                    var clear = await Receive(server);
                    var clearArgs = (Dictionary<string, object>)clear["args"];
                    Assert(clearArgs["activity"] == null, "Explicit activity clearing");
                    await Send(server, 1, new { cmd = "SET_ACTIVITY", nonce = clear["nonce"], data = (object)null });
                });
                bool disconnected = false;
                try
                {
                    var reply = await connection.PublishAsync(PresenceCard.Payload(view), CancellationToken.None);
                    Assert(!disconnect && (string)reply["details"] == view.Details, "Acknowledgement");
                }
                catch (IOException) { disconnected = true; }
                Assert(disconnected == disconnect, "Recoverable disconnect");
                if (!disconnect) await connection.ClearAsync();
                await serverSide;
                connection.Dispose();
                Assert(await Task.WhenAny(loop, Task.Delay(2000)) == loop, "Clean listener shutdown");
            }
        }
    }

    private static async Task Send(Stream stream, int op, object value)
    {
        byte[] data = Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(value));
        var bytes = new byte[8 + data.Length];
        Buffer.BlockCopy(BitConverter.GetBytes(op), 0, bytes, 0, 4);
        Buffer.BlockCopy(BitConverter.GetBytes(data.Length), 0, bytes, 4, 4);
        Buffer.BlockCopy(data, 0, bytes, 8, data.Length);
        await stream.WriteAsync(bytes, 0, bytes.Length);
    }

    private static async Task<Dictionary<string, object>> Receive(Stream stream)
    {
        var header = await Read(stream, 8);
        Assert(BitConverter.ToInt32(header, 0) == 1, "Expected frame");
        return new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(await Read(stream, BitConverter.ToInt32(header, 4))));
    }

    private static async Task<byte[]> Read(Stream stream, int size)
    {
        var bytes = new byte[size];
        int used = 0;
        while (used < size)
        {
            int count = await stream.ReadAsync(bytes, used, size - used);
            if (count == 0) throw new EndOfStreamException();
            used += count;
        }
        return bytes;
    }

    private static void Assert(bool success, string message)
    {
        if (!success) throw new InvalidOperationException(message);
    }
}
