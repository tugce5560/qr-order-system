using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QrOrderSystem.Api.Data;
using QrOrderSystem.Api.Entities;
using QrOrderSystem.Api.Enums;
using QrOrderSystem.Api.Services.ExternalOrders;

namespace QrOrderSystem.Api.Controllers;

[ApiController]
[Route("api/external-orders")]
[Authorize(Roles = "RestaurantAdmin,SuperAdmin")]
public class ExternalOrdersController(
    AppDbContext dbContext,
    IExternalOrderImportService importService,
    IConfiguration configuration) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetExternalOrders(
        [FromQuery] int? restaurantId = null,
        [FromQuery] string? platform = null,
        [FromQuery] string? status = null)
    {
        var query = dbContext.ExternalOrders
            .AsNoTracking()
            .Include(externalOrder => externalOrder.InternalOrder)
            .AsQueryable();

        if (User.IsInRole(UserRole.SuperAdmin.ToString()))
        {
            if (restaurantId.HasValue)
            {
                query = query.Where(externalOrder => externalOrder.RestaurantId == restaurantId.Value);
            }
        }
        else
        {
            var scopedRestaurantId = GetScopedRestaurantId(null);
            query = query.Where(externalOrder => externalOrder.RestaurantId == scopedRestaurantId);
        }

        if (Enum.TryParse<ExternalOrderPlatform>(platform, ignoreCase: true, out var parsedPlatform))
        {
            query = query.Where(externalOrder => externalOrder.Platform == parsedPlatform);
        }

        if (Enum.TryParse<ExternalOrderStatus>(status, ignoreCase: true, out var parsedStatus))
        {
            query = query.Where(externalOrder => externalOrder.Status == parsedStatus);
        }

        var externalOrders = await query
            .OrderByDescending(externalOrder => externalOrder.CreatedAt)
            .Take(100)
            .ToListAsync();

        return Ok(externalOrders.Select(externalOrder => ToExternalOrderResponse(externalOrder)));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetExternalOrder(int id, [FromQuery] int? restaurantId = null)
    {
        var scopedRestaurantId = GetScopedRestaurantId(restaurantId);
        var externalOrder = await dbContext.ExternalOrders
            .AsNoTracking()
            .Include(currentOrder => currentOrder.InternalOrder)
            .ThenInclude(order => order!.Items)
            .FirstOrDefaultAsync(currentOrder =>
                currentOrder.Id == id &&
                currentOrder.RestaurantId == scopedRestaurantId);

        return externalOrder is null
            ? NotFound()
            : Ok(ToExternalOrderResponse(externalOrder, includePayload: true));
    }

    [HttpPost("mock")]
    public async Task<IActionResult> CreateMockExternalOrder(
        MockExternalOrderRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            if (!string.Equals(configuration["EXTERNAL_ORDER_IMPORT_MODE"], "mock", StringComparison.OrdinalIgnoreCase))
            {
                return NotFound();
            }

            if (!User.IsInRole(UserRole.SuperAdmin.ToString()) &&
                request.RestaurantId != GetScopedRestaurantId(null))
            {
                return Unauthorized("Restaurant scope mismatch.");
            }

            var externalOrder = await importService.ImportMockOrderAsync(request, cancellationToken);
            return Ok(ToExternalOrderResponse(externalOrder, includePayload: true));
        }
        catch (Exception exception) when (IsKnownExternalOrderException(exception))
        {
            return BadRequest(exception.Message);
        }
    }

    [HttpPost("{id:int}/import")]
    public async Task<IActionResult> ImportExternalOrder(int id, CancellationToken cancellationToken)
    {
        try
        {
            var externalOrder = await importService.RetryImportAsync(id, cancellationToken);
            return Ok(ToExternalOrderResponse(externalOrder, includePayload: true));
        }
        catch (Exception exception) when (IsKnownExternalOrderException(exception))
        {
            return BadRequest(exception.Message);
        }
    }

    [HttpPost("{id:int}/retry")]
    public async Task<IActionResult> RetryExternalOrder(int id, CancellationToken cancellationToken)
    {
        return await ImportExternalOrder(id, cancellationToken);
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> CancelExternalOrder(int id, [FromQuery] int? restaurantId = null)
    {
        var scopedRestaurantId = GetScopedRestaurantId(restaurantId);
        var externalOrder = await dbContext.ExternalOrders
            .FirstOrDefaultAsync(currentOrder =>
                currentOrder.Id == id &&
                currentOrder.RestaurantId == scopedRestaurantId);

        if (externalOrder is null)
        {
            return NotFound();
        }

        externalOrder.Status = ExternalOrderStatus.Cancelled;
        externalOrder.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();

        return Ok(ToExternalOrderResponse(externalOrder));
    }

    private int GetScopedRestaurantId(int? requestedRestaurantId)
    {
        if (User.IsInRole(UserRole.SuperAdmin.ToString()))
        {
            if (!requestedRestaurantId.HasValue)
            {
                throw new InvalidOperationException("Restaurant id is required.");
            }

            return requestedRestaurantId.Value;
        }

        var claimValue = User.FindFirst("restaurantId")?.Value;

        if (!int.TryParse(claimValue, out var restaurantId))
        {
            throw new UnauthorizedAccessException("Restaurant claim is missing.");
        }

        return restaurantId;
    }

    private static object ToExternalOrderResponse(
        ExternalOrder externalOrder,
        bool includePayload = false)
    {
        return new
        {
            externalOrder.Id,
            externalOrder.RestaurantId,
            externalOrder.BranchId,
            Platform = externalOrder.Platform.ToString(),
            externalOrder.ExternalOrderId,
            externalOrder.ExternalStatus,
            externalOrder.InternalOrderId,
            InternalOrderNumber = externalOrder.InternalOrder?.OrderNumber,
            externalOrder.CustomerName,
            externalOrder.CustomerPhone,
            externalOrder.DeliveryAddress,
            externalOrder.TotalAmount,
            externalOrder.Currency,
            externalOrder.ErrorMessage,
            Status = externalOrder.Status.ToString(),
            externalOrder.CreatedAt,
            externalOrder.UpdatedAt,
            externalOrder.ImportedAt,
            RawPayloadJson = includePayload ? externalOrder.RawPayloadJson : null,
            NormalizedPayloadJson = includePayload ? externalOrder.NormalizedPayloadJson : null
        };
    }

    private static bool IsKnownExternalOrderException(Exception exception)
    {
        return exception is InvalidOperationException or KeyNotFoundException or UnauthorizedAccessException;
    }
}
