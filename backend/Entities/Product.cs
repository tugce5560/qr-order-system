namespace QrOrderSystem.Api.Entities;

public class Product
{
    public int Id { get; set; }
    public int CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public string? ImageUrl { get; set; }
    public int? Calories { get; set; }
    public string? Allergens { get; set; }
    public string? Ingredients { get; set; }
    public string? RemovableIngredients { get; set; }
    public int? EstimatedPreparationMinutes { get; set; }
    public bool IsAvailable { get; set; }
    public DateTime CreatedAt { get; set; }

    public Category Category { get; set; } = null!;
    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}
