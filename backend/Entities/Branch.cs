namespace QrOrderSystem.Api.Entities;

public class Branch
{
    public int Id { get; set; }
    public int RestaurantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;

    public Restaurant Restaurant { get; set; } = null!;
    public ICollection<RestaurantTable> Tables { get; set; } = new List<RestaurantTable>();
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
