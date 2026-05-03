using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QrOrderSystem.Api.Data;
using QrOrderSystem.Api.Entities;
using QrOrderSystem.Api.Enums;

namespace QrOrderSystem.Api.Controllers;

[ApiController]
[Route("api/dev")]
public class DevController(
    AppDbContext dbContext,
    IWebHostEnvironment environment) : ControllerBase
{
    [HttpPost("create-analytics-test-order")]
    public async Task<IActionResult> CreateAnalyticsTestOrder()
    {
        if (!environment.IsDevelopment())
        {
            return NotFound();
        }

        var products = await dbContext.Products
            .Where(product => product.IsAvailable)
            .OrderBy(product => product.Id)
            .Take(2)
            .ToListAsync();

        if (products.Count == 0)
        {
            return BadRequest("No available products found.");
        }

        var now = DateTime.UtcNow;
        var orderItems = products.Select(product => new OrderItem
        {
            ProductId = product.Id,
            ProductName = product.Name,
            UnitPrice = product.Price,
            Quantity = 1
        }).ToList();

        var order = new Order
        {
            RestaurantId = 1,
            BranchId = 1,
            TableId = 3,
            OrderNumber = "TEMP",
            Status = OrderStatus.Paid,
            Source = OrderSource.QR,
            TotalAmount = orderItems.Sum(item => item.UnitPrice * item.Quantity),
            CreatedAt = now.AddMinutes(-20),
            PreparingAt = now.AddMinutes(-18),
            ReadyAt = now.AddMinutes(-8),
            ServedAt = now.AddMinutes(-5),
            PaidAt = now.AddMinutes(-2),
            Items = orderItems
        };

        dbContext.Orders.Add(order);
        await dbContext.SaveChangesAsync();

        order.OrderNumber = $"#T3-{order.Id:D4}";
        await dbContext.SaveChangesAsync();

        return Ok(new
        {
            Message = "Analytics test order created",
            OrderId = order.Id
        });
    }
}
