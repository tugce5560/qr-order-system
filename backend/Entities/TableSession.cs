namespace QrOrderSystem.Api.Entities;

public class TableSession
{
    public int Id { get; set; }
    public int RestaurantId { get; set; }
    public int TableId { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool IsActive { get; set; }
    public DateTime? LastOrderAt { get; set; }

    public Restaurant Restaurant { get; set; } = null!;
    public RestaurantTable Table { get; set; } = null!;
}
