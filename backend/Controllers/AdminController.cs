using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QrOrderSystem.Api.Data;
using QrOrderSystem.Api.Entities;
using QrOrderSystem.Api.Enums;

namespace QrOrderSystem.Api.Controllers;

[ApiController]
[Authorize(Roles = "RestaurantAdmin")]
[Route("api/[controller]")]
public class AdminController(AppDbContext dbContext, IWebHostEnvironment environment) : ControllerBase
{
    [HttpGet("restaurant")]
    public async Task<IActionResult> GetRestaurant()
    {
        var restaurantId = GetRestaurantId();

        var restaurant = await dbContext.Restaurants
            .AsNoTracking()
            .Where(restaurant => restaurant.Id == restaurantId)
            .Select(restaurant => new
            {
                restaurant.Id,
                restaurant.Name,
                restaurant.Slug,
                restaurant.LogoUrl,
                restaurant.PrimaryColor,
                restaurant.SecondaryColor,
                restaurant.AccentColor,
                restaurant.MenuBackgroundColor,
                restaurant.ButtonColor
            })
            .FirstOrDefaultAsync();

        if (restaurant is null)
        {
            return NotFound();
        }

        return Ok(restaurant);
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        var restaurantId = GetRestaurantId();

        var categories = await dbContext.Categories
            .AsNoTracking()
            .Where(category => category.RestaurantId == restaurantId)
            .OrderBy(category => category.DisplayOrder)
            .Select(category => new
            {
                category.Id,
                category.Name,
                category.DisplayOrder,
                category.IsActive
            })
            .ToListAsync();

        return Ok(categories);
    }

    [HttpPost("categories")]
    public async Task<IActionResult> CreateCategory(CategoryRequest request)
    {
        var restaurantId = GetRestaurantId();

        var category = new Category
        {
            RestaurantId = restaurantId,
            Name = request.Name,
            DisplayOrder = request.DisplayOrder,
            IsActive = true
        };

        dbContext.Categories.Add(category);
        await dbContext.SaveChangesAsync();

        return Ok(category);
    }

    [HttpPut("categories/{id:int}")]
    public async Task<IActionResult> UpdateCategory(int id, CategoryRequest request)
    {
        var restaurantId = GetRestaurantId();

        var category = await dbContext.Categories
            .FirstOrDefaultAsync(category =>
                category.Id == id && category.RestaurantId == restaurantId);

        if (category is null)
        {
            return NotFound();
        }

        category.Name = request.Name;
        category.DisplayOrder = request.DisplayOrder;
        category.IsActive = request.IsActive;

        await dbContext.SaveChangesAsync();

        return Ok(category);
    }

    [HttpDelete("categories/{id:int}")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        var restaurantId = GetRestaurantId();

        var category = await dbContext.Categories
            .FirstOrDefaultAsync(category =>
                category.Id == id && category.RestaurantId == restaurantId);

        if (category is null)
        {
            return NotFound();
        }

        dbContext.Categories.Remove(category);
        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("products")]
    public async Task<IActionResult> GetProducts()
    {
        var restaurantId = GetRestaurantId();

        var products = await dbContext.Products
            .AsNoTracking()
            .Where(product => product.Category.RestaurantId == restaurantId)
            .OrderBy(product => product.Name)
            .Select(product => new
            {
                product.Id,
                product.CategoryId,
                product.Name,
                product.Description,
                product.Price,
                product.ImageUrl,
                product.Calories,
                product.Allergens,
                product.Ingredients,
                product.RemovableIngredients,
                product.EstimatedPreparationMinutes,
                product.IsAvailable
            })
            .ToListAsync();

        return Ok(products);
    }

