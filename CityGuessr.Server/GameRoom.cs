using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace CityGuessr.Server;

public class GameRoom
{
    private readonly ILogger<GameRoom> _logger;
    private readonly GameService _gameService;
    private readonly Dictionary<Guid, User> _users = [];

    public GameRoom(ILogger<GameRoom> logger, GameService gameService)
    {
        _logger = logger;
        _gameService = gameService;
    }

    public async Task JoinRoom(string userName, Guid userId, WebSocket webSocket)
    {
        var user = await AddUser(userName, userId, webSocket);
        
        try
        {
            while (webSocket.State == WebSocketState.Open)
            {
                var buffer = new byte[1024];
                await webSocket.ReceiveAsync(buffer, CancellationToken.None);
                var messageString = Encoding.UTF8.GetString(buffer).TrimEnd('\0');

                if (!string.IsNullOrEmpty(messageString))
                {
                    var message = JsonSerializer.Deserialize<IMessage>(messageString,
                        new JsonSerializerOptions()
                        {
                            Converters = { new MessageConvertor() },
                            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                        });

                    _logger.LogDebug("Received message: {message}", message);
                    // await HandleMessage(message!, user);
                }
                else
                {
                    _logger.LogDebug("Received empty message");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError("Failed to handle response. {}", ex);
        }

        await UserDisconnected(user);
    }
    
    private async Task<User> AddUser(string username, Guid userId, WebSocket webSocket)
    {
        if (_users.TryGetValue(userId, out var existingUser))
        {
            if (existingUser.Name == username && existingUser.Socket.State != WebSocketState.Open)
            {
                _logger.LogInformation("User {userName} has re-joined", username);
                existingUser.Socket = webSocket;
                
                await ConfirmJoin(existingUser);

                return existingUser;
            }
            
            _logger.LogInformation("User {userName} attempted to join with existing ID", username);
        }

        var user = new User(webSocket, username, _users.Count == 0);

        try
        {
            _users.Add(user.Id, user);
            await ConfirmJoin(user);
        }
        catch (Exception ex)
        {
            _logger.LogError("Failed to add user. {}", ex);
        }

        return user;
    }
    
    private async Task UserDisconnected(User user)
    {
        await user.Socket.CloseAsync(WebSocketCloseStatus.NormalClosure, string.Empty, CancellationToken.None);

        if (user.IsHost)
        {
            var remaining = _users.Values.Where(x => x.Socket.State == WebSocketState.Open).ToList();

            if (remaining.Count > 0)
            {
                var newHost = remaining.First();
                newHost.IsHost = true;
                user.IsHost = false;

                var message = new Message<ConfirmUsername>
                {
                    Data = newHost,
                };

                await Send(message, [newHost]);
            }
        }

        var updateMessage = new Message<UpdatePlayers>
        {
            Data = new UpdatePlayers(_users.Values),
        };

        await Send(updateMessage, _users.Values);
    }
    
    private async Task ConfirmJoin(User user)
    {
        var message = new Message<ConfirmUsername>
        {
            Data = user,
        };

        await Send(message, [user]);

        await Send((Message<UpdatePlayers>)new UpdatePlayers(_users.Values), _users.Values);
        
    }
    
    private static async Task Send(IMessage message, IEnumerable<User> users)
    {
        var stringAsBytes = Encoding.ASCII.GetBytes(message.ToJson());

        foreach (var user in users.Where(x => x.Socket.State == WebSocketState.Open))
        {
            var byteArraySegment = new ArraySegment<byte>(stringAsBytes, 0, stringAsBytes.Length);
            await user.Socket.SendAsync(byteArraySegment, WebSocketMessageType.Text, true, CancellationToken.None);
        }
    }
}