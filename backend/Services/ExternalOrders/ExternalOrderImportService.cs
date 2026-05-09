using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using QrOrderSystem.Api.Data;
using QrOrderSystem.Api.Entities;
using QrOrderSystem.Api.Enums;
using QrOrderSystem.Api.Hubs;

namespace QrOrderSystem.Api.Services.ExternalOrders;

public interface IExternalOrderImportService
{
    Task<ExternalOrder> ImportMockOrderAsync(
        MockExternalOrderRequest request,
        CancellationToken cancellationToken = default);

    Task<ExternalOrder> ImportExternalOrderAsync(
        ExternalOrderNormalizedPayload normalizedPayload,
        string rawPayloadJson,
        CancellationToken cancellationToken = default);

    Task<ExternalOrder> RetryImportAsync(int externalOrderId, CancellationToken cancellationToken = default);
}

public class ExternalOrderImportService(
    AppDbContext dbContext,
    IHubContext<OrderHub> orderHub,
    ILogger<ExternalOrderImportService> logger) : IExternalOrderImportService
{
    public async Task<ExternalOrder> ImportMockOrderAsync(
        MockExternalOrderRequest request,
        CancellationToken cancellationToken = default)
    {
        var rawPayloadJson = JsonSerializer.Serialize(request, ExternalOrderJson.Options);
        return await ImportExternalOrderAsync(request.ToNormalizedPayload(), rawPayloadJson, cancellationToken);
    }

    public async Task<ExternalOrder> ImportExternalOrderAsync(
        ExternalOrderNormalizedPayload normalizedPayload,
        string rawPayloadJson,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var existingExternalOrder = await dbContext.ExternalOrders
            .Include(externalOrder => externalOrder.InternalOrder)
            .ThenInclude(order => order!.Items)
            .FirstOrDefaultAsync(
                externalOrder =>
                    externalOrder.RestaurantId == normalizedPayload.RestaurantId &&
                    externalOrder.Platform == normalizedPayload.Platform &&
                    externalOrder.ExternalOrderId == normalizedPayload.ExternalOrderId,
                cancellationToken);

        if (existingExternalOrder is not null)
        {
            logger.LogInformation(
                "Duplicate external order ignored for {Platform} {ExternalOrderId}.",
                normalizedPayload.Platform,
                normalizedPayload.ExternalOrderId);
            return existingExternalOrder;
        }

        var externalOrder = new ExternalOrder
        {
            RestaurantId = normalizedPayload.RestaurantId,
            BranchId = normalizedPayload.BranchId,
            Platform = normalizedPayload.Platform,
            ExternalOrderId = normalizedPayload.ExternalOrderId,
            ExternalStatus = normalizedPayload.ExternalStatus,
            RawPayloadJson = rawPayloadJson,
            NormalizedPayloadJson = JsonSerializer.Serialize(normalizedPayload, ExternalOrderJson.Options),
            CustomerName = normalizedPayload.CustomerName,
            CustomerPhone = normalizedPayload.CustomerPhone,
            DeliveryAddress = normalizedPayload.DeliveryAddress,
            TotalAmount = normalizedPayload.TotalAmount,
            Currency = normalizedPayload.Currency,
            Status = ExternalOrderStatus.Received,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.ExternalOrders.Add(externalOrder);
        await dbContext.SaveChangesAsync(cancellationToken);

        return await ImportStoredExternalOrder(externalOrder, normalizedPayload, cancellationToken);
    }

    public async Task<ExternalOrder> RetryImportAsync(
        int externalOrderId,
        CancellationToken cancellationToken = default)
    {
        var externalOrder = await dbContext.ExternalOrders
            .FirstOrDefaultAsync(currentOrder => currentOrder.Id == externalOrderId, cancellationToken)
            ?? throw new KeyNotFoundException("External order not found.");

        if (externalOrder.InternalOrderId.HasValue &&
            externalOrder.Status == ExternalOrderStatus.Imported)
        {
            return externalOrder;
        }

        if (string.IsNullOrWhiteSpace(externalOrder.NormalizedPayloadJson))
        {
            throw new InvalidOperationException("External order has no normalized payload to retry.");
        }

        var normalizedPayload = JsonSerializer.Deserialize<ExternalOrderNormalizedPayload>(
            externalOrder.NormalizedPayloadJson,
            ExternalOrderJson.Options) ?? throw new InvalidOperationException("External order normalized payload is invalid.");

        return await ImportStoredExternalOrder(externalOrder, normalizedPayload, cancellationToken);
    }

    private async Task<ExternalOrder> ImportStoredExternalOrder(
        ExternalOrder externalOrder,
        ExternalOrderNormalizedPayload normalizedPayload,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        try
        {
            externalOrder.Status = ExternalOrderStatus.Normalized;
            externalOrder.UpdatedAt = now;
            externalOrder.ErrorMessage = null;

            var branch = await dbContext.Branches
                .Include(currentBranch => currentBranch.Tables)
                .FirstOrDefaultAsync(
                    currentBranch =>
                        currentBranch.Id == normalizedPayload.BranchId &&
                        currentBranch.RestaurantId == normalizedPayload.RestaurantId,
                    cancellationToken)
                ?? throw new InvalidOperationException("Branch not found for external order.");

            // TODO: Replace this temporary routing with explicit external delivery/virtual table mapping per branch.
            var operationalTable = branch.Tables
                .OrderBy(table => table.TableNumber)
                .FirstOrDefault(table => table.IsActive)
                ?? throw new InvalidOperationException("No active table found for external order branch.");

            var products = await dbContext.Products
                .AsNoTracking()
                .Include(product => product.Category)
                .Where(product => product.Category.RestaurantId == normalizedPayload.RestaurantId)
                .ToListAsync(cancellationToken);
            var productsByName = products
                .GroupBy(product => product.Name.ToLowerInvariant())
                .ToDictionary(group => group.Key, group => group.First());

            var items = normalizedPayload.Items.Select(item =>
            {
                productsByName.TryGetValue(item.Name.ToLowerInvariant(), out var matchedProduct);

                return new OrderItem
                {
                    ProductId = matchedProduct?.Id,
                    ProductName = item.Name,
                    Quantity = item.Quantity,
                    UnitPrice = item.UnitPrice,
                    Note = item.Note,
                    RemovedIngredients = matchedProduct is null ? "External item - product not matched" : null
                };
            }).ToList();

            if (items.Count == 0)
            {
                throw new InvalidOperationException("External order must contain at least one item.");
            }

            var calculatedTotal = items.Sum(item => item.UnitPrice * item.Quantity);
            var order = new Order
            {
                RestaurantId = normalizedPayload.RestaurantId,
                BranchId = normalizedPayload.BranchId,
                TableId = operationalTable.Id,
                OrderNumber = "TEMP",
                Status = MapExternalStatus(normalizedPayload.ExternalStatus),
                Source = MapOrderSource(normalizedPayload.Platform),
                TotalAmount = calculatedTotal,
                Note = normalizedPayload.Note,
                ExternalPlatform = normalizedPayload.Platform.ToString(),
                ExternalOrderId = normalizedPayload.ExternalOrderId,
                ExternalRawOrderId = normalizedPayload.ExternalOrderId,
                ExternalStatus = normalizedPayload.ExternalStatus,
                ExternalCustomerName = normalizedPayload.CustomerName,
                ExternalCustomerPhone = normalizedPayload.CustomerPhone,
                ExternalDeliveryAddress = normalizedPayload.DeliveryAddress,
                ExternalNote = normalizedPayload.Note,
                CreatedAt = now,
                Items = items
            };

            dbContext.Orders.Add(order);
            await dbContext.SaveChangesAsync(cancellationToken);

            order.OrderNumber = $"{GetPlatformPrefix(normalizedPayload.Platform)}-{order.Id:D6}";
            externalOrder.InternalOrderId = order.Id;
            externalOrder.Status = ExternalOrderStatus.Imported;
            externalOrder.ImportedAt = now;
            externalOrder.UpdatedAt = now;
            await dbContext.SaveChangesAsync(cancellationToken);

            await PublishOrderCreated(order, operationalTable.TableNumber);

            return externalOrder;
        }
        catch (Exception exception)
        {
            externalOrder.Status = ExternalOrderStatus.Failed;
            externalOrder.ErrorMessage = SanitizeError(exception.Message);
            externalOrder.UpdatedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            logger.LogWarning(
                exception,
                "External order import failed for {Platform} {ExternalOrderId}.",
                externalOrder.Platform,
                externalOrder.ExternalOrderId);
            return externalOrder;
        }
    }

    private async Task PublishOrderCreated(Order order, int tableNumber)
    {
        var payload = new
        {
            OrderId = order.Id,
            order.Id,
            order.RestaurantId,
            order.OrderNumber,
            order.TableId,
            TableNumber = tableNumber,
            Status = order.Status.ToString(),
            Source = order.Source.ToString(),
            order.ExternalPlatform,
            order.ExternalOrderId,
            order.ExternalStatus,
            order.ExternalCustomerName,
            order.ExternalCustomerPhone,
            order.ExternalDeliveryAddress,
            order.ExternalNote,
            order.TotalAmount,
            order.CreatedAt,
            order.Note,
            Items = order.Items.Select(item => new
            {
                item.Id,
                item.ProductId,
                item.ProductName,
                item.Quantity,
                item.UnitPrice,
                item.Note,
                item.RemovedIngredients
            }).ToList()
        };

        await orderHub.Clients.All.SendAsync("OrderCreated", payload);
        await orderHub.Clients.All.SendAsync("OrderUpdated", payload);
        await orderHub.Clients.Group($"restaurant:{order.RestaurantId}").SendAsync("OrderCreated", payload);
        await orderHub.Clients.Group($"restaurant:{order.RestaurantId}:kitchen").SendAsync("OrderCreated", payload);
        await orderHub.Clients.Group($"restaurant:{order.RestaurantId}:waiter").SendAsync("OrderCreated", payload);
        await orderHub.Clients.Group($"restaurant:{order.RestaurantId}:restaurantadmin").SendAsync("OrderCreated", payload);
        await orderHub.Clients.All.SendAsync("NotificationCreated", new
        {
            Type = "ExternalOrderCreated",
            Title = "Harici sipariş geldi",
            Description = $"{order.ExternalPlatform} siparişi {order.OrderNumber} içeri aktarıldı.",
            order.RestaurantId,
            order.TableId,
            TableNumber = tableNumber,
            CreatedAt = order.CreatedAt
        });
    }

    private static OrderStatus MapExternalStatus(string externalStatus)
    {
        return externalStatus.ToLowerInvariant() switch
        {
            "accepted" => OrderStatus.Preparing,
            "ready" => OrderStatus.Ready,
            "delivered" => OrderStatus.Served,
            "completed" => OrderStatus.Served,
            "cancelled" => OrderStatus.Cancelled,
            "canceled" => OrderStatus.Cancelled,
            _ => OrderStatus.New
        };
    }

    private static OrderSource MapOrderSource(ExternalOrderPlatform platform)
    {
        return platform switch
        {
            ExternalOrderPlatform.TrendyolGo => OrderSource.TrendyolGo,
            ExternalOrderPlatform.Yemeksepeti => OrderSource.Yemeksepeti,
            ExternalOrderPlatform.GetirYemek => OrderSource.GetirYemek,
            _ => OrderSource.Unknown
        };
    }

    private static string GetPlatformPrefix(ExternalOrderPlatform platform)
    {
        return platform switch
        {
            ExternalOrderPlatform.TrendyolGo => "TY",
            ExternalOrderPlatform.Yemeksepeti => "YS",
            ExternalOrderPlatform.GetirYemek => "GY",
            _ => "EXT"
        };
    }

    private static string SanitizeError(string message)
    {
        return message.Length > 1000 ? message[..1000] : message;
    }
}
