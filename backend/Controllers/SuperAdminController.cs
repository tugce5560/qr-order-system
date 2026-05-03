using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QrOrderSystem.Api.Data;
using QrOrderSystem.Api.Enums;

namespace QrOrderSystem.Api.Controllers;

[ApiController]
[Authorize(Roles = "SuperAdmin")]
[Route("api/super-admin")]
public class SuperAdminController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview()
    {
        var restaurants = await dbContext.Restaurants
            .AsNoTracking()
            .Select(restaurant => new
            {
                restaurant.Id,
                restaurant.Name,
                restaurant.Slug,
                restaurant.City,
                restaurant.Status,
                restaurant.Plan,
                SubscriptionEndsAt = restaurant.SubscriptionEndsAt ?? DateTime.UtcNow.AddMonths(1),
                AdminUser = restaurant.Users
                    .Where(user => user.Role == UserRole.RestaurantAdmin)
                    .Select(user => user.FullName)
                    .FirstOrDefault() ?? "Unassigned",
                Orders = restaurant.Orders.Count,
                Revenue = restaurant.Orders.Sum(order => order.TotalAmount)
            })
            .ToListAsync();

        var users = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.Role != UserRole.SuperAdmin)
            .Select(user => new
            {
                user.Id,
                user.FullName,
                user.Email,
                RestaurantName = user.Restaurant != null ? user.Restaurant.Name : "-",
                Role = user.Role.ToString(),
                Status = "Active"
            })
            .ToListAsync();

        var reports = await dbContext.Orders
            .AsNoTracking()
            .GroupBy(order => new { order.CreatedAt.Year, order.CreatedAt.Month })
            .OrderBy(group => group.Key.Year)
            .ThenBy(group => group.Key.Month)
            .Select(group => new
            {
                Label = $"{group.Key.Month:00}/{group.Key.Year}",
                Orders = group.Count(),
                Revenue = group.Sum(order => order.TotalAmount)
            })
            .Take(12)
            .ToListAsync();

        return Ok(new
        {
            Restaurants = restaurants,
            Users = users,
            Reports = reports
        });
    }

    [HttpPost("restaurants")]
    public async Task<IActionResult> CreateRestaurant(RestaurantRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Slug))
        {
            return BadRequest("Restoran adı ve slug zorunludur.");
        }

        var slugExists = await dbContext.Restaurants.AnyAsync(restaurant => restaurant.Slug == request.Slug);

        if (slugExists)
        {
            return BadRequest("Bu slug zaten kullanılıyor.");
        }

        var restaurant = new QrOrderSystem.Api.Entities.Restaurant
        {
            Name = request.Name.Trim(),
            Slug = request.Slug.Trim(),
            City = request.City?.Trim() ?? string.Empty,
            Status = "Active",
            Plan = request.Plan?.Trim() ?? "Basic",
            SubscriptionEndsAt = request.SubscriptionEndsAt,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Restaurants.Add(restaurant);
        await dbContext.SaveChangesAsync();

        return Ok(new { restaurant.Id, restaurant.Name, restaurant.Slug });
    }

    [HttpPut("restaurants/{id:int}")]
    public async Task<IActionResult> UpdateRestaurant(int id, RestaurantRequest request)
    {
        var restaurant = await dbContext.Restaurants.FirstOrDefaultAsync(restaurant => restaurant.Id == id);

        if (restaurant is null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Slug))
        {
            return BadRequest("Restoran adı ve slug zorunludur.");
        }

        var slugExists = await dbContext.Restaurants.AnyAsync(restaurant =>
            restaurant.Id != id &&
            restaurant.Slug == request.Slug);

        if (slugExists)
        {
            return BadRequest("Bu slug zaten kullanılıyor.");
        }

        restaurant.Name = request.Name.Trim();
        restaurant.Slug = request.Slug.Trim();
        restaurant.City = request.City?.Trim() ?? string.Empty;
        restaurant.Plan = request.Plan?.Trim() ?? restaurant.Plan;
        restaurant.SubscriptionEndsAt = request.SubscriptionEndsAt ?? restaurant.SubscriptionEndsAt;
        await dbContext.SaveChangesAsync();

        return Ok(new { restaurant.Id, restaurant.Name, restaurant.Slug });
    }

    [HttpPatch("restaurants/{id:int}/status")]
    public async Task<IActionResult> UpdateRestaurantStatus(int id, RestaurantStatusRequest request)
    {
        var restaurant = await dbContext.Restaurants.FirstOrDefaultAsync(restaurant => restaurant.Id == id);

        if (restaurant is null)
        {
            return NotFound();
        }

        restaurant.Status = request.Status;
        await dbContext.SaveChangesAsync();

        return Ok(new { restaurant.Id, restaurant.Status });
    }

    [HttpPatch("restaurants/{id:int}/plan")]
    public async Task<IActionResult> UpdateRestaurantPlan(int id, RestaurantPlanRequest request)
    {
        var restaurant = await dbContext.Restaurants.FirstOrDefaultAsync(restaurant => restaurant.Id == id);

        if (restaurant is null)
        {
            return NotFound();
        }

        restaurant.Plan = request.Plan;
        await dbContext.SaveChangesAsync();

        return Ok(new { restaurant.Id, restaurant.Plan });
    }

    public record RestaurantRequest(
        string Name,
        string Slug,
        string? City,
        string? Plan,
        DateTime? SubscriptionEndsAt);

    public record RestaurantStatusRequest(string Status);

    public record RestaurantPlanRequest(string Plan);
}
