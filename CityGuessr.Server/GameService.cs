using CityGuessr.Server;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CityGuesser.Server
{
    public class GameService
    {
        private static Random Random = new Random();
        private readonly List<LocationData> _gameData;
        private readonly Dictionary<Guid, User> _users = [];
        private readonly ILogger<GameService> _logger;
        private readonly object _lock = new object();

        private bool _gameRunning = false;
        private LocationData _currentLocation;

        public GameService(ILogger<GameService> logger)
        {
            _logger = logger;
            using var jsonStream = new StreamReader("./Data/data.json");
            var data = JsonSerializer.Deserialize<List<LocationData>>(jsonStream.ReadToEnd());
            _gameData = data!;
        }

        public async Task AddUser(WebSocket webSocket)
        {
            var user = new User()
            {
                Id = Guid.NewGuid(),
                Name = $"Player {_users.Count + 1}",
                Socket = webSocket,
                IsHost = !_users.Any()
            };

            try
            {
                _users.Add(user.Id, user);
                await ConfirmAdd(user, webSocket);
            }
            catch (Exception ex)
            {
                _logger.LogError("Failed to add user. {}", ex);
            }

            try
            {
                while (webSocket.State == WebSocketState.Open)
                {
                    var buffer = new byte[1024];
                    var response = await webSocket.ReceiveAsync(buffer, CancellationToken.None);
                    var messageString = Encoding.UTF8.GetString(buffer).TrimEnd('\0');

                    if (!string.IsNullOrEmpty(messageString))
                    {
                        var message = JsonSerializer.Deserialize<IMessage>(messageString, new JsonSerializerOptions() { Converters = { new MessageConvertor() } });
                        await HandleMessage(message!);
                    }
                    else
                    {
                        _logger.LogDebug("Recieved empty message");
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError("Failed to handle response. {}", ex);
            }
            _users.Remove(user.Id);
            await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, string.Empty, CancellationToken.None);
            if (user.IsHost && _users.Any())
            {
                var newHost = _users.Values.First();
                newHost.IsHost = true;

                var message = new Message<ConfirmUsername>
                {
                    Data = newHost,
                };

                await Send(message, [newHost]);
            }

            var updateMessage = new Message<UpdatePlayers>
            {
                Data = new UpdatePlayers(_users.Values),
            };

            await Send(updateMessage, _users.Values);
        }

        private Task HandleMessage(IMessage message)
        {
            // no-op
            if (message is Message<StartGame>)
            {
                Task.Run(RunGame);
            }

            return Task.CompletedTask;
        }

        private async Task RunGame()
        {
            lock(_lock)
            {
                if (_gameRunning)
                {
                    return;
                }
                _gameRunning = true;
            }

            await Send((Message<GameStarting>)new GameStarting(), _users.Values);

            Thread.Sleep(3000);

            const int roundLength = 120;

            for (var i = 0; i < 3; i++)
            {
                _currentLocation = _gameData[Random.Next(_gameData.Count)];

                await Send(new Message<RoundStart>()
                {
                    Data = new RoundStart()
                    {
                        RoundNumber = i + 1,
                        RoundLength = roundLength,
                        VideoId = _currentLocation.VideoId,
                        StartTime = _currentLocation.StartTime
                    }
                },
                _users.Values);

                Thread.Sleep(roundLength * 1000);
                await Send(new Message<RoundEnd>()
                {
                    Data = new RoundEnd()
                    {
                        Latitude = _currentLocation.Latitude,
                        Longitude = _currentLocation.Longitude,
                    }
                },
                _users.Values);
            }

            lock(_lock)
            {
                _gameRunning = false;
            }
        }

        private async Task ConfirmAdd(User user, WebSocket webSocket)
        {
            var message = new Message<ConfirmUsername>
            {
                Data = user,
            };

            await Send(message, [user]);

            await Send((Message<UpdatePlayers>)new UpdatePlayers(_users.Values), _users.Values);

            lock (_lock)
            {
                if (!_gameRunning)
                {
                    return;
                }
            }

            Message<GameRunning> joinMsg = new GameRunning()
            {
                VideoId = _currentLocation.VideoId,
                StartTime = _currentLocation!.StartTime,
            };

            await Send(joinMsg, [user]);
        }

        private async Task Send(IMessage message, IEnumerable<User> users)
        {
            var stringAsBytes = Encoding.ASCII.GetBytes(message.ToJson());

            foreach (var user in users.Where(x => x.Socket.State == WebSocketState.Open))
            {
                var byteArraySegment = new ArraySegment<byte>(stringAsBytes, 0, stringAsBytes.Length);
                await user.Socket.SendAsync(byteArraySegment, WebSocketMessageType.Text, true, CancellationToken.None);
            }
        }
    }

    public class User
    {
        internal WebSocket Socket { get; init; }

        public Guid Id { get; init; }

        public string Name { get; init; }

        public int Points { get; set; }

        public bool IsHost { get; set; }
    }

    public class LocationData
    {
        [JsonPropertyName("lat")]
        public double Latitude { get; set; }

        [JsonPropertyName("long")]
        public double Longitude { get; set; }

        [JsonPropertyName("vid")]
        public required string VideoId { get; set; }

        [JsonPropertyName("start")]
        public int StartTime { get; set; }
    }
}