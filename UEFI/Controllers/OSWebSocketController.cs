using System.Net.WebSockets;
using Arasaki.Sockets;
using Arasaki.Sockets.Json;
using Microsoft.AspNetCore.Mvc;

namespace Arasaki.UEFI.Controllers;

public class OSWebSocketController : ControllerBase
{
    [HttpGet("/os")]
    public async Task Get()
    {
        if (HttpContext.WebSockets.IsWebSocketRequest)
        {
            ArasakiSocket<WebSocket> socket = new(await HttpContext.WebSockets.AcceptWebSocketAsync());
            await socket.Receive<JsonUpdateSize>(obj => 
            {
                Console.WriteLine(obj.Size);
            });
        }
        else HttpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
    }
}
