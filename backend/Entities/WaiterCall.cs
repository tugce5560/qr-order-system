namespace QrOrderSystem.Api.Entities;

public class WaiterCall
{
    public int Id { get; set; }
    public int RestaurantId { get; set; }
    public int TableId { get; set; }
    public string Status { get; set; } = "Pending";
    public string? Message { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public int? ResolvedByUserId { get; set; }

    public Restaurant Restaurant { get; set; } = null!;
    public RestaurantTable Table { get; set; } = null!;
    public AppUser? ResolvedByUser { get; set; }
}
