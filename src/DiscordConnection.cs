using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Pipes;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

internal sealed class DiscordConnection : IDisposable
{
    private const string ApplicationId = "1522026697908813864";
    private readonly NamedPipeClientStream pipe;
    private readonly SemaphoreSlim writes = new SemaphoreSlim(1);
    private readonly object pendingGate = new object();
    private string pendingNonce;
    private TaskCompletionSource<Dictionary<string, object>> pendingReply;
    private bool disposed;
    public Task Closed { get; private set; }

    private DiscordConnection(NamedPipeClientStream pipe) { this.pipe = pipe; }

    public static async Task<DiscordConnection> OpenAsync(CancellationToken stopping)
    {
        for (int index = 0; index < 10; index++)
        {
            stopping.ThrowIfCancellationRequested();
            var candidate = new NamedPipeClientStream(".", "discord-ipc-" + index,
                PipeDirection.InOut, PipeOptions.Asynchronous, TokenImpersonationLevel.Identification);
            try { candidate.Connect(80); }
            catch (IOException) { candidate.Dispose(); continue; }
            catch (TimeoutException) { candidate.Dispose(); continue; }
            catch (UnauthorizedAccessException) { candidate.Dispose(); continue; }
            var connection = new DiscordConnection(candidate);
            try
            {
                await connection.WaitForAsync(connection.HandshakeAsync(), stopping);
                connection.Closed = connection.ReadLoopAsync();
                return connection;
            }
            catch { connection.Dispose(); throw; }
        }
        throw new IOException("Discord desktop is unavailable.");
    }

    private async Task HandshakeAsync()
    {
        await SendJsonAsync(0, new { v = 1, client_id = ApplicationId });
        Dictionary<string, object> ready = await ReadMessageAsync();
        if (Field(ready, "evt") as string != "READY") throw new IOException("Discord handshake was rejected.");
    }

    public async Task<Dictionary<string, object>> PublishAsync(object activity, CancellationToken stopping)
    {
        var reply = new TaskCompletionSource<Dictionary<string, object>>(TaskCreationOptions.RunContinuationsAsynchronously);
        string nonce = Guid.NewGuid().ToString("N");
        lock (pendingGate)
        {
            if (disposed || pendingReply != null) throw new IOException("Discord connection is unavailable.");
            pendingNonce = nonce;
            pendingReply = reply;
        }
        try
        {
            await WaitForAsync(SendJsonAsync(1, new { cmd = "SET_ACTIVITY",
                args = new { pid = System.Diagnostics.Process.GetCurrentProcess().Id, activity }, nonce }), stopping);
            await WaitForAsync(reply.Task, stopping);
            var response = await reply.Task;
            if (Field(response, "evt") as string == "ERROR") throw new IOException("Discord rejected the update.");
            return Field(response, "data") as Dictionary<string, object>;
        }
        finally
        {
            lock (pendingGate) { pendingReply = null; pendingNonce = null; }
        }
    }

    private async Task ReadLoopAsync()
    {
        try
        {
            while (true)
            {
                var message = await ReadMessageAsync();
                lock (pendingGate)
                {
                    if (pendingReply != null && Field(message, "nonce") as string == pendingNonce)
                        pendingReply.TrySetResult(message);
                }
            }
        }
        catch (IOException) { }
        catch (ObjectDisposedException) { }
        catch (InvalidOperationException) { }
        finally
        {
            lock (pendingGate)
            {
                // Cancel an interrupted waiter without retaining an unobserved exception.
                if (pendingReply != null) pendingReply.TrySetCanceled();
            }
        }
    }

    public async Task ClearAsync()
    {
        if (disposed || Closed == null || Closed.IsCompleted) return;
        using (var timeout = new CancellationTokenSource(650))
        {
            try { await PublishAsync(null, timeout.Token); }
            catch (IOException) { }
            catch (TimeoutException) { }
            catch (OperationCanceledException) { }
        }
    }

    private async Task SendJsonAsync(int opcode, object data)
    {
        byte[] body = Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(data));
        await WriteAsync(opcode, body);
    }

    private async Task WriteAsync(int opcode, byte[] body)
    {
        var frame = new byte[8 + body.Length];
        Buffer.BlockCopy(BitConverter.GetBytes(opcode), 0, frame, 0, 4);
        Buffer.BlockCopy(BitConverter.GetBytes(body.Length), 0, frame, 4, 4);
        Buffer.BlockCopy(body, 0, frame, 8, body.Length);
        await writes.WaitAsync();
        try { await pipe.WriteAsync(frame, 0, frame.Length); }
        finally { writes.Release(); }
    }

    private async Task<Dictionary<string, object>> ReadMessageAsync()
    {
        while (true)
        {
            byte[] header = await ReadBytesAsync(8);
            int opcode = BitConverter.ToInt32(header, 0), size = BitConverter.ToInt32(header, 4);
            if (size < 0 || size > 131072 || opcode == 2) throw new IOException("Discord closed the connection.");
            byte[] body = await ReadBytesAsync(size);
            if (opcode == 3) { await WriteAsync(4, body); continue; }
            if (opcode == 4) continue;
            if (opcode != 1) throw new IOException("Unexpected Discord response.");
            try
            {
                var message = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(body));
                if (message == null) throw new IOException("Empty Discord response.");
                return message;
            }
            catch (ArgumentException error) { throw new IOException("Invalid Discord response.", error); }
            catch (InvalidOperationException error) { throw new IOException("Invalid Discord response.", error); }
        }
    }

    private async Task<byte[]> ReadBytesAsync(int count)
    {
        var buffer = new byte[count];
        int offset = 0;
        while (offset < count)
        {
            int read = await pipe.ReadAsync(buffer, offset, count - offset);
            if (read == 0) throw new EndOfStreamException();
            offset += read;
        }
        return buffer;
    }

    private async Task WaitForAsync(Task operation, CancellationToken stopping)
    {
        if (await Task.WhenAny(operation, Task.Delay(4500, stopping)) != operation)
        {
            Dispose();
            ObserveFailure(operation);
            stopping.ThrowIfCancellationRequested();
            throw new TimeoutException("Discord response timed out.");
        }
        try { await operation; }
        catch (TaskCanceledException)
        {
            stopping.ThrowIfCancellationRequested();
            throw new IOException("Discord disconnected during the update.");
        }
    }

    internal static object Field(Dictionary<string, object> record, string key)
    {
        object value;
        return record != null && record.TryGetValue(key, out value) ? value : null;
    }

    private static void ObserveFailure(Task operation)
    {
        operation.ContinueWith(failed => failed.Exception.Handle(e => true), TaskContinuationOptions.OnlyOnFaulted);
    }

    public void Dispose()
    {
        lock (pendingGate)
        {
            if (disposed) return;
            disposed = true;
            pipe.Dispose();
            if (pendingReply != null) pendingReply.TrySetCanceled();
        }
    }
}
