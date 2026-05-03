using QrOrderSystem.Api.Enums;

namespace QrOrderSystem.Api.Entities;

public class Bill
{
    public int Id { get; set; }
    public int RestaurantId { get; set; }
    public int TableId { get; set; }
    public string BillNumber { get; set; } = string.Empty;
    public BillStatus Status { get; set; }
    public decimal SubTotal { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal GrandTotal { get; set; }
    public decimal TotalAmount { get; set; }
    public PaymentMethod? PaymentMethod { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime OpenedAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime? ClosedAt { get; set; }

    public Restaurant Restaurant { get; set; } = null!;
    public RestaurantTable Table { get; set; } = null!;
    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}
