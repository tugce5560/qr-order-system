using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using QrOrderSystem.Api.Data;
using QrOrderSystem.Api.Hubs;

namespace QrOrderSystem.Api.Controllers;

[ApiController]
[Authorize(Roles = "Waiter,RestaurantAdmin")]
[Route("api/waiter-calls")]
public class WaiterCallsController(
    AppDbContext dbContext,
    IHubContext<OrderHub> orderHub) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetCalls([FromQuery] string status = "Pending")
    {
        var restaurantId = GetRestaurantId();

        var calls = await dbContext.WaiterCalls
            .AsNoTracking()
            .Where(call =>
                call.RestaurantId == restaurantId &&
                (string.IsNullOrWhiteSpace(status) || call.Status == status))
            .OrderByDescending(call => call.CreatedAt)
            .Select(call => new
            {
                call.Id,
                call.RestaurantId,
                call.TableId,
                call.Table.TableNumber,
                call.Status,
                call.Message,
                call.CreatedAt,
                call.ResolvedAt
            })
            .ToListAsync();

        return Ok(calls);
    }

    [HttpPost("{id:int}/resolve")]
    public async Task<IActionResult> ResolveCall(int id)
    {
        var restaurantId = GetRestaurantId();
        var call = await dbContext.WaiterCalls
            .Include(call => call.Table)
            .FirstOrDefaultAsync(call =>
                call.Id == id &&
                call.RestaurantId == restaurantId &&
                call.Status == "Pending");

        if (call is null)
        {
            return NotFound();
        }

        call.Status = "Resolved";
        call.ResolvedAt = DateTime.UtcNow;
        call.ResolvedByUserId = GetUserId();
        await dbContext.SaveChangesAsync();

        var payload = new
        {
            call.Id,
            call.RestaurantId,
            call.TableId,
            call.Table.TableNumber,
            call.Status,
            call.Message,
            call.CreatedAt,
            call.ResolvedAt
        };

        await orderHub.Clients.All.SendAsync("WaiterCallResolved", payload);
        await orderHub.Clients.All.SendAsync("NotificationCreated", new
        {
            Type = "WaiterCallResolved",
            Title = "Garson çağrısı çözüldü",
            Description = $"Masa {call.Table.TableNumber} çağrısı kapatıldı.",
            call.RestaurantId,
            call.TableId,
            call.Table.TableNumber,
            CreatedAt = call.ResolvedAt
        });

        return Ok(payload);
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

    private int? GetUserId()
    {
        var claimValue = User.FindFirst("userId")?.Value;

        return int.TryParse(claimValue, out var userId) ? userId : null;
    }
}
