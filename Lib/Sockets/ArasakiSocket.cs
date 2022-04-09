using System.Net.WebSockets;
using System.Text;
using Arasaki.Sockets.Json;
using Newtonsoft.Json;

namespace Arasaki.Sockets;

public class ArasakiSocket<T> where T : WebSocket
{
    private readonly T Socket;

    public ArasakiSocket(T socket)
    {
        Socket = socket;
    }

    public async Task Connect()
    {
#if DEBUG
        await (Socket as ClientWebSocket).ConnectAsync(new Uri("wss://localhost:7107/os"), CancellationToken.None);
#else
        await (Socket as ClientWebSocket).ConnectAsync(new Uri("wss://arasaki.xyz/os"), CancellationToken.None);
#endif
    }

    public async Task Send<J>(J send) where J : JsonSocket
    {
        byte[] buffer = Encoding.Unicode.GetBytes(JsonConvert.SerializeObject(send));
        byte[] CLbuffer = Encoding.Unicode.GetBytes("CL" + buffer.Length);
        await Socket.SendAsync(new(CLbuffer, 0, CLbuffer.Length), WebSocketMessageType.Text, true, CancellationToken.None);
        await Socket.SendAsync(new(buffer, 0, buffer.Length), WebSocketMessageType.Text, true, CancellationToken.None);
    }

    public async Task Receive<J>(Action<J> receive) where J : JsonSocket
    {
        byte[] buffer = new byte[64];
        while (!Socket.CloseStatus.HasValue)
        {
            WebSocketReceiveResult receiveResult = await Socket.ReceiveAsync(new(buffer), CancellationToken.None);
            if (receiveResult.MessageType == WebSocketMessageType.Text && receiveResult.EndOfMessage == true)
            {
                string msg = Encoding.Unicode.GetString(buffer);
                if (msg.StartsWith("CL")) buffer = new byte[int.Parse(msg[2..])];
                else receive(JsonConvert.DeserializeObject<J>(msg));
            }
        }
    }

    public void Close() => Socket.CloseAsync(WebSocketCloseStatus.NormalClosure, string.Empty, CancellationToken.None);
}
