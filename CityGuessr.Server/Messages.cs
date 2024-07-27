using CityGuesser.Server;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CityGuessr.Server
{
    public interface IMessage
    {
        public string ToJson();
    }

    public class Message<T> : IMessage
    {
        public string MessageType => Data.GetType().Name;
        public T Data { get; set; }

        public string ToJson()
        {
            return JsonSerializer.Serialize(this, new JsonSerializerOptions() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        }

        public static IMessage Deserialize(string json)
        {
            return null;
        }

        public static implicit operator Message<T>(T data) => new Message<T>()
        {
            Data = data,
        };

    }

    public class UpdatePlayers : List<User>
    {
        public UpdatePlayers(IEnumerable<User> users) : base(users) { }
    }

    public class GameRunning
    {
        public string VideoId { get; set; }
        public int StartTime { get; set; }
    }

    public class GameStarting
    {
    }

    public class ConfirmUsername
    {
        public string Name { get; set; }
        public Guid Id { get; set; }

        public bool IsHost { get; set; }

        public static implicit operator ConfirmUsername(User user) => new ConfirmUsername()
        { 
            Name = user.Name, 
            Id = user.Id, 
            IsHost = user.IsHost 
        };
    }

    public class StartGame
    {
    }

    public class RoundStart
    {
        public int RoundNumber { get; set; }
        public int RoundLength { get; set; }
        public string VideoId { get; set; }
        public int StartTime { get; set; }
    }

    public class RoundEnd
    {
        public double Longitude { get; set; }
        public double Latitude { get; set; }
    }

    public class MessageConvertor : JsonConverter<IMessage>
    {
        private static readonly JsonEncodedText TypeProperty = JsonEncodedText.Encode("messageType");
        private static readonly JsonEncodedText DataProperty = JsonEncodedText.Encode("data");

        public override bool CanConvert(Type type)
        {
            return typeof(IMessage).IsAssignableFrom(type);
        }

        public override IMessage Read(
            ref Utf8JsonReader reader,
            Type typeToConvert,
            JsonSerializerOptions options)
        {
            using var doc = JsonDocument.ParseValue(ref reader);

            if (!doc.RootElement.TryGetProperty(TypeProperty.EncodedUtf8Bytes, out var typeElement))
            {
                throw new JsonException();
            }

            if (!doc.RootElement.TryGetProperty(DataProperty.EncodedUtf8Bytes, out var dataElement))
            {
                throw new JsonException();
            }

            var type = typeElement.GetString();
            if (string.IsNullOrEmpty(type))
            {
                throw new JsonException("No type provided");
            }

            if (type == typeof(StartGame).Name)
            {
                return DeserializeData<StartGame>(dataElement);
            }

            throw new JsonException("Unsupported message type");
        }

        private static Message<T> DeserializeData<T>(JsonElement element)
        {
            return new Message<T>()
            { 
                Data = element.Deserialize<T>(),
            };
        }

        public override void Write(
           Utf8JsonWriter writer,
           IMessage value,
           JsonSerializerOptions options)
        {
            throw new NotImplementedException();
        }
    }
}
