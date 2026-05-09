using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QrOrderSystem.Api.Data;
using QrOrderSystem.Api.Enums;

namespace QrOrderSystem.Api.Controllers;

[ApiController]
[Authorize(Roles = "RestaurantAdmin,SuperAdmin")]
[Route("api/[controller]")]
public class AnalyticsController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] int? restaurantId = null)
    {
        var scopedRestaurantId = GetScopedRestaurantId(restaurantId);
        var now = DateTime.UtcNow;
        var todayStart = now.Date;
        var tomorrowStart = todayStart.AddDays(1);
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var nextMonthStart = monthStart.AddMonths(1);

        var paidBillsQuery = BuildBillsQuery(scopedRestaurantId)
            .Where(bill => bill.Status == BillStatus.Paid);
        var openBillsQuery = BuildBillsQuery(scopedRestaurantId)
            .Where(bill => bill.Status == BillStatus.Open);
        var ordersQuery = BuildOrdersQuery(scopedRestaurantId);
        var paidOrdersQuery = ordersQuery.Where(order => order.Status == OrderStatus.Paid);

        var todayRevenue = await paidBillsQuery
            .Where(bill => bill.PaidAt >= todayStart && bill.PaidAt < tomorrowStart)
            .SumAsync(bill => (decimal?)bill.GrandTotal) ?? 0;
        var todayOrderCount = await ordersQuery
            .CountAsync(order => order.CreatedAt >= todayStart && order.CreatedAt < tomorrowStart);
        var openBillsCount = await openBillsQuery.CountAsync();
        var paidBillsCount = await paidBillsQuery.CountAsync();
        var activeTablesCount = await ordersQuery
            .Where(order => order.Status != OrderStatus.Paid && order.Status != OrderStatus.Cancelled)
            .Select(order => order.TableId)
            .Distinct()
            .CountAsync();
        var paidOrderCount = await paidOrdersQuery.CountAsync();
        var paidOrderRevenue = await paidOrdersQuery
            .SumAsync(order => (decimal?)order.TotalAmount) ?? 0;
        var totalRevenueThisMonth = await paidBillsQuery
            .Where(bill => bill.PaidAt >= monthStart && bill.PaidAt < nextMonthStart)
            .SumAsync(bill => (decimal?)bill.GrandTotal) ?? 0;
        var totalOrdersThisMonth = await paidOrdersQuery
            .CountAsync(order => order.PaidAt >= monthStart && order.PaidAt < nextMonthStart);

        var preparationDurations = await ordersQuery
            .Where(order => order.PreparingAt != null && order.ReadyAt != null)
            .Select(order => (order.ReadyAt!.Value - order.PreparingAt!.Value).TotalSeconds)
            .ToListAsync();
        var serviceDurations = await ordersQuery
            .Where(order => order.ReadyAt != null && order.ServedAt != null)
            .Select(order => (order.ServedAt!.Value - order.ReadyAt!.Value).TotalSeconds)
            .ToListAsync();
        var topProducts = await BuildTopProductsQuery(scopedRestaurantId, null, null)
            .Take(5)
            .Select(product => new
            {
                Name = product.ProductName,
                TotalSold = product.QuantitySold
            })
            .ToListAsync();

        var ratingsQuery = dbContext.Ratings
            .Where(rating => !scopedRestaurantId.HasValue ||
                rating.Table.Branch.RestaurantId == scopedRestaurantId.Value);
        var totalRatings = await ratingsQuery.CountAsync();

        return Ok(new
        {
            TodayRevenue = todayRevenue,
            TodayOrderCount = todayOrderCount,
            OpenBillsCount = openBillsCount,
            PaidBillsCount = paidBillsCount,
            ActiveTablesCount = activeTablesCount,
            AverageOrderValue = paidOrderCount > 0 ? paidOrderRevenue / paidOrderCount : 0,
            TotalRevenueThisMonth = totalRevenueThisMonth,
            TotalOrdersThisMonth = totalOrdersThisMonth,
            TotalOrders = await ordersQuery.CountAsync(),
            TotalRevenue = paidOrderRevenue,
            AvgPreparationTimeSeconds = preparationDurations.Count > 0
                ? preparationDurations.Average()
                : 0,
            AvgServiceTimeSeconds = serviceDurations.Count > 0
                ? serviceDurations.Average()
                : 0,
            TopProducts = topProducts,
            AvgSpeed = totalRatings > 0 ? await ratingsQuery.AverageAsync(rating => rating.Speed) : 0,
            AvgTaste = totalRatings > 0 ? await ratingsQuery.AverageAsync(rating => rating.Taste) : 0,
            AvgService = totalRatings > 0 ? await ratingsQuery.AverageAsync(rating => rating.Service) : 0,
            TotalRatings = totalRatings
        });
    }

    [HttpGet("top-products")]
    public async Task<IActionResult> GetTopProducts(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int limit = 5,
        [FromQuery] int? restaurantId = null)
    {
        var scopedRestaurantId = GetScopedRestaurantId(restaurantId);
        var (fromUtc, toUtc) = NormalizeRange(from, to);

        var products = await BuildTopProductsQuery(scopedRestaurantId, fromUtc, toUtc)
            .Take(Math.Clamp(limit, 1, 50))
            .ToListAsync();

        return Ok(products);
    }

    [HttpGet("table-performance")]
    public async Task<IActionResult> GetTablePerformance(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? restaurantId = null)
    {
        var scopedRestaurantId = GetScopedRestaurantId(restaurantId);
        var (fromUtc, toUtc) = NormalizeRange(from, to);

        var paidOrders = BuildOrdersQuery(scopedRestaurantId)
            .Where(order => order.Status == OrderStatus.Paid);

        if (fromUtc.HasValue)
        {
            paidOrders = paidOrders.Where(order => order.PaidAt >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            paidOrders = paidOrders.Where(order => order.PaidAt < toUtc.Value);
        }

        var performance = await paidOrders
            .GroupBy(order => new { order.TableId, order.Table.TableNumber })
            .Select(group => new
            {
                group.Key.TableId,
                group.Key.TableNumber,
                OrderCount = group.Count(),
                Revenue = group.Sum(order => order.TotalAmount),
                LastOrderAt = group.Max(order => order.CreatedAt)
            })
            .OrderByDescending(table => table.Revenue)
            .ToListAsync();

        return Ok(performance);
    }

    [HttpGet("hourly-orders")]
    public async Task<IActionResult> GetHourlyOrders(
        [FromQuery] DateTime? date = null,
        [FromQuery] int? restaurantId = null)
    {
        var scopedRestaurantId = GetScopedRestaurantId(restaurantId);
        var dayStart = NormalizeDate(date ?? DateTime.UtcNow);
        var nextDayStart = dayStart.AddDays(1);

        var rows = await BuildOrdersQuery(scopedRestaurantId)
            .Where(order =>
                order.Status == OrderStatus.Paid &&
                order.PaidAt >= dayStart &&
                order.PaidAt < nextDayStart)
            .GroupBy(order => order.PaidAt!.Value.Hour)
            .Select(group => new
            {
                Hour = group.Key,
                OrderCount = group.Count(),
                Revenue = group.Sum(order => order.TotalAmount)
            })
            .ToListAsync();

        return Ok(Enumerable.Range(0, 24)
            .Select(hour =>
            {
                var row = rows.FirstOrDefault(item => item.Hour == hour);
                return new
                {
                    Hour = hour,
                    OrderCount = row?.OrderCount ?? 0,
                    Revenue = row?.Revenue ?? 0
                };
            }));
    }

    [HttpGet("monthly-sales")]
    public async Task<IActionResult> GetMonthlySales(
        [FromQuery] int? year = null,
        [FromQuery] int? restaurantId = null)
    {
        var scopedRestaurantId = GetScopedRestaurantId(restaurantId);
        var selectedYear = year ?? DateTime.UtcNow.Year;
        var yearStart = new DateTime(selectedYear, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var nextYearStart = yearStart.AddYears(1);

        var rows = await BuildOrdersQuery(scopedRestaurantId)
            .Where(order =>
                order.Status == OrderStatus.Paid &&
                order.PaidAt >= yearStart &&
                order.PaidAt < nextYearStart)
            .GroupBy(order => order.PaidAt!.Value.Month)
            .Select(group => new
            {
                Month = group.Key,
                Revenue = group.Sum(order => order.TotalAmount),
                OrderCount = group.Count()
            })
            .ToListAsync();

        return Ok(Enumerable.Range(1, 12)
            .Select(month =>
            {
                var row = rows.FirstOrDefault(item => item.Month == month);
                return new
                {
                    Month = month,
                    Revenue = row?.Revenue ?? 0,
                    OrderCount = row?.OrderCount ?? 0
                };
            }));
    }

    private IQueryable<QrOrderSystem.Api.Entities.Order> BuildOrdersQuery(int? restaurantId)
    {
        var query = dbContext.Orders.AsNoTracking().AsQueryable();

        return restaurantId.HasValue
            ? query.Where(order => order.RestaurantId == restaurantId.Value)
            : query;
    }

    private IQueryable<QrOrderSystem.Api.Entities.Bill> BuildBillsQuery(int? restaurantId)
    {
        var query = dbContext.Bills.AsNoTracking().AsQueryable();

        return restaurantId.HasValue
            ? query.Where(bill => bill.RestaurantId == restaurantId.Value)
            : query;
    }

    private IQueryable<TopProductRow> BuildTopProductsQuery(
        int? restaurantId,
        DateTime? from,
        DateTime? to)
    {
        var query = dbContext.OrderItems
            .AsNoTracking()
            .Where(item => item.Order.Status == OrderStatus.Paid);

        if (restaurantId.HasValue)
        {
            query = query.Where(item => item.Order.RestaurantId == restaurantId.Value);
        }

        if (from.HasValue)
        {
            query = query.Where(item => item.Order.PaidAt >= from.Value);
        }

        if (to.HasValue)
        {
            query = query.Where(item => item.Order.PaidAt < to.Value);
        }

        return query
            .GroupBy(item => new { item.ProductId, item.ProductName })
            .Select(group => new TopProductRow
            {
                ProductId = group.Key.ProductId ?? 0,
                ProductName = group.Key.ProductName,
                QuantitySold = group.Sum(item => item.Quantity),
                Revenue = group.Sum(item => item.UnitPrice * item.Quantity)
            })
            .OrderByDescending(product => product.Revenue);
    }

    private int? GetScopedRestaurantId(int? restaurantId)
    {
        if (User.IsInRole(UserRole.SuperAdmin.ToString()))
        {
            return restaurantId;
        }

        var claimValue = User.FindFirst("restaurantId")?.Value;

        if (!int.TryParse(claimValue, out var scopedRestaurantId))
        {
            throw new UnauthorizedAccessException("Restaurant claim is missing.");
        }

        return scopedRestaurantId;
    }

    private static (DateTime? From, DateTime? To) NormalizeRange(DateTime? from, DateTime? to)
    {
        return (
            from.HasValue ? NormalizeDate(from.Value) : null,
            to.HasValue ? NormalizeDate(to.Value).AddDays(1) : null);
    }

    private static DateTime NormalizeDate(DateTime value)
    {
        return DateTime.SpecifyKind(value.Date, DateTimeKind.Utc);
    }

    private class TopProductRow
    {
        public int ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public int QuantitySold { get; set; }
        public decimal Revenue { get; set; }
    }
}
