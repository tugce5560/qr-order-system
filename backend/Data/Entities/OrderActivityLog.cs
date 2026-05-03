namespace QrOrderSystem.Api.Entities;

public class OrderActivityLog
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int? UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? OldSummary { get; set; }
    public string? NewSummary { get; set; }
    public DateTime CreatedAt { get; set; }

    public Order? Order { get; set; }
    public AppUser? User { get; set; }
}