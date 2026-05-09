using QrOrderSystem.Api.Enums;

namespace QrOrderSystem.Api.Entities;

public class Payment
{
    public int Id { get; set; }
    public int? OrderId { get; set; }
    public int RestaurantId { get; set; }
    public int? TableId { get; set; }
    public int? BillId { get; set; }
    public PaymentProvider Provider { get; set; }
    public PaymentStatus Status { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "TRY";
    public string? TransactionId { get; set; }
    public string? ProviderPaymentId { get; set; }
    public string? Token { get; set; }
    public string? PaymentUrl { get; set; }
    public string? ErrorMessage { get; set; }
    public string Method { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? PaidAt { get; set; }

    public Order? Order { get; set; }
    public Restaurant Restaurant { get; set; } = null!;
    public RestaurantTable? Table { get; set; }
    public Bill? Bill { get; set; }
}
