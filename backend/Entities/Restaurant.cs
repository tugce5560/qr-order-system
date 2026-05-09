namespace QrOrderSystem.Api.Entities;

public class Restaurant
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string? PrimaryColor { get; set; }
    public string? SecondaryColor { get; set; }
    public string? AccentColor { get; set; }
    public string? MenuBackgroundColor { get; set; }
    public string? ButtonColor { get; set; }
    public string City { get; set; } = string.Empty;
    public string Status { get; set; } = "Active";
    public string Plan { get; set; } = "Basic";
    public DateTime? SubscriptionEndsAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public ICollection<Branch> Branches { get; set; } = new List<Branch>();
    public ICollection<Category> Categories { get; set; } = new List<Category>();
    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ICollection<AppUser> Users { get; set; } = new List<AppUser>();
    public ICollection<TableSession> TableSessions { get; set; } = new List<TableSession>();
}
