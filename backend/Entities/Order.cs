using QrOrderSystem.Api.Enums;

namespace QrOrderSystem.Api.Entities;

public class Order
{
    public int Id { get; set; }
    public int RestaurantId { get; set; }
    public int BranchId { get; set; }
    public int TableId { get; set; }
    public int? BillId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public OrderStatus Status { get; set; }
    public OrderSource Source { get; set; }
    public decimal TotalAmount { get; set; }
    public PaymentStatus? PaymentStatus { get; set; }
    public PaymentProvider? PaymentProvider { get; set; }
    public bool IsPaid { get; set; }
    public string? ExternalPlatform { get; set; }
    public string? ExternalOrderId { get; set; }
    public string? ExternalRawOrderId { get; set; }
    public string? ExternalStatus { get; set; }
    public string? ExternalCustomerName { get; set; }
    public string? ExternalCustomerPhone { get; set; }
    public string? ExternalDeliveryAddress { get; set; }
    public string? ExternalNote { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? PreparingAt { get; set; }
    public DateTime? ReadyAt { get; set; }
    public DateTime? ServedAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime? CancelledAt { get; set; }

    public Restaurant Restaurant { get; set; } = null!;
    public Branch Branch { get; set; } = null!;
    public RestaurantTable Table { get; set; } = null!;
    public Bill? Bill { get; set; }
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}
