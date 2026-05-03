using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using QrOrderSystem.Api.Data;
using QrOrderSystem.Api.Entities;
using QrOrderSystem.Api.Hubs;

namespace QrOrderSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PublicController(AppDbContext dbContext, IHubContext<OrderHub> orderHub) : ControllerBase
{
    [HttpGet("resolve-table")]
    public async Task<IActionResult> ResolveTable(
        [FromQuery] string restaurantSlug,
        [FromQuery] int tableNumber)
    {
        var restaurant = await dbContext.Restaurants
            .AsNoTracking()
            .FirstOrDefaultAsync(restaurant => restaurant.Slug == restaurantSlug);

        if (restaurant is null)
        {
            return NotFound();
        }

        var table = await dbContext.RestaurantTables
            .AsNoTracking()
            .Include(table => table.Branch)
            .FirstOrDefaultAsync(table =>
                table.Branch.RestaurantId == restaurant.Id &&
                table.TableNumber == tableNumber);

        if (table is null)
        {
            return NotFound();
        }

        return Ok(new
        {
            RestaurantId = restaurant.Id,
            TableId = table.Id,
            table.TableNumber,
            RestaurantName = restaurant.Name,
            restaurant.LogoUrl,
            restaurant.PrimaryColor,
            restaurant.SecondaryColor,
            restaurant.AccentColor,
            restaurant.MenuBackgroundColor,
            restaurant.ButtonColor
        });
    }

    [HttpPost("service-request")]
    public async Task<IActionResult> CreateServiceRequest(ServiceRequest request)
    {
        var table = await dbContext.RestaurantTables
            .AsNoTracking()
            .Include(table => table.Branch)
            .FirstOrDefaultAsync(table =>
                table.Id == request.TableId &&
                table.Branch.RestaurantId == request.RestaurantId);

        if (table is null)
        {
            return NotFound("Table not found.");
        }

        var requestType = request.Type.Trim();

        if (!IsSupportedServiceRequestType(requestType))
        {
            return BadRequest("Unsupported service request type.");
        }

        if (requestType.Equals("Waiter", StringComparison.OrdinalIgnoreCase))
        {
            var existingCall = await dbContext.WaiterCalls
                .AsNoTracking()
                .FirstOrDefaultAsync(call =>
                    call.RestaurantId == request.RestaurantId &&
                    call.TableId == request.TableId &&
                    call.Status == "Pending");

            if (existingCall is not null)
            {
                return Conflict(new
                {
                    Message = "Garson çağrınız zaten iletildi. Lütfen bekleyiniz.",
                    existingCall.Id,
                    existingCall.Status
                });
            }

            var waiterCall = new WaiterCall
            {
                RestaurantId = request.RestaurantId,
                TableId = request.TableId,
                Status = "Pending",
                Message = request.Message,
                CreatedAt = DateTime.UtcNow
            };

            dbContext.WaiterCalls.Add(waiterCall);
            await dbContext.SaveChangesAsync();

            var waiterCallPayload = new
            {
                waiterCall.Id,
                waiterCall.RestaurantId,
                waiterCall.TableId,
                table.TableNumber,
                waiterCall.Status,
                waiterCall.Message,
                waiterCall.CreatedAt
            };

            await orderHub.Clients.All.SendAsync("WaiterCallCreated", waiterCallPayload);
            await orderHub.Clients.All.SendAsync("NotificationCreated", new
            {
                Type = "WaiterCallCreated",
                Title = "Garson çağrıldı",
                Description = $"Masa {table.TableNumber} garson çağırdı.",
                request.RestaurantId,
                request.TableId,
                table.TableNumber,
                CreatedAt = waiterCall.CreatedAt
            });

            return Ok(waiterCallPayload);
        }

        var payload = new
        {
            request.RestaurantId,
            request.TableId,
            table.TableNumber,
            Type = requestType,
            RequestedAt = DateTime.UtcNow
        };

        await orderHub.Clients.All.SendAsync("ServiceRequested", payload);

        return Ok(payload);
    }

    [HttpPost("table-session")]
    public async Task<IActionResult> CreateTableSession(CreateTableSessionRequest request)
    {
        var table = await dbContext.RestaurantTables
            .AsNoTracking()
            .Include(table => table.Branch)
            .FirstOrDefaultAsync(table =>
                table.Id == request.TableId &&
                table.Branch.RestaurantId == request.RestaurantId);

        if (table is null)
        {
            return NotFound("Table not found.");
        }

        var now = DateTime.UtcNow;

        await dbContext.TableSessions
            .Where(session =>
                session.RestaurantId == request.RestaurantId &&
                session.TableId == request.TableId &&
                session.IsActive &&
                session.ExpiresAt <= now)
            .ExecuteUpdateAsync(setters => setters.SetProperty(
                session => session.IsActive,
                false));

        var session = new TableSession
        {
            RestaurantId = request.RestaurantId,
            TableId = request.TableId,
            Token = CreateSecureToken(),
            CreatedAt = now,
            ExpiresAt = now.AddHours(2),
            IsActive = true
        };

        dbContext.TableSessions.Add(session);
        await dbContext.SaveChangesAsync();

        return Ok(new
        {
            session.Token,
            session.ExpiresAt
        });
    }

    private static bool IsSupportedServiceRequestType(string requestType)
    {
        return requestType.Equals("Waiter", StringComparison.OrdinalIgnoreCase) ||
            requestType.Equals("Bill", StringComparison.OrdinalIgnoreCase);
    }

    public record ServiceRequest(int RestaurantId, int TableId, string Type, string? Message = null);

    public record CreateTableSessionRequest(int RestaurantId, int TableId);

    private static string CreateSecureToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(48))
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }
}
