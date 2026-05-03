namespace QrOrderSystem.Api.Entities;

public class Category
{
    public int Id { get; set; }
    public int RestaurantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; }

    public Restaurant Restaurant { get; set; } = null!;
    public ICollection<Product> Products { get; set; } = new List<Product>();
}
