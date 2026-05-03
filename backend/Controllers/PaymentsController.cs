using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using QrOrderSystem.Api.Data;
using QrOrderSystem.Api.Entities;
using QrOrderSystem.Api.Enums;
using QrOrderSystem.Api.Hubs;

namespace QrOrderSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentsController(AppDbContext dbContext, IHubContext<OrderHub> orderHub) : ControllerBase
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
        catch (InvalidOperationException exception)
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
        catch (InvalidOperationException exception)
        {
            return ToPaymentErrorResult(exception);
        }
    }

    [HttpPost("create")]
    public async Task<IActionResult> CreatePayment(CreatePaymentRequest request)
    {
        try
        {
            var restaurantId = GetScopedRestaurantId(request.RestaurantId);
            var bill = await GetOrCreateOpenBillForTable(restaurantId, request.TableId);
            await RecalculateBillTotals(bill.Id);
            await dbContext.SaveChangesAsync();

            return Ok(new
            {
                BillId = bill.Id,
                Amount = bill.GrandTotal
            });
        }
        catch (InvalidOperationException exception)
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

            return Ok(new
            {
                BillId = result.Bill.Id,
                PaidAmount = result.PaidAmount,
                Status = result.Bill.Status.ToString(),
                Receipt = await BuildReceipt(result.Bill.Id, result.Bill.RestaurantId, result.Bill.TableId)
            });
        }
        catch (InvalidOperationException exception)
        {
            return ToPaymentErrorResult(exception);
        }
    }

    private IActionResult ToPaymentErrorResult(InvalidOperationException exception)
    {
        if (exception.Message == "Table not found." || exception.Message == "Bill not found.")
        {
            return NotFound(exception.Message);
        }

        return BadRequest(exception.Message);
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
            .Where(order =>
                order.BillId == bill.Id &&
                order.RestaurantId == restaurantId &&
                order.Status != OrderStatus.Paid &&
                order.Status != OrderStatus.Cancelled)
            .ToListAsync();

        var now = DateTime.UtcNow;
        var payment = new Payment
        {
            Bill = bill,
            Amount = bill.GrandTotal,
            Method = paymentMethod.ToString(),
            PaidAt = now
        };

        dbContext.Payments.Add(payment);

        foreach (var order in orders)
        {
            order.Status = OrderStatus.Paid;
            order.PaidAt ??= now;
        }

        bill.Status = BillStatus.Paid;
        bill.PaymentMethod = paymentMethod;
        bill.PaidAt = now;
        bill.ClosedAt = now;

        return new PaymentResult(bill, bill.GrandTotal);
    }

    private async Task<object?> BuildReceipt(int billId, int? restaurantId = null, int? tableId = null)
    {
        var billsQuery = dbContext.Bills
            .AsNoTracking()
            .Include(bill => bill.Restaurant)
            .Include(bill => bill.Table)
            .Include(bill => bill.Orders)
            .ThenInclude(order => order.Items)
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
            Items = items
        };
    }

    private static PaymentMethod ParsePaymentMethod(string method)
    {
        return Enum.TryParse<PaymentMethod>(method, ignoreCase: true, out var parsedMethod)
            ? parsedMethod
            : PaymentMethod.Card;
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

        var claimValue = User.FindFirst("restaurantId")?.Value;

        if (!int.TryParse(claimValue, out var restaurantId))
        {
            throw new UnauthorizedAccessException("Restaurant claim is missing.");
        }

        return restaurantId;
    }

    public record CreatePaymentRequest(int RestaurantId, int TableId);

    public record PayBillRequest(int RestaurantId, int TableId, string PaymentMethod);

    private record PaymentResult(Bill Bill, decimal PaidAmount);
}
