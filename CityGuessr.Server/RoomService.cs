using System.Net.WebSockets;

namespace CityGuessr.Server;

public class RoomService
{
    private readonly RoomFactory _roomFactory;
    private readonly SemaphoreSlim _roomSemaphore = new(1, 1);
    private Dictionary<string, GameRoom> _rooms = new();

    public RoomService(RoomFactory roomFactory)
    {
        _roomFactory = roomFactory;
    }

    public async Task JoinRoom(string room, WebSocket webSocket, string username, Guid userId)
    {
        if (!_rooms.ContainsKey(room))
        {
            await webSocket.CloseAsync(WebSocketCloseStatus.EndpointUnavailable, "No room found", CancellationToken.None);
            return;
        }

        await _rooms[room].JoinRoom(username, userId, webSocket);
    }

    public async Task<Result> CreateRoom(string room)
    {
        await _roomSemaphore.WaitAsync();
        if (_rooms.ContainsKey(room))
        {
            return Result.Error("Room already exists");
        }

        var gameRoom = _roomFactory.Create();
        _rooms.Add(room, gameRoom);
        _roomSemaphore.Release();

        return Result.Success();
    }
}

public class Result
{
    private readonly bool _success;
    private readonly string _error;
    private Result()
    {
        _success = true;
        _error = string.Empty;
    }

    private Result(string error)
    {
        _success = false;
        _error = error;
    }

    public T Map<T>(Func<T> successFunc, Func<string, T> errorFunc)
    {
        if (_success)
        {
            return successFunc();
        }
        return errorFunc(_error);
    }
    
    public static Result Success() => new();
    public static Result Error(string message) => new(message);
}

public class RoomFactory(ILogger<GameRoom> logger, GameService gameService)
{
    public GameRoom Create()
    {
        return new GameRoom(logger, gameService);
    }
}