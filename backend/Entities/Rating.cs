namespace QrOrderSystem.Api.Entities;

public class Rating
{
    public int Id { get; set; }
    public int TableId { get; set; }
    public int Speed { get; set; }
    public int Taste { get; set; }
    public int Service { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public RestaurantTable Table { get; set; } = null!;
}
