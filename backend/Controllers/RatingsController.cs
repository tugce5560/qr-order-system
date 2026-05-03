using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QrOrderSystem.Api.Data;
using QrOrderSystem.Api.Entities;
using QrOrderSystem.Api.Enums;

namespace QrOrderSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RatingsController(AppDbContext dbContext) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> CreateRating(CreateRatingRequest request)
    {
        var tableExists = await dbContext.RestaurantTables
            .AnyAsync(table =>
                table.Id == request.TableId &&
                table.Branch.RestaurantId == request.RestaurantId);

        if (!tableExists)
        {
            return NotFound("Table not found.");
        }

        if (!IsValidRatingValue(request.Speed) ||
            !IsValidRatingValue(request.Taste) ||
            !IsValidRatingValue(request.Service))
        {
            return BadRequest("Rating values must be between 1 and 5.");
        }

        var hasServedOrder = await dbContext.Orders
            .AnyAsync(order =>
                order.TableId == request.TableId &&
                order.RestaurantId == request.RestaurantId &&
                (order.Status == OrderStatus.Served ||
                 order.Status == OrderStatus.Paid));

        if (!hasServedOrder)
        {
            return BadRequest("Rating is only available after an order is served or paid.");
        }

        var rating = new Rating
        {
            TableId = request.TableId,
            Speed = request.Speed,
            Taste = request.Taste,
            Service = request.Service,
            Comment = request.Comment,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Ratings.Add(rating);
        await dbContext.SaveChangesAsync();

        return Ok(new
        {
            Success = true
        });
    }

    private static bool IsValidRatingValue(int value)
    {
        return value is >= 1 and <= 5;
    }

    public record CreateRatingRequest(
        int RestaurantId,
        int TableId,
        int Speed,
        int Taste,
        int Service,
        string? Comment);
}
