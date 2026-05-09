using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using QrOrderSystem.Api.Data;
using QrOrderSystem.Api.Entities;
using QrOrderSystem.Api.Enums;
using QrOrderSystem.Api.Hubs;
using QrOrderSystem.Api.Services.Payments;

namespace QrOrderSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentsController(
    AppDbContext dbContext,
    IHubContext<OrderHub> orderHub,
    IPaymentService paymentService,
    IIyzicoPaymentService iyzicoPaymentService,
    IConfiguration configuration,
    ILogger<PaymentsController> logger) : ControllerBase
{
    [HttpGet("tables/{tableId:int}/bill")]
    public async Task<IActionResult> GetTableBill(int tableId, [FromQuery] int restaurantId)
    {
        try
        {
            var scopedRestaurantId = GetScopedRestaurantId(restaurantId);
            var bill = await GetOrCreateOpenBillForTable(scopedRestaurantId, tableId);
            await RecalculateBillTotals(bill.Id);
            await dbContext.SaveChangesAsync();

            return Ok(await BuildReceipt(bill.Id));
        }
        catch (Exception exception) when (IsKnownPaymentException(exception))
        {
            return ToPaymentErrorResult(exception);
        }
    }

    [HttpGet("receipts/{billId:int}")]
    public async Task<IActionResult> GetReceipt(
        int billId,
        [FromQuery] int? restaurantId = null,
        [FromQuery] int? tableId = null)
    {
        try
        {
            var scopedRestaurantId = GetScopedRestaurantId(restaurantId);
            var receipt = await BuildReceipt(billId, scopedRestaurantId, tableId);

            return receipt is null ? NotFound() : Ok(receipt);
        }
        catch (Exception exception) when (IsKnownPaymentException(exception))
        {
            return ToPaymentErrorResult(exception);
        }
    }

    [HttpPost("create")]
    public async Task<IActionResult> CreatePayment(CreatePaymentRequest request)
    {
        try
        {
            if (request.OrderId.HasValue)
            {
                var provider = ParsePaymentProvider(request.Provider, PaymentProvider.MockOnline);
                var payment = await paymentService.CreatePaymentAsync(
                    request.OrderId.Value,
                    provider,
                    request.Currency ?? "TRY",
                    GetRestaurantScope(request.RestaurantId),
                    request.TableSessionToken);

                await PublishPaymentEvent("PaymentCreated", payment);
                return Ok(ToPaymentResponse(payment));
            }

            var restaurantId = GetScopedRestaurantId(request.RestaurantId);
            if (!request.TableId.HasValue)
            {
                return BadRequest("Table id is required.");
            }

            var bill = await GetOrCreateOpenBillForTable(restaurantId, request.TableId.Value);
            await RecalculateBillTotals(bill.Id);
            await dbContext.SaveChangesAsync();

            return Ok(new
            {
                BillId = bill.Id,
                Amount = bill.GrandTotal
            });
        }
        catch (Exception exception) when (IsKnownPaymentException(exception))
        {
            return ToPaymentErrorResult(exception);
        }
    }

    [HttpPost("mock-success")]
    public async Task<IActionResult> MockSuccess(MockPaymentSuccessRequest request)
    {
        try
        {
            var payment = await paymentService.MarkSucceededAsync(
                request.PaymentId,
                GetRestaurantScope(request.RestaurantId),
                request.TableSessionToken);

            await PublishPaymentEvent("PaymentSucceeded", payment);
            await PublishPaymentEvent("OrderPaymentUpdated", payment);

            return Ok(ToPaymentResponse(payment));
        }
        catch (Exception exception) when (IsKnownPaymentException(exception))
        {
            return ToPaymentErrorResult(exception);
        }
    }

    [HttpPost("mock-fail")]
    public async Task<IActionResult> MockFail(MockPaymentFailRequest request)
    {
        try
        {
            var payment = await paymentService.MarkFailedAsync(
                request.PaymentId,
                request.ErrorMessage,
                GetRestaurantScope(request.RestaurantId),
                request.TableSessionToken);

            await PublishPaymentEvent("PaymentFailed", payment);
            await PublishPaymentEvent("OrderPaymentUpdated", payment);

            return Ok(ToPaymentResponse(payment));
        }
        catch (Exception exception) when (IsKnownPaymentException(exception))
        {
            return ToPaymentErrorResult(exception);
        }
    }

    [HttpGet("order/{orderId:int}")]
    public async Task<IActionResult> GetOrderPayments(
        int orderId,
        [FromQuery] int? restaurantId = null,
        [FromQuery] string? tableSessionToken = null)
    {
        try
        {
            var payments = await paymentService.GetOrderPaymentsAsync(
                orderId,
                GetRestaurantScope(restaurantId),
                tableSessionToken);

            return Ok(payments.Select(ToPaymentResponse));
        }
        catch (Exception exception) when (IsKnownPaymentException(exception))
        {
            return ToPaymentErrorResult(exception);
        }
    }

    [Authorize(Roles = "RestaurantAdmin,Waiter,SuperAdmin")]
    [HttpPost("mark-cash-paid")]
    public async Task<IActionResult> MarkCashPaid(MarkCashPaidRequest request)
    {
        try
        {
            var restaurantId = GetScopedRestaurantId(request.RestaurantId);
            var provider = ParsePaymentProvider(request.Provider, PaymentProvider.Cash);
            var payment = await paymentService.MarkCashPaidAsync(request.OrderId, provider, restaurantId);

            await PublishPaymentEvent("PaymentSucceeded", payment);
            await PublishPaymentEvent("OrderPaymentUpdated", payment);

            return Ok(ToPaymentResponse(payment));
        }
        catch (Exception exception) when (IsKnownPaymentException(exception))
        {
            return ToPaymentErrorResult(exception);
        }
    }

    [HttpPost("pay")]
    public async Task<IActionResult> PayBill(PayBillRequest request)
    {
        try
        {
            var result = await ProcessPayment(
                GetScopedRestaurantId(request.RestaurantId),
                request.TableId,
                ParsePaymentMethod(request.PaymentMethod));
            await dbContext.SaveChangesAsync();

            await orderHub.Clients.All.SendAsync("PaymentCompleted", new
            {
                result.Bill.Id,
                result.Bill.RestaurantId,
                result.Bill.TableId,
                result.PaidAmount,
                PaidAt = result.Bill.PaidAt,
                Status = result.Bill.Status.ToString()
            });
            await orderHub.Clients.All.SendAsync("NotificationCreated", new
            {
                Type = "PaymentCompleted",
                Title = "Ödeme alındı",
                Description = $"Masa {result.Bill.TableId} için ödeme tamamlandı.",
                result.Bill.RestaurantId,
                result.Bill.TableId,
                CreatedAt = result.Bill.PaidAt ?? DateTime.UtcNow
            });

            foreach (var payment in result.Payments)
            {
                await PublishPaymentEvent("PaymentSucceeded", payment);
                await PublishPaymentEvent("OrderPaymentUpdated", payment);
            }

            return Ok(new
            {
                BillId = result.Bill.Id,
                PaidAmount = result.PaidAmount,
                Status = result.Bill.Status.ToString(),
                Receipt = await BuildReceipt(result.Bill.Id, result.Bill.RestaurantId, result.Bill.TableId)
            });
        }
        catch (Exception exception) when (IsKnownPaymentException(exception))
        {
            return ToPaymentErrorResult(exception);
        }
    }

    [HttpPost("iyzico/checkout")]
    public async Task<IActionResult> CreateIyzicoCheckout(IyzicoCheckoutRequest request)
    {
        try
        {
            var checkout = await iyzicoPaymentService.CreateCheckoutAsync(request.BillId, HttpContext.RequestAborted);

            return Ok(new
            {
                checkout.PaymentPageUrl,
                checkout.Token,
                checkout.BillId
            });
        }
        catch (Exception exception) when (IsKnownPaymentException(exception))
        {
            return ToPaymentErrorResult(exception);
        }
    }

    [HttpPost("iyzico/callback")]
    public async Task<IActionResult> IyzicoCallback()
    {
        try
        {
            var token = await ReadIyzicoCallbackToken();
            var callback = await iyzicoPaymentService.CompleteCheckoutAsync(token ?? string.Empty, HttpContext.RequestAborted);

            if (callback.IsSuccessful)
            {
                await PublishPaymentEvent("PaymentSucceeded", callback.Payment);
                await PublishPaymentEvent("OrderPaymentUpdated", callback.Payment);
                await PublishBillPaidEvents(callback.Payment);
            }
            else
            {
                await PublishPaymentEvent("PaymentFailed", callback.Payment);
                await PublishPaymentEvent("OrderPaymentUpdated", callback.Payment);
            }

            return Redirect(BuildPaymentResultUrl(callback.IsSuccessful, callback.BillId));
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "iyzico callback failed before redirecting to payment result.");
            return Redirect(BuildPaymentResultUrl(false, null));
        }
    }

    private async Task<string?> ReadIyzicoCallbackToken()
    {
        if (Request.HasFormContentType)
        {
            var form = await Request.ReadFormAsync(HttpContext.RequestAborted);
            return form["token"].FirstOrDefault();
        }

        return Request.Query["token"].FirstOrDefault();
    }

    private IActionResult ToPaymentErrorResult(Exception exception)
    {
        if (exception is KeyNotFoundException ||
            exception.Message == "Table not found." ||
            exception.Message == "Bill not found.")
        {
            return NotFound(exception.Message);
        }

        if (exception is UnauthorizedAccessException)
        {
            return Unauthorized(exception.Message);
        }

        return BadRequest(exception.Message);
    }

    private static bool IsKnownPaymentException(Exception exception)
    {
        return exception is InvalidOperationException or UnauthorizedAccessException or KeyNotFoundException;
    }

    private async Task<Bill> GetOrCreateOpenBillForTable(int restaurantId, int tableId)
    {
        var tableExists = await dbContext.RestaurantTables
            .AnyAsync(table =>
                table.Id == tableId &&
                table.Branch.RestaurantId == restaurantId);

        if (!tableExists)
        {
            throw new InvalidOperationException("Table not found.");
        }

        var bill = await dbContext.Bills
            .FirstOrDefaultAsync(bill =>
                bill.RestaurantId == restaurantId &&
                bill.TableId == tableId &&
                bill.Status == BillStatus.Open);

        if (bill is not null)
        {
            return bill;
        }

        var unpaidOrders = await dbContext.Orders
            .Where(order =>
                order.TableId == tableId &&
                order.RestaurantId == restaurantId &&
                !order.IsPaid &&
                order.Status != OrderStatus.Paid &&
                order.Status != OrderStatus.Cancelled)
            .ToListAsync();

        if (unpaidOrders.Count == 0)
        {
            throw new InvalidOperationException("No unpaid orders found for this table.");
        }

        var now = DateTime.UtcNow;
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

        foreach (var order in unpaidOrders)
        {
            order.BillId = bill.Id;
        }

        return bill;
    }

    private async Task RecalculateBillTotals(int billId)
    {
        var bill = await dbContext.Bills
            .FirstAsync(bill => bill.Id == billId);
        var subTotal = await dbContext.OrderItems
            .Where(item =>
                item.Order.BillId == billId &&
                !item.Order.IsPaid &&
                item.Order.Status != OrderStatus.Paid &&
                item.Order.Status != OrderStatus.Cancelled)
            .SumAsync(item => item.UnitPrice * item.Quantity);

        bill.SubTotal = subTotal;
        bill.TaxAmount = 0;
        bill.DiscountAmount = 0;
        bill.GrandTotal = subTotal;
        bill.TotalAmount = subTotal;
    }

    private async Task<PaymentResult> ProcessPayment(
        int restaurantId,
        int tableId,
        PaymentMethod paymentMethod)
    {
        var bill = await GetOrCreateOpenBillForTable(restaurantId, tableId);
        await RecalculateBillTotals(bill.Id);

        if (bill.GrandTotal <= 0)
        {
            throw new InvalidOperationException("No payable amount found for this table.");
        }

        var orders = await dbContext.Orders
            .Include(order => order.Items)
            .Where(order =>
                order.BillId == bill.Id &&
                order.RestaurantId == restaurantId &&
                !order.IsPaid &&
                order.Status != OrderStatus.Paid &&
                order.Status != OrderStatus.Cancelled)
            .ToListAsync();

        var now = DateTime.UtcNow;
        var provider = paymentMethod == PaymentMethod.Cash
            ? PaymentProvider.Cash
            : PaymentProvider.Pos;
        var payments = new List<Payment>();

        foreach (var order in orders)
        {
            var orderAmount = order.Items.Sum(item => item.UnitPrice * item.Quantity);
            var payment = new Payment
            {
                OrderId = order.Id,
                RestaurantId = order.RestaurantId,
                TableId = order.TableId,
                BillId = bill.Id,
                Provider = provider,
                Status = PaymentStatus.Paid,
                Amount = orderAmount,
                Currency = "TRY",
                Method = paymentMethod.ToString(),
                CreatedAt = now,
                UpdatedAt = now,
                PaidAt = now
            };

            dbContext.Payments.Add(payment);
            payments.Add(payment);

            order.Status = OrderStatus.Paid;
            order.IsPaid = true;
            order.PaymentStatus = PaymentStatus.Paid;
            order.PaymentProvider = provider;
            order.PaidAt ??= now;
        }

        bill.Status = BillStatus.Paid;
        bill.PaymentMethod = paymentMethod;
        bill.PaidAt = now;
        bill.ClosedAt = now;

        return new PaymentResult(bill, bill.GrandTotal, payments);
    }

    private async Task<object?> BuildReceipt(int billId, int? restaurantId = null, int? tableId = null)
    {
        var billsQuery = dbContext.Bills
            .AsNoTracking()
            .Include(bill => bill.Restaurant)
            .Include(bill => bill.Table)
            .Include(bill => bill.Orders)
            .ThenInclude(order => order.Items)
            .Include(bill => bill.Payments)
            .Where(bill => bill.Id == billId);

        if (restaurantId.HasValue)
        {
            billsQuery = billsQuery.Where(bill => bill.RestaurantId == restaurantId.Value);
        }

        if (tableId.HasValue)
        {
            billsQuery = billsQuery.Where(bill => bill.TableId == tableId.Value);
        }

        var bill = await billsQuery.FirstOrDefaultAsync();

        if (bill is null)
        {
            return null;
        }

        var items = bill.Orders
            .Where(order => order.Status != OrderStatus.Cancelled)
            .SelectMany(order => order.Items)
            .GroupBy(item => new { item.ProductId, item.ProductName, item.UnitPrice })
            .Select(group => new
            {
                group.Key.ProductName,
                Quantity = group.Sum(item => item.Quantity),
                group.Key.UnitPrice,
                RemovedIngredients = string.Join(", ",
                    group.Select(item => item.RemovedIngredients)
                        .Where(value => value != null)
                        .Distinct()),
                LineTotal = group.Sum(item => item.UnitPrice * item.Quantity)
            })
            .ToList();

        return new
        {
            bill.Id,
            bill.RestaurantId,
            RestaurantName = bill.Restaurant.Name,
            bill.TableId,
            bill.Table.TableNumber,
            bill.BillNumber,
            Status = bill.Status.ToString(),
            bill.SubTotal,
            bill.TaxAmount,
            bill.DiscountAmount,
            bill.GrandTotal,
            PaymentMethod = bill.PaymentMethod?.ToString(),
            bill.CreatedAt,
            bill.PaidAt,
            Items = items,
            Payments = bill.Payments
                .OrderByDescending(payment => payment.CreatedAt)
                .Select(ToPaymentResponse)
                .ToList()
        };
    }

    private async Task PublishPaymentEvent(string eventName, Payment payment)
    {
        var payload = ToPaymentResponse(payment);
        await orderHub.Clients.All.SendAsync(eventName, payload);
        await orderHub.Clients.Group($"restaurant:{payment.RestaurantId}").SendAsync(eventName, payload);
        await orderHub.Clients.Group($"restaurant:{payment.RestaurantId}:waiter").SendAsync(eventName, payload);
        await orderHub.Clients.Group($"restaurant:{payment.RestaurantId}:restaurantadmin").SendAsync(eventName, payload);

        if (payment.Order is not null)
        {
            var orderPayload = ToOrderPaymentPayload(payment.Order);
            await orderHub.Clients.All.SendAsync("OrderUpdated", orderPayload);
            await orderHub.Clients.Group($"restaurant:{payment.RestaurantId}").SendAsync("OrderUpdated", orderPayload);
            await orderHub.Clients.Group($"restaurant:{payment.RestaurantId}:waiter").SendAsync("OrderUpdated", orderPayload);
            await orderHub.Clients.Group($"restaurant:{payment.RestaurantId}:restaurantadmin").SendAsync("OrderUpdated", orderPayload);
        }

        await orderHub.Clients.Group($"restaurant:{payment.RestaurantId}:waiter").SendAsync("NotificationCreated", new
        {
            Type = eventName,
            Title = payment.Status == PaymentStatus.Paid ? "Ödeme başarılı" : "Ödeme güncellendi",
            Description = $"{payment.Amount} {payment.Currency} ödeme durumu {payment.Status}.",
            payment.RestaurantId,
            payment.TableId,
            CreatedAt = payment.UpdatedAt
        });
    }

    private async Task PublishBillPaidEvents(Payment payment)
    {
        if (payment.Bill is null)
        {
            return;
        }

        await orderHub.Clients.All.SendAsync("PaymentCompleted", new
        {
            Id = payment.Bill.Id,
            payment.Bill.RestaurantId,
            payment.Bill.TableId,
            PaidAmount = payment.Amount,
            PaidAt = payment.Bill.PaidAt,
            Status = payment.Bill.Status.ToString()
        });

        foreach (var order in payment.Bill.Orders)
        {
            var orderPayload = ToOrderPaymentPayload(order);
            await orderHub.Clients.All.SendAsync("OrderUpdated", orderPayload);
            await orderHub.Clients.Group($"restaurant:{payment.RestaurantId}").SendAsync("OrderUpdated", orderPayload);
            await orderHub.Clients.Group($"restaurant:{payment.RestaurantId}:waiter").SendAsync("OrderUpdated", orderPayload);
            await orderHub.Clients.Group($"restaurant:{payment.RestaurantId}:restaurantadmin").SendAsync("OrderUpdated", orderPayload);
        }
    }

    private string BuildPaymentResultUrl(bool isSuccessful, int? billId)
    {
        var frontendUrl = configuration["FRONTEND_URL"]?.TrimEnd('/');

        if (string.IsNullOrWhiteSpace(frontendUrl))
        {
            frontendUrl = string.Empty;
        }

        var status = isSuccessful ? "success" : "failed";
        var billQuery = billId.HasValue ? $"&billId={billId.Value}" : string.Empty;

        return $"{frontendUrl}/payment-result?status={status}{billQuery}";
    }

    private static object ToPaymentResponse(Payment payment)
    {
        return new
        {
            PaymentId = payment.Id,
            payment.Id,
            payment.OrderId,
            payment.RestaurantId,
            payment.TableId,
            Provider = payment.Provider.ToString(),
            Status = payment.Status.ToString(),
            payment.Amount,
            payment.Currency,
            payment.TransactionId,
            payment.ProviderPaymentId,
            payment.Token,
            payment.PaymentUrl,
            payment.ErrorMessage,
            payment.CreatedAt,
            payment.UpdatedAt,
            payment.PaidAt
        };
    }

    private static object ToOrderPaymentPayload(Order order)
    {
        return new
        {
            OrderId = order.Id,
            order.Id,
            order.RestaurantId,
            order.OrderNumber,
            order.TableId,
            Status = order.Status.ToString(),
            order.TotalAmount,
            PaymentStatus = order.PaymentStatus == null ? null : order.PaymentStatus.ToString(),
            PaymentProvider = order.PaymentProvider == null ? null : order.PaymentProvider.ToString(),
            order.IsPaid,
            order.PaidAt,
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
    }

    private static PaymentMethod ParsePaymentMethod(string method)
    {
        return Enum.TryParse<PaymentMethod>(method, ignoreCase: true, out var parsedMethod)
            ? parsedMethod
            : PaymentMethod.Card;
    }

    private static PaymentProvider ParsePaymentProvider(string? provider, PaymentProvider fallback)
    {
        return Enum.TryParse<PaymentProvider>(provider, ignoreCase: true, out var parsedProvider)
            ? parsedProvider
            : fallback;
    }

    private int? GetRestaurantScope(int? requestedRestaurantId)
    {
        if (User.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        if (User.IsInRole(UserRole.SuperAdmin.ToString()))
        {
            return requestedRestaurantId;
        }

        return GetRestaurantIdFromClaim();
    }

    private int GetScopedRestaurantId(int? requestedRestaurantId)
    {
        if (User.Identity?.IsAuthenticated != true)
        {
            if (!requestedRestaurantId.HasValue)
            {
                throw new InvalidOperationException("Restaurant id is required.");
            }

            return requestedRestaurantId.Value;
        }

        if (User.IsInRole(UserRole.SuperAdmin.ToString()))
        {
            if (!requestedRestaurantId.HasValue)
            {
                throw new InvalidOperationException("Restaurant id is required.");
            }

            return requestedRestaurantId.Value;
        }

        return GetRestaurantIdFromClaim();
    }

    private int GetRestaurantIdFromClaim()
    {
        var claimValue = User.FindFirst("restaurantId")?.Value;

        if (!int.TryParse(claimValue, out var restaurantId))
        {
            throw new UnauthorizedAccessException("Restaurant claim is missing.");
        }

        return restaurantId;
    }

    public record CreatePaymentRequest(
        int? RestaurantId,
        int? TableId,
        int? OrderId,
        string? Provider,
        string? Currency,
        string? TableSessionToken);

    public record MockPaymentSuccessRequest(
        int PaymentId,
        int? RestaurantId,
        string? TableSessionToken);

    public record MockPaymentFailRequest(
        int PaymentId,
        string? ErrorMessage,
        int? RestaurantId,
        string? TableSessionToken);

    public record MarkCashPaidRequest(
        int OrderId,
        string Provider,
        int? RestaurantId);

    public record PayBillRequest(int RestaurantId, int TableId, string PaymentMethod);

    public record IyzicoCheckoutRequest(int BillId);

    private record PaymentResult(Bill Bill, decimal PaidAmount, IReadOnlyList<Payment> Payments);
}
