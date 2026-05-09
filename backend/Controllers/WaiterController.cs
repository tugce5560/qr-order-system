using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QrOrderSystem.Api.Data;
using QrOrderSystem.Api.Entities;
using QrOrderSystem.Api.Enums;

namespace QrOrderSystem.Api.Controllers;

[ApiController]
[Authorize(Roles = "Waiter,RestaurantAdmin")]
[Route("api/[controller]")]
public class WaiterController(AppDbContext dbContext) : ControllerBase
{
    private static readonly OrderStatus[] ActiveOrderStatuses =
    [
        OrderStatus.New,
        OrderStatus.Preparing,
        OrderStatus.Ready,
        OrderStatus.Served
    ];

    [HttpGet("tables")]
    public async Task<IActionResult> GetTables()
    {
        var restaurantId = GetRestaurantId();

        var tables = await dbContext.RestaurantTables
            .AsNoTracking()
            .Where(table => table.Branch.RestaurantId == restaurantId)
            .Include(table => table.Orders)
            .OrderBy(table => table.TableNumber)
            .ToListAsync();

        var result = tables.Select(table =>
        {
            var activeOrders = table.Orders
                .Where(order => ActiveOrderStatuses.Contains(order.Status))
                .ToList();

            return new
            {
                TableId = table.Id,
                table.TableNumber,
                ActiveOrderCount = activeOrders.Count,
                TotalAmount = activeOrders.Sum(order => order.TotalAmount),
                Status = GetTableStatus(activeOrders)
            };
        });

        return Ok(result);
    }

    [HttpGet("tables/{tableId:int}")]
    public async Task<IActionResult> GetTable(int tableId)
    {
        var restaurantId = GetRestaurantId();

        var table = await dbContext.RestaurantTables
            .AsNoTracking()
            .Include(table => table.Orders)
            .ThenInclude(order => order.Items)
            .FirstOrDefaultAsync(table =>
                table.Id == tableId &&
                table.Branch.RestaurantId == restaurantId);

        if (table is null)
        {
            return NotFound();
        }

        var result = new
        {
            TableId = table.Id,
            table.TableNumber,
            Orders = table.Orders
                .Where(order => order.RestaurantId == restaurantId)
                .OrderBy(order => order.CreatedAt)
                .Select(order => new
                {
                    OrderId = order.Id,
                    order.OrderNumber,
                    Status = order.Status.ToString(),
                    order.TotalAmount,
                    PaymentStatus = order.PaymentStatus == null ? null : order.PaymentStatus.ToString(),
                    PaymentProvider = order.PaymentProvider == null ? null : order.PaymentProvider.ToString(),
                    order.IsPaid,
                    order.PaidAt,
                    Items = order.Items.Select(item => new
                    {
                        item.ProductName,
                        item.Quantity,
                        item.UnitPrice
                    }).ToList()
                }).ToList()
        };

        return Ok(result);
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

    private static string GetTableStatus(IReadOnlyCollection<Order> activeOrders)
    {
        if (activeOrders.Any(order => order.Status == OrderStatus.Ready))
        {
            return "Ready";
        }

        if (activeOrders.Any(order => order.Status is OrderStatus.New or OrderStatus.Preparing))
        {
            return "Active";
        }

        if (activeOrders.Any(order => order.Status == OrderStatus.Served))
        {
            return "Served";
        }

        return "Empty";
    }
}
