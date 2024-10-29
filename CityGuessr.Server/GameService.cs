using System.Diagnostics;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CityGuessr.Server
{
    public class GameService
    {
        private static readonly Random Random = new();
        private readonly List<LocationData> _gameData;
        private readonly Dictionary<Guid, User> _users = [];
        private readonly ILogger<GameService> _logger;
        private readonly object _lock = new();
        private readonly Dictionary<User, Guess> _guesses = new();
        private readonly ManualResetEventSlim _roundOver = new (false);
        private readonly ManualResetEventSlim _startNextRound = new (false);
        private readonly Stopwatch _stopwatch = new ();

        const int RoundLength = 120;

        private bool _gameRunning;
        private LocationData? _currentLocation;

        public GameService(ILogger<GameService> logger)
        {
            _logger = logger;
            using var jsonStream = new StreamReader("./Data/data.json");
            var data = JsonSerializer.Deserialize<List<LocationData>>(jsonStream.ReadToEnd());
            _gameData = data!;
        }

        public async Task HandleConnection(WebSocket webSocket)
        {
            var user = await AddUser(webSocket);

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
                        await HandleMessage(message!, user);
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

            await RemoveUser(user);
        }

        private async Task<User> AddUser(WebSocket webSocket)
        {
            var user = new User(webSocket, NameGenerator.GenerateName(), _users.Count == 0);

            try
            {
                _users.Add(user.Id, user);
                await ConfirmAdd(user);
            }
            catch (Exception ex)
            {
                _logger.LogError("Failed to add user. {}", ex);
            }

            return user;
        }

        private async Task RemoveUser(User user)
        {
            _users.Remove(user.Id);
            try
            {
                await user.Socket.CloseAsync(
                    WebSocketCloseStatus.NormalClosure,
                    string.Empty,
                    CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogError("Failed to close socket for user user. {}", ex);
            }

            if (user.IsHost && _users.Count != 0)
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

        private async Task HandleMessage(IMessage message, User user)
        {
            Func<Task> handler = message switch
            {
                Message<StartGame> => () =>
                {
                    Task.Run(RunGame);
                    return Task.CompletedTask;
                },
                Message<Guess> => async () => await RecordGuess((Message<Guess>)message, user),
                _ => () =>
                {
                    _logger.LogWarning("Unhandled message: {}", message.GetType());
                    return Task.CompletedTask;
                }
            };

            await handler();
        }

        private async Task RecordGuess(Message<Guess> message, User user)
        {
            var guess = message.Data;
            if (!_guesses.TryAdd(user, guess) && !_guesses[user].IsFinal)
            {
                _guesses[user] = guess;

                if (guess.IsFinal)
                {
                    var distance = CalculateDistance(
                        _currentLocation!.Latitude,
                        _currentLocation.Longitude,
                        guess.Latitude,
                        guess.Longitude);
                    
                    var points = (int)Math.Round(5000 * Math.Exp(-1 * distance / 1000.0));

                    Message<GuessResult> msg = new GuessResult
                    {
                        Distance = distance,
                        TargetLatitude = _currentLocation!.Latitude,
                        TargetLongitude = _currentLocation!.Longitude,
                        Points = points,
                    };

                    user.Points += points;

                    await Send(msg, [user]);

                    Message<BroadcastResult> broadcast = new BroadcastResult()
                    {
                        User = user,
                        Distance = distance,
                    };

                    await Send(broadcast, _users.Values);

                    if (_guesses.Count(x => x.Value.IsFinal) == _users.Count)
                    {
                        _roundOver.Set();
                    }
                }
            }
        }

        private static int CalculateDistance(double lat1, double long1, double lat2, double long2)
        {
            const double earthRadius = 6371; // km
            const double radiansPerDegree = Math.PI / 180;

            var dLat = (lat2 - lat1) * radiansPerDegree;
            var dLon = (long2 - long1) * radiansPerDegree;
            var a =
                Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * radiansPerDegree) * Math.Cos(lat2 * radiansPerDegree) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

            return (int)Math.Round(earthRadius * c);
        }

        private async Task RunGame()
        {
            lock (_lock)
            {
                if (_gameRunning)
                {
                    return;
                }

                _gameRunning = true;
            }

            await Send((Message<GameStarting>)new GameStarting(), _users.Values);

            Thread.Sleep(200);

            for (var i = 0; i < 3; i++)
            {
                _roundOver.Reset();
                _currentLocation = _gameData[Random.Next(_gameData.Count)];
                _guesses.Clear();
                _stopwatch.Start();

                await Send(new Message<RoundStart>()
                    {
                        Data = new RoundStart()
                        {
                            RoundNumber = i + 1,
                            RoundLength = RoundLength,
                            VideoId = _currentLocation.VideoId,
                            StartTime = _currentLocation.StartTime
                        }
                    },
                    _users.Values);

                _roundOver.Wait(TimeSpan.FromSeconds(RoundLength));
                _stopwatch.Reset();

                await Send(new Message<RoundEnd>()
                    {
                        Data = new RoundEnd()
                        {
                            Latitude = _currentLocation.Latitude,
                            Longitude = _currentLocation.Longitude,
                        }
                    },
                    _users.Values);

                _startNextRound.Wait(TimeSpan.FromSeconds(60));
            }

            lock (_lock)
            {
                _gameRunning = false;
            }
        }

        private async Task ConfirmAdd(User user)
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
                VideoId = _currentLocation!.VideoId,
                StartTime = _currentLocation!.StartTime,
                RoundLength = RoundLength - _stopwatch.Elapsed.Seconds,
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

    public class User(WebSocket socket, string name, bool isHost)
    {
        internal WebSocket Socket { get; set; } = socket;

        public Guid Id { get; init; } = Guid.NewGuid();

        public string Name { get; init; } = name;

        public int Points { get; set; }

        public bool IsHost { get; set; } = isHost;
    }

    public class LocationData
    {
        [JsonPropertyName("lat")] public double Latitude { get; set; }

        [JsonPropertyName("long")] public double Longitude { get; set; }

        [JsonPropertyName("vid")] public required string VideoId { get; set; }

        [JsonPropertyName("start")] public int StartTime { get; set; }
    }
}