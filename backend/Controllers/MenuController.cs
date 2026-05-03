using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QrOrderSystem.Api.Data;

namespace QrOrderSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MenuController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("{restaurantId:int}")]
    public async Task<IActionResult> GetMenu(int restaurantId)
    {
        var menu = await dbContext.Categories
            .AsNoTracking()
            .Where(category => category.RestaurantId == restaurantId && category.IsActive)
            .OrderBy(category => category.DisplayOrder)
            .Select(category => new
            {
                category.Id,
                category.Name,
                category.DisplayOrder,
                Products = category.Products
                    .Where(product => product.IsAvailable)
                    .Select(product => new
                    {
                        product.Id,
                        product.Name,
                        product.Description,
                        product.Price,
                        product.ImageUrl,
                        product.Calories,
                        product.Allergens,
                        product.Ingredients,
                        product.RemovableIngredients,
                        product.EstimatedPreparationMinutes
                    })
                    .ToList()
            })
            .ToListAsync();

        return Ok(menu);
    }
}
