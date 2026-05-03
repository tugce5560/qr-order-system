using System.Security.Cryptography;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QrOrderSystem.Api.Data;
using QrOrderSystem.Api.Entities;
using QrOrderSystem.Api.Enums;

namespace QrOrderSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SeedController(
    AppDbContext dbContext,
    IWebHostEnvironment environment) : ControllerBase
{
    [HttpPost("demo")]
    public async Task<IActionResult> SeedDemo()
    {
        if (!environment.IsDevelopment())
        {
            return NotFound();
        }

        var now = DateTime.UtcNow;
        var demoRestaurant = await EnsureRestaurant(
            "Demo Restaurant",
            "demo-restaurant",
            "Main Branch",
            [1, 2, 3, 4, 5],
            now);
        var bistroRestaurant = await EnsureRestaurant(
            "Mavi Masa Bistro",
            "mavi-masa-bistro",
            "Izmir Branch",
            [1, 2, 3, 4],
            now);

        await dbContext.SaveChangesAsync();

        await EnsureUsers(demoRestaurant.Id, "demo");
        await EnsureUsers(bistroRestaurant.Id, "bistro");
        await EnsureSuperAdmin();

        await dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = "Multi-tenant demo data seeded successfully.",
            restaurants = new[]
            {
                new { demoRestaurant.Id, demoRestaurant.Name, demoRestaurant.Slug },
                new { bistroRestaurant.Id, bistroRestaurant.Name, bistroRestaurant.Slug }
            }
        });
    }

    private async Task<Restaurant> EnsureRestaurant(
        string name,
        string slug,
        string branchName,
        int[] tableNumbers,
        DateTime now)
    {
        var restaurant = await dbContext.Restaurants
            .Include(restaurant => restaurant.Branches)
            .ThenInclude(branch => branch.Tables)
            .Include(restaurant => restaurant.Categories)
            .ThenInclude(category => category.Products)
            .FirstOrDefaultAsync(restaurant => restaurant.Slug == slug);

        if (restaurant is null)
        {
            restaurant = new Restaurant
            {
                Name = name,
                Slug = slug,
                CreatedAt = now
            };

            dbContext.Restaurants.Add(restaurant);
        }

        var branch = restaurant.Branches.FirstOrDefault();

        if (branch is null)
        {
            branch = new Branch
            {
                Name = branchName,
                Address = string.Empty
            };
            restaurant.Branches.Add(branch);
        }

        foreach (var tableNumber in tableNumbers)
        {
            if (branch.Tables.All(table => table.TableNumber != tableNumber))
            {
                branch.Tables.Add(new RestaurantTable
                {
                    TableNumber = tableNumber,
                    QrCodeUrl = string.Empty,
                    IsActive = true
                });
            }
        }

        EnsureCategoryWithProducts(
            restaurant,
            "İçecekler",
            1,
            [
                CreateProduct("Su", "Şişe su", 25, now),
                CreateProduct("Limonata", "Ev yapımı limonata", 95, now, 120, "Limon, nane, şeker")
            ]);
        EnsureCategoryWithProducts(
            restaurant,
            "Ana Yemekler",
            2,
            [
                CreateProduct("Burger", "Klasik burger", 220, now, 720, "Dana köfte, cheddar, ekmek", "Gluten, süt ürünü"),
                CreateProduct("Pizza", "Peynirli pizza", 260, now, 840, "Hamur, domates, mozzarella", "Gluten, süt ürünü")
            ]);

        return restaurant;
    }

    private static Product CreateProduct(
        string name,
        string description,
        decimal price,
        DateTime now,
        int? calories = null,
        string? ingredients = null,
        string? allergens = null)
    {
        return new Product
        {
            Name = name,
            Description = description,
            Price = price,
            ImageUrl = string.Empty,
            Calories = calories,
            Ingredients = ingredients,
            Allergens = allergens,
            EstimatedPreparationMinutes = 12,
            IsAvailable = true,
            CreatedAt = now
        };
    }

    private static void EnsureCategoryWithProducts(
        Restaurant restaurant,
        string categoryName,
        int displayOrder,
        Product[] products)
    {
        var category = restaurant.Categories.FirstOrDefault(
            category => category.Name == categoryName);

        if (category is null)
        {
            category = new Category
            {
                Name = categoryName,
                DisplayOrder = displayOrder,
                IsActive = true
            };
            restaurant.Categories.Add(category);
        }

        foreach (var product in products)
        {
            if (category.Products.All(existingProduct => existingProduct.Name != product.Name))
            {
                category.Products.Add(product);
            }
        }
    }

    private async Task EnsureSuperAdmin()
    {
        await EnsureUser(
            "Super Admin",
            "superadmin@qrorder.local",
            UserRole.SuperAdmin,
            null);
    }

    private async Task EnsureUsers(int restaurantId, string prefix)
    {
        await EnsureUser(
            $"{prefix} Restaurant Admin",
            $"{prefix}.admin@qrorder.local",
            UserRole.RestaurantAdmin,
            restaurantId);
        await EnsureUser(
            $"{prefix} Kitchen",
            $"{prefix}.kitchen@qrorder.local",
            UserRole.Kitchen,
            restaurantId);
        await EnsureUser(
            $"{prefix} Waiter",
            $"{prefix}.waiter@qrorder.local",
            UserRole.Waiter,
            restaurantId);
        await EnsureUser(
            $"{prefix} Customer",
            $"{prefix}.customer@qrorder.local",
            UserRole.Customer,
            restaurantId);
    }

    private async Task EnsureUser(
        string fullName,
        string email,
        UserRole role,
        int? restaurantId)
    {
        var exists = await dbContext.Users.AnyAsync(user => user.Email == email);

        if (exists)
        {
            return;
        }

        dbContext.Users.Add(new AppUser
        {
            FullName = fullName,
            Email = email,
            PasswordHash = HashPassword("admin123"),
            Role = role,
            RestaurantId = restaurantId
        });
    }

    private static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            100_000,
            HashAlgorithmName.SHA256,
            32);

        return $"{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }
}