    [HttpPost("products")]
    public async Task<IActionResult> CreateProduct(ProductRequest request)
    {
        var restaurantId = GetRestaurantId();

        var categoryExists = await dbContext.Categories
            .AnyAsync(category =>
                category.Id == request.CategoryId &&
                category.RestaurantId == restaurantId);

        if (!categoryExists)
        {
            return BadRequest("Category not found.");
        }

        var product = new Product
        {
            CategoryId = request.CategoryId,
            Name = request.Name,
            Description = request.Description,
            Price = request.Price,
            ImageUrl = request.ImageUrl,
            Calories = request.Calories,
            Allergens = request.Allergens,
            Ingredients = request.Ingredients,
            RemovableIngredients = request.RemovableIngredients,
            EstimatedPreparationMinutes = request.EstimatedPreparationMinutes,
            IsAvailable = true,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Products.Add(product);
        await dbContext.SaveChangesAsync();

        return Ok(product);
    }

    [HttpPut("products/{id:int}")]
    public async Task<IActionResult> UpdateProduct(int id, ProductRequest request)
    {
        var restaurantId = GetRestaurantId();

        var product = await dbContext.Products
            .Include(product => product.Category)
            .FirstOrDefaultAsync(product =>
                product.Id == id && product.Category.RestaurantId == restaurantId);

        if (product is null)
        {
            return NotFound();
        }

        var categoryExists = await dbContext.Categories
            .AnyAsync(category =>
                category.Id == request.CategoryId &&
                category.RestaurantId == restaurantId);

        if (!categoryExists)
        {
            return BadRequest("Category not found.");
        }

        product.CategoryId = request.CategoryId;
        product.Name = request.Name;
        product.Description = request.Description;
        product.Price = request.Price;
        product.ImageUrl = request.ImageUrl;
        product.Calories = request.Calories;
        product.Allergens = request.Allergens;
        product.Ingredients = request.Ingredients;
        product.RemovableIngredients = request.RemovableIngredients;
        product.EstimatedPreparationMinutes = request.EstimatedPreparationMinutes;
        product.IsAvailable = request.IsAvailable;

        await dbContext.SaveChangesAsync();

        return Ok(product);
    }

    [HttpDelete("products/{id:int}")]
    public async Task<IActionResult> DeleteProduct(int id)
    {
        var restaurantId = GetRestaurantId();

        var product = await dbContext.Products
            .Include(product => product.Category)
            .FirstOrDefaultAsync(product =>
                product.Id == id && product.Category.RestaurantId == restaurantId);

        if (product is null)
        {
            return NotFound();
        }

        dbContext.Products.Remove(product);
        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("tables")]
    public async Task<IActionResult> GetTables()
    {
        var restaurantId = GetRestaurantId();

        var tables = await dbContext.RestaurantTables
            .AsNoTracking()
            .Where(table => table.Branch.RestaurantId == restaurantId)
            .OrderBy(table => table.TableNumber)
            .Select(table => new
            {
                table.Id,
                table.BranchId,
                table.TableNumber,
                table.QrCodeUrl,
                table.IsActive
            })
            .ToListAsync();

        return Ok(tables);
    }

    [HttpPost("tables")]
    public async Task<IActionResult> CreateTable(TableRequest request)
    {
        var restaurantId = GetRestaurantId();

        if (request.TableNumber <= 0)
        {
            return BadRequest("Masa numarası sıfırdan büyük olmalı.");
        }

        var branch = await dbContext.Branches
            .Where(branch => branch.RestaurantId == restaurantId)
            .OrderBy(branch => branch.Id)
            .FirstOrDefaultAsync();

        if (branch is null)
        {
            branch = new Branch
            {
                RestaurantId = restaurantId,
                Name = "Main Branch",
                Address = string.Empty
            };

            dbContext.Branches.Add(branch);
            await dbContext.SaveChangesAsync();
        }

        var tableExists = await dbContext.RestaurantTables
            .Include(table => table.Branch)
            .AnyAsync(table =>
                table.Branch.RestaurantId == restaurantId &&
                table.TableNumber == request.TableNumber);

        if (tableExists)
        {
            return BadRequest("Bu masa numarası zaten mevcut.");
        }

        var table = new RestaurantTable
        {
            BranchId = branch.Id,
            TableNumber = request.TableNumber,
            QrCodeUrl = request.QrCodeUrl,
            IsActive = true
        };

        dbContext.RestaurantTables.Add(table);
        await dbContext.SaveChangesAsync();

        return Ok(new
        {
            table.Id,
            table.BranchId,
            table.TableNumber,
            table.QrCodeUrl,
            table.IsActive
        });
    }

    [HttpPut("restaurant/theme")]
    public async Task<IActionResult> UpdateTheme(ThemeRequest request)
    {
        var restaurantId = GetRestaurantId();
        var restaurant = await dbContext.Restaurants
            .FirstOrDefaultAsync(restaurant => restaurant.Id == restaurantId);

        if (restaurant is null)
        {
            return NotFound();
        }

        restaurant.LogoUrl = request.LogoUrl;
        restaurant.PrimaryColor = request.PrimaryColor;
        restaurant.SecondaryColor = request.SecondaryColor;
        restaurant.AccentColor = request.AccentColor;
        restaurant.MenuBackgroundColor = request.MenuBackgroundColor;
        restaurant.ButtonColor = request.ButtonColor;

        await dbContext.SaveChangesAsync();

        return Ok(new
        {
            restaurant.Id,
            restaurant.Name,
            restaurant.Slug,
            restaurant.LogoUrl,
            restaurant.PrimaryColor,
            restaurant.SecondaryColor,
            restaurant.AccentColor,
            restaurant.MenuBackgroundColor,
            restaurant.ButtonColor
        });
    }

    [HttpGet("gallery")]
    public IActionResult GetGallery()
    {
        var restaurantId = GetRestaurantId();
        var uploadDirectory = GetRestaurantUploadDirectory(restaurantId);

        if (!Directory.Exists(uploadDirectory))
        {
            return Ok(Array.Empty<object>());
        }

        var files = Directory.GetFiles(uploadDirectory)
            .OrderByDescending(System.IO.File.GetCreationTimeUtc)
            .Select(file => new
            {
                FileName = Path.GetFileName(file),
                Url = $"/uploads/restaurants/{restaurantId}/{Path.GetFileName(file)}"
            });

        return Ok(files);
    }

    [HttpPost("gallery")]
    [RequestSizeLimit(5_000_000)]
    public async Task<IActionResult> UploadImage(IFormFile file)
    {
        var restaurantId = GetRestaurantId();

        if (file.Length == 0)
        {
            return BadRequest("File is empty.");
        }

        if (file.Length > 5_000_000)
        {
            return BadRequest("File is too large. Maximum size is 5 MB.");
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };

        if (!allowedExtensions.Contains(extension))
        {
            return BadRequest("Unsupported file type.");
        }

        var uploadDirectory = GetRestaurantUploadDirectory(restaurantId);
        Directory.CreateDirectory(uploadDirectory);

        var fileName = $"{Guid.NewGuid():N}{extension}";
        var filePath = Path.Combine(uploadDirectory, fileName);

        await using (var stream = System.IO.File.Create(filePath))
        {
            await file.CopyToAsync(stream);
        }

        return Ok(new
        {
            FileName = fileName,
            Url = $"/uploads/restaurants/{restaurantId}/{fileName}"
        });
    }

    [HttpPut("tables/{id:int}")]
    public async Task<IActionResult> UpdateTable(int id, TableRequest request)
    {
        var restaurantId = GetRestaurantId();

        var table = await dbContext.RestaurantTables
            .Include(table => table.Branch)
            .FirstOrDefaultAsync(table =>
                table.Id == id && table.Branch.RestaurantId == restaurantId);

        if (table is null)
        {
            return NotFound();
        }

        var duplicateTable = await dbContext.RestaurantTables
            .Include(t => t.Branch)
            .AnyAsync(t =>
                t.Id != id &&
                t.Branch.RestaurantId == restaurantId &&
                t.TableNumber == request.TableNumber);

        if (duplicateTable)
        {
            return BadRequest("Bu masa numarası zaten mevcut.");
        }

        table.TableNumber = request.TableNumber;
        table.QrCodeUrl = request.QrCodeUrl;
        table.IsActive = request.IsActive;

        await dbContext.SaveChangesAsync();

        return Ok(new
        {
            table.Id,
            table.BranchId,
            table.TableNumber,
            table.QrCodeUrl,
            table.IsActive
        });
    }

    [HttpDelete("tables/{id:int}")]
    public async Task<IActionResult> DeleteTable(int id)
    {
        var restaurantId = GetRestaurantId();

        var table = await dbContext.RestaurantTables
            .Include(table => table.Branch)
            .FirstOrDefaultAsync(table =>
                table.Id == id && table.Branch.RestaurantId == restaurantId);

        if (table is null)
        {
            return NotFound();
        }

        var hasUnpaidOrders = await dbContext.Orders.AnyAsync(order =>
            order.RestaurantId == restaurantId &&
            order.TableId == id &&
            !order.IsPaid &&
            order.Status != OrderStatus.Paid &&
            order.Status != OrderStatus.Cancelled);

        if (hasUnpaidOrders)
        {
            return BadRequest("Bu masa kapatılamaz. Ödenmemiş siparişler var.");
        }

        dbContext.RestaurantTables.Remove(table);
        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    private int GetRestaurantId()
    {
        var claimValue = User.FindFirst("restaurantId")?.Value;

        if (!int.TryParse(claimValue, out var restaurantId))
        {
            throw new UnauthorizedAccessException("Restaurant claim is missing.");
        }

        return restaurantId;
    }

    public record CategoryRequest(string Name, int DisplayOrder, bool IsActive = true);

    public record ProductRequest(
        int CategoryId,
        string Name,
        string? Description,
        decimal Price,
        string? ImageUrl,
        int? Calories,
        string? Allergens,
        string? Ingredients,
        string? RemovableIngredients,
        int? EstimatedPreparationMinutes,
        bool IsAvailable = true);

    public record TableRequest(int TableNumber, string QrCodeUrl = "", bool IsActive = true);

    public record ThemeRequest(
        string? LogoUrl,
        string? PrimaryColor,
        string? SecondaryColor,
        string? AccentColor,
        string? MenuBackgroundColor,
        string? ButtonColor);

    private string GetRestaurantUploadDirectory(int restaurantId)
    {
        return Path.Combine(
            environment.ContentRootPath,
            "uploads",
            "restaurants",
            restaurantId.ToString());
    }
}
