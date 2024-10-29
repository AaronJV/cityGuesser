using Microsoft.AspNetCore.Mvc;
using System.Net.WebSockets;

namespace CityGuessr.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class GameController : ControllerBase
    {
        private readonly RoomService _roomService;

        public GameController(RoomService roomService)
        {
            _roomService = roomService;
        }

        [HttpPost("{roomId}")]
        public async Task<ActionResult> CreateRoom(string roomId)
        {
            try
            {
                return (await _roomService.CreateRoom(roomId).ConfigureAwait(false))
                    .Map<ActionResult>(Created, Conflict);
            }
            catch (Exception e)
            {
                Console.WriteLine(e);
                return StatusCode(500);
            }
        }

        [ApiExplorerSettings(IgnoreApi = true)]
        [Route("{room}")]
        public async Task Get(
            string room,
            [FromQuery]
            string username,
            [FromQuery]
            Guid userId)
        {
            if (HttpContext.WebSockets.IsWebSocketRequest)
            {
                var webSocket = await HttpContext.WebSockets.AcceptWebSocketAsync();
                
                await _roomService.JoinRoom(room, webSocket, username, userId);
            }
            else
            {
                HttpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
            }
        }
    }
}
