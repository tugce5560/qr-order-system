using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QrOrderSystem.Api.Data;
using QrOrderSystem.Api.Entities;
using QrOrderSystem.Api.Enums;
using QrOrderSystem.Api.Hubs;
using System.Security.Claims;

namespace QrOrderSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrdersController(
    AppDbContext dbContext,
    IHubContext<OrderHub> orderHubContext) : ControllerBase
{
    private static readonly TimeSpan TableSessionDuration = TimeSpan.FromHours(2);
    private static readonly TimeSpan OrderCooldown = TimeSpan.FromSeconds(30);

    [HttpGet]
    public async Task<IActionResult> GetOrders(
        [FromQuery] int? restaurantId = null,
        [FromQuery] int? tableId = null)
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            if (User.IsInRole(UserRole.SuperAdmin.ToString()))
            {
                return Ok(await BuildOrdersQuery(restaurantId, tableId).ToListAsync());
            }

            restaurantId = GetRestaurantId();
        }
        else if (restaurantId is null || tableId is null)
        {
            return Unauthorized();
        }

        var tableBelongsToRestaurant = await dbContext.RestaurantTables
            .AsNoTracking()
            .AnyAsync(table =>
                (!tableId.HasValue || table.Id == tableId.Value) &&
                table.Branch.RestaurantId == restaurantId.Value);

        if (tableId.HasValue && !tableBelongsToRestaurant)
        {
            return NotFound("Table not found for this restaurant.");
        }

        var orders = await BuildOrdersQuery(restaurantId, tableId).ToListAsync();

        return Ok(orders);
    }

    private IQueryable<object> BuildOrdersQuery(int? restaurantId, int? tableId)
    {
        var ordersQuery = dbContext.Orders
            .AsNoTracking()
            .Include(order => order.Items)
            .AsQueryable();

        if (restaurantId.HasValue)
        {
            ordersQuery = ordersQuery.Where(order => order.RestaurantId == restaurantId.Value);
        }

        if (tableId.HasValue)
        {
            ordersQuery = ordersQuery.Where(order => order.TableId == tableId.Value);
        }

        return ordersQuery
            .OrderBy(order => order.CreatedAt)
            .Select(order => new
            {
                order.Id,
                order.OrderNumber,
                order.TableId,
                Status = order.Status.ToString(),
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
            });
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrder(CreateOrderRequest request)
    {
        if (request.Items.Count == 0)
        {
            return BadRequest("Order must contain at least one item.");
        }

        var now = DateTime.UtcNow;

        var table = await dbContext.RestaurantTables
            .AsNoTracking()
            .Include(table => table.Branch)
            .FirstOrDefaultAsync(table =>
                table.Id == request.TableId &&
                table.Branch.RestaurantId == request.RestaurantId);

        if (table is null)
        {
            return BadRequest("Table not found for this restaurant.");
        }

        var tableSession = await dbContext.TableSessions
            .FirstOrDefaultAsync(session =>
                session.RestaurantId == request.RestaurantId &&
                session.TableId == request.TableId &&
                session.Token == request.TableSessionToken &&
                session.IsActive);

        if (tableSession is null)
        {
            return Unauthorized("Invalid table session. Please scan the QR code again.");
        }

        if (tableSession.ExpiresAt <= now ||
            tableSession.CreatedAt.Add(TableSessionDuration) <= now)
        {
            tableSession.IsActive = false;
            await dbContext.SaveChangesAsync();
            return Unauthorized("Table session expired. Please scan the QR code again.");
        }

        if (tableSession.LastOrderAt.HasValue &&
            now - tableSession.LastOrderAt.Value < OrderCooldown)
        {
            return StatusCode(StatusCodes.Status429TooManyRequests,
                "Please wait before sending another order.");
        }

        var productIds = request.Items
            .Select(item => item.ProductId)
            .Distinct()
            .ToList();

        var products = await dbContext.Products
            .Where(product =>
                productIds.Contains(product.Id) &&
                product.Category.RestaurantId == request.RestaurantId)
            .ToListAsync();

        if (products.Count != productIds.Count)
        {
            return BadRequest("One or more products were not found.");
        }

        var orderItems = request.Items
            .GroupBy(item => new
            {
                item.ProductId,
                Note = string.IsNullOrWhiteSpace(item.Note) ? null : item.Note.Trim(),
                RemovedIngredients = string.IsNullOrWhiteSpace(item.RemovedIngredients)
                    ? null
                    : item.RemovedIngredients.Trim()
            })
            .Select(group =>
            {
                var product = products.Single(product => product.Id == group.Key.ProductId);
                var quantity = group.Sum(item => item.Quantity);

                return new OrderItem
                {
                    ProductId = product.Id,
                    ProductName = product.Name,
                    UnitPrice = product.Price,
                    Quantity = quantity,
                    Note = group.Key.Note,
                    RemovedIngredients = group.Key.RemovedIngredients
                };
            })
            .ToList();

        if (orderItems.Any(item => item.Quantity <= 0))
        {
            return BadRequest("Item quantity must be greater than zero.");
        }

        var totalAmount = orderItems.Sum(item => item.UnitPrice * item.Quantity);
        var bill = await GetOrCreateOpenBill(request.RestaurantId, request.TableId, now);

        var order = new Order
        {
            RestaurantId = request.RestaurantId,
            BranchId = table.BranchId,
            TableId = request.TableId,
            BillId = bill.Id,
            OrderNumber = "TEMP",
            Status = OrderStatus.New,
            Source = OrderSource.QR,
            TotalAmount = totalAmount,
            CreatedAt = now,
            Items = orderItems
        };

        tableSession.LastOrderAt = now;
        dbContext.Orders.Add(order);
        await dbContext.SaveChangesAsync();

        order.OrderNumber = $"#T{table.TableNumber}-{order.Id:D4}";
        await RecalculateBillTotals(bill.Id);
        await dbContext.SaveChangesAsync();

        var orderPayload = ToOrderEventPayload(order, null, null, table.TableNumber);
        await orderHubContext.Clients.All.SendAsync("OrderCreated", orderPayload);
        await orderHubContext.Clients.All.SendAsync("OrderUpdated", orderPayload);
        await orderHubContext.Clients.Group($"restaurant:{request.RestaurantId}").SendAsync("OrderCreated", orderPayload);
        await orderHubContext.Clients.Group($"restaurant:{request.RestaurantId}").SendAsync("OrderUpdated", orderPayload);
        await orderHubContext.Clients.Group($"restaurant:{request.RestaurantId}:kitchen").SendAsync("OrderCreated", orderPayload);
        await orderHubContext.Clients.Group($"restaurant:{request.RestaurantId}:waiter").SendAsync("OrderCreated", orderPayload);
        await orderHubContext.Clients.Group($"restaurant:{request.RestaurantId}:restaurantadmin").SendAsync("OrderCreated", orderPayload);
        await orderHubContext.Clients.All.SendAsync("NotificationCreated", new
        {
            Type = "OrderCreated",
            Title = "Yeni sipariş geldi",
            Description = $"{order.OrderNumber} mutfağa düştü.",
            order.RestaurantId,
            order.TableId,
            table.TableNumber,
            CreatedAt = order.CreatedAt
        });
        await orderHubContext.Clients.Group($"restaurant:{request.RestaurantId}:kitchen").SendAsync("NotificationCreated", new
        {
            Type = "OrderCreated",
            Title = "Yeni sipariş geldi",
            Description = $"{order.OrderNumber} mutfağa düştü.",
            order.RestaurantId,
            order.TableId,
            table.TableNumber,
            CreatedAt = order.CreatedAt
        });
        await orderHubContext.Clients.Group($"restaurant:{request.RestaurantId}:waiter").SendAsync("NotificationCreated", new
        {
            Type = "OrderCreated",
            Title = "Yeni sipariş geldi",
            Description = $"{order.OrderNumber} mutfağa düştü.",
            order.RestaurantId,
            order.TableId,
            table.TableNumber,
            CreatedAt = order.CreatedAt
        });

        return Ok(new CreateOrderResponse(order.Id, order.TotalAmount));
    }

    [HttpPatch("{orderId:int}/status")]
    [Authorize(Roles = "RestaurantAdmin,Kitchen,Waiter")]
    public async Task<IActionResult> UpdateOrderStatus(
        int orderId,
        UpdateOrderStatusRequest request)
    {
        var restaurantId = GetRestaurantId();

        var order = await dbContext.Orders
            .Include(order => order.Items)
            .Include(order => order.Table)
            .Include(order => order.Bill)
            .FirstOrDefaultAsync(order =>
                order.Id == orderId &&
                order.RestaurantId == restaurantId);

        if (order is null)
        {
            return NotFound();
        }

        if (!Enum.TryParse<OrderStatus>(request.Status, ignoreCase: true, out var status))
        {
            return BadRequest("Invalid order status.");
        }

        if (order.Status == OrderStatus.Paid || order.Bill?.Status == BillStatus.Paid)
        {
            return BadRequest("Ödenmiş sipariş veya adisyon düzenlenemez.");
        }

        if (User.IsInRole(UserRole.Kitchen.ToString()) &&
            status is not (OrderStatus.Preparing or OrderStatus.Ready))
        {
            return Forbid();
        }

        if (User.IsInRole(UserRole.Waiter.ToString()) &&
            status != OrderStatus.Served)
        {
            return Forbid();
        }

        order.Status = status;
        SetStatusTimestamp(order, status);
        await dbContext.SaveChangesAsync();

        var orderPayload = ToOrderEventPayload(order, null, null, order.Table?.TableNumber);
        await orderHubContext.Clients.All.SendAsync("OrderUpdated", orderPayload);
        await orderHubContext.Clients.All.SendAsync("OrderStatusUpdated", orderPayload);
        await orderHubContext.Clients.Group($"restaurant:{restaurantId}").SendAsync("OrderUpdated", orderPayload);
        await orderHubContext.Clients.Group($"restaurant:{restaurantId}").SendAsync("OrderStatusUpdated", orderPayload);
        await orderHubContext.Clients.Group($"restaurant:{restaurantId}:kitchen").SendAsync("OrderUpdated", orderPayload);
        await orderHubContext.Clients.Group($"restaurant:{restaurantId}:kitchen").SendAsync("OrderStatusUpdated", orderPayload);
        await orderHubContext.Clients.Group($"restaurant:{restaurantId}:waiter").SendAsync("OrderUpdated", orderPayload);
        await orderHubContext.Clients.Group($"restaurant:{restaurantId}:waiter").SendAsync("OrderStatusUpdated", orderPayload);
        await orderHubContext.Clients.Group($"restaurant:{restaurantId}:restaurantadmin").SendAsync("OrderUpdated", orderPayload);
        await orderHubContext.Clients.Group($"restaurant:{restaurantId}:restaurantadmin").SendAsync("OrderStatusUpdated", orderPayload);
        await orderHubContext.Clients.All.SendAsync("NotificationCreated", new
        {
            Type = "OrderStatusUpdated",
            Title = "Sipariş durumu değişti",
            Description = $"{order.OrderNumber} durumu {order.Status} oldu.",
            order.RestaurantId,
            order.TableId,
            TableNumber = order.Table?.TableNumber,
            Message = $"{order.OrderNumber} durumu {order.Status} oldu.",
            CreatedAt = DateTime.UtcNow
        });
        await orderHubContext.Clients.Group($"restaurant:{restaurantId}:kitchen").SendAsync("NotificationCreated", new
        {
            Type = "OrderStatusUpdated",
            Title = "Sipariş durumu değişti",
            Description = $"{order.OrderNumber} durumu {order.Status} oldu.",
            order.RestaurantId,
            order.TableId,
            TableNumber = order.Table?.TableNumber,
            Message = $"{order.OrderNumber} durumu {order.Status} oldu.",
            CreatedAt = DateTime.UtcNow
        });
        await orderHubContext.Clients.Group($"restaurant:{restaurantId}:waiter").SendAsync("NotificationCreated", new
        {
            Type = "OrderStatusUpdated",
            Title = "Sipariş durumu değişti",
            Description = $"{order.OrderNumber} durumu {order.Status} oldu.",
            order.RestaurantId,
            order.TableId,
            TableNumber = order.Table?.TableNumber,
            Message = $"{order.OrderNumber} durumu {order.Status} oldu.",
            CreatedAt = DateTime.UtcNow
        });

        return Ok(new { order.Id, Status = order.Status.ToString() });
    }

    [HttpPut("{orderId:int}/items")]
    [Authorize(Roles = "Waiter,RestaurantAdmin")]
    public async Task<IActionResult> UpdateOrderItems(int orderId, UpdateOrderItemsRequest request)
    {
        var restaurantId = GetRestaurantId();

        var order = await dbContext.Orders
            .Include(order => order.Items)
            .Include(order => order.Bill)
            .FirstOrDefaultAsync(order =>
                order.Id == orderId &&
                order.RestaurantId == restaurantId);

        if (order is null)
        {
            return NotFound();
        }

        if (order.Status == OrderStatus.Ready ||
            order.Status == OrderStatus.Served ||
            order.Status == OrderStatus.Paid ||
            order.Status == OrderStatus.Cancelled)
        {
            return BadRequest("Bu sipariş artık düzenlenemez.");
        }

        if (order.Bill?.Status == BillStatus.Paid)
        {
            return BadRequest("Ödenmiş adisyon içindeki sipariş düzenlenemez.");
        }

        if (request.Items.Count == 0)
        {
            return BadRequest("Sipariş en az bir ürün içermelidir.");
        }

        var productIds = request.Items
            .Select(item => item.ProductId)
            .Distinct()
            .ToList();

        var products = await dbContext.Products
            .AsNoTracking()
            .Where(product =>
                productIds.Contains(product.Id) &&
                product.Category.RestaurantId == restaurantId)
            .ToDictionaryAsync(product => product.Id);

        if (products.Count != productIds.Count)
        {
            return BadRequest("Geçersiz ürün seçimi.");
        }

        var oldSummary = string.Join(", ", order.Items.Select(item =>
            $"{item.Quantity}x {item.ProductName}"));

        // Remove existing items
        dbContext.OrderItems.RemoveRange(order.Items);

        // Add new items
        var orderItems = new List<OrderItem>();
        foreach (var itemRequest in request.Items)
        {
            if (itemRequest.Quantity <= 0)
            {
                return BadRequest("Ürün adedi sıfırdan büyük olmalı.");
            }

            var product = products[itemRequest.ProductId];
            orderItems.Add(new OrderItem
            {
                ProductId = itemRequest.ProductId,
                ProductName = product.Name,
                Quantity = itemRequest.Quantity,
                UnitPrice = product.Price,
                Note = itemRequest.Note,
                RemovedIngredients = itemRequest.RemovedIngredients
            });
        }

        order.Items = orderItems;
        order.TotalAmount = orderItems.Sum(item => item.UnitPrice * item.Quantity);
        order.Note = request.OrderNote;

        // Log activity
        var userId = GetUserId();
        var newSummary = string.Join(", ", orderItems.Select(item =>
            $"{item.Quantity}x {item.ProductName}"));

        dbContext.OrderActivityLogs.Add(new OrderActivityLog
        {
            OrderId = order.Id,
            UserId = userId,
            Action = "EditedByWaiter",
            OldSummary = oldSummary,
            NewSummary = newSummary,
            CreatedAt = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync();

        // Recalculate bill totals
        if (order.BillId.HasValue)
        {
            await RecalculateBillTotals(order.BillId.Value);
            await dbContext.SaveChangesAsync();
        }

        var orderPayload = ToOrderEventPayload(order, userId, "Sipariş garson tarafından güncellendi.", order.Table?.TableNumber);
        await orderHubContext.Clients.All.SendAsync("OrderUpdated", orderPayload);
        await orderHubContext.Clients.All.SendAsync("NotificationCreated", new
        {
            Type = "OrderEdited",
            Title = "Sipariş güncellendi",
            Description = $"Masa {order.Table?.TableNumber} siparişi garson tarafından düzenlendi.",
            order.RestaurantId,
            order.TableId,
            TableNumber = order.Table?.TableNumber,
            UpdatedBy = userId,
            Message = "Sipariş garson tarafından güncellendi.",
            CreatedAt = DateTime.UtcNow
        });

        return Ok(orderPayload);
    }

    private static void SetStatusTimestamp(Order order, OrderStatus status)
    {
        var now = DateTime.UtcNow;

        switch (status)
        {
            case OrderStatus.Preparing:
                order.PreparingAt ??= now;
                break;
            case OrderStatus.Ready:
                order.ReadyAt ??= now;
                break;
            case OrderStatus.Served:
                order.ServedAt ??= now;
                break;
            case OrderStatus.Paid:
                order.PaidAt ??= now;
                break;
            case OrderStatus.Cancelled:
                order.CancelledAt ??= now;
                break;
        }
    }

    private async Task<Bill> GetOrCreateOpenBill(int restaurantId, int tableId, DateTime now)
    {
        var bill = await dbContext.Bills
            .FirstOrDefaultAsync(bill =>
                bill.RestaurantId == restaurantId &&
                bill.TableId == tableId &&
                bill.Status == BillStatus.Open);

        if (bill is not null)
        {
            return bill;
        }

        bill = new Bill
        {
            RestaurantId = restaurantId,
            TableId = tableId,
            BillNumber = "TEMP",
            Status = BillStatus.Open,
            CreatedAt = now,
            OpenedAt = now
        };

        dbContext.Bills.Add(bill);
        await dbContext.SaveChangesAsync();

        bill.BillNumber = $"BILL-{restaurantId}-{tableId}-{bill.Id:D6}";
        await dbContext.SaveChangesAsync();

        return bill;
    }

    private async Task RecalculateBillTotals(int billId)
    {
        var bill = await dbContext.Bills
            .FirstAsync(bill => bill.Id == billId);
        var subTotal = await dbContext.OrderItems
            .Where(item =>
                item.Order.BillId == billId &&
                item.Order.Status != OrderStatus.Cancelled)
            .SumAsync(item => item.UnitPrice * item.Quantity);

        bill.SubTotal = subTotal;
        bill.TaxAmount = 0;
        bill.DiscountAmount = 0;
        bill.GrandTotal = subTotal;
        bill.TotalAmount = subTotal;
    }

    private static object ToOrderEventPayload(Order order, int? updatedBy = null, string? message = null, int? tableNumber = null)
    {
        return new
        {
            OrderId = order.Id,
            order.Id,
            order.RestaurantId,
            order.OrderNumber,
            order.TableId,
            TableNumber = tableNumber,
            Status = order.Status.ToString(),
            order.TotalAmount,
            order.CreatedAt,
            order.Note,
            UpdatedBy = updatedBy,
            Message = message,
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

    public record CreateOrderRequest(
        int RestaurantId,
        int TableId,
        List<CreateOrderItemRequest> Items,
        string TableSessionToken);

    public record CreateOrderItemRequest(
        int ProductId,
        int Quantity,
        string? Note,
        string? RemovedIngredients);

    public record CreateOrderResponse(int OrderId, decimal TotalAmount);

    public record UpdateOrderItemsRequest(
        List<UpdateOrderItemRequest> Items,
        string? OrderNote);

    public record UpdateOrderItemRequest(
        int ProductId,
        int Quantity,
        string? Note,
        string? RemovedIngredients);

    public record UpdateOrderStatusRequest(string Status);
}
