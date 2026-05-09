namespace QrOrderSystem.Api.Entities;

public class RestaurantTable
{
    public int Id { get; set; }
    public int BranchId { get; set; }
    public int TableNumber { get; set; }
    public string QrCodeUrl { get; set; } = string.Empty;
    public bool IsActive { get; set; }

    public Branch Branch { get; set; } = null!;
    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public ICollection<Bill> Bills { get; set; } = new List<Bill>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ICollection<Rating> Ratings { get; set; } = new List<Rating>();
    public ICollection<TableSession> Sessions { get; set; } = new List<TableSession>();
}
