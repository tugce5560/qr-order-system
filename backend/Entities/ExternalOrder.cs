using QrOrderSystem.Api.Enums;

namespace QrOrderSystem.Api.Entities;

public class ExternalOrder
{
    public int Id { get; set; }
    public int RestaurantId { get; set; }
    public int BranchId { get; set; }
    public ExternalOrderPlatform Platform { get; set; }
    public string ExternalOrderId { get; set; } = string.Empty;
    public string ExternalStatus { get; set; } = string.Empty;
    public string RawPayloadJson { get; set; } = string.Empty;
    public string? NormalizedPayloadJson { get; set; }
    public int? InternalOrderId { get; set; }
    public string? CustomerName { get; set; }
    public string? CustomerPhone { get; set; }
    public string? DeliveryAddress { get; set; }
    public decimal TotalAmount { get; set; }
    public string Currency { get; set; } = "TRY";
    public string? ErrorMessage { get; set; }
    public ExternalOrderStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? ImportedAt { get; set; }

    public Restaurant Restaurant { get; set; } = null!;
    public Branch Branch { get; set; } = null!;
    public Order? InternalOrder { get; set; }
}
