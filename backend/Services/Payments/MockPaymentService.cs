using Microsoft.EntityFrameworkCore;
using QrOrderSystem.Api.Data;
using QrOrderSystem.Api.Entities;
using QrOrderSystem.Api.Enums;

namespace QrOrderSystem.Api.Services.Payments;

public class MockPaymentService(AppDbContext dbContext) : IPaymentService
{
    private static readonly PaymentProvider[] SupportedCashProviders =
    [
        PaymentProvider.Cash,
        PaymentProvider.Pos
    ];

    public async Task<Payment> CreatePaymentAsync(
        int orderId,
        PaymentProvider provider,
        string currency,
        int? restaurantScopeId,
        string? tableSessionToken,
        CancellationToken cancellationToken = default)
    {
        var order = await LoadScopedOrder(orderId, restaurantScopeId, tableSessionToken, cancellationToken);

        if (order.IsPaid)
        {
            throw new InvalidOperationException("Order is already paid.");
        }

        var now = DateTime.UtcNow;
        var amount = order.Items.Sum(item => item.UnitPrice * item.Quantity);
        order.TotalAmount = amount;
        order.PaymentProvider = provider;
        order.PaymentStatus = PaymentStatus.Pending;

        var payment = new Payment
        {
            OrderId = order.Id,
            RestaurantId = order.RestaurantId,
            TableId = order.TableId,
            BillId = order.BillId,
            Provider = provider,
            Status = PaymentStatus.Pending,
            Amount = amount,
            Currency = NormalizeCurrency(currency),
            TransactionId = provider == PaymentProvider.MockOnline
                ? $"MOCK-{Guid.NewGuid():N}"
                : null,
            PaymentUrl = provider == PaymentProvider.MockOnline
                ? $"/mock-payment/{order.Id}/{Guid.NewGuid():N}"
                : null,
            Method = provider.ToString(),
            CreatedAt = now,
            UpdatedAt = now,
            Order = order
        };

        dbContext.Payments.Add(payment);
        await dbContext.SaveChangesAsync(cancellationToken);

        return payment;
    }

    public async Task<Payment> MarkSucceededAsync(
        int paymentId,
        int? restaurantScopeId,
        string? tableSessionToken,
        CancellationToken cancellationToken = default)
    {
        var payment = await LoadScopedPayment(paymentId, restaurantScopeId, tableSessionToken, cancellationToken);
        var order = payment.Order ?? throw new InvalidOperationException("Order not found for payment.");
        var now = DateTime.UtcNow;

        payment.Status = PaymentStatus.Paid;
        payment.ErrorMessage = null;
        payment.UpdatedAt = now;
        payment.PaidAt ??= now;
        payment.TransactionId ??= $"MOCK-{Guid.NewGuid():N}";

        order.IsPaid = true;
        order.PaymentStatus = PaymentStatus.Paid;
        order.PaymentProvider = payment.Provider;
        order.PaidAt ??= now;
        order.Status = OrderStatus.Paid;

        if (order.Bill is not null)
        {
            var unpaidSiblingExists = await dbContext.Orders.AnyAsync(
                sibling =>
                    sibling.BillId == order.BillId &&
                    sibling.Id != order.Id &&
                    sibling.Status != OrderStatus.Paid &&
                    sibling.Status != OrderStatus.Cancelled,
                cancellationToken);

            if (!unpaidSiblingExists)
            {
                order.Bill.Status = BillStatus.Paid;
                order.Bill.PaymentMethod = ToPaymentMethod(payment.Provider);
                order.Bill.PaidAt ??= now;
                order.Bill.ClosedAt ??= now;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return payment;
    }

    public async Task<Payment> MarkFailedAsync(
        int paymentId,
        string? errorMessage,
        int? restaurantScopeId,
        string? tableSessionToken,
        CancellationToken cancellationToken = default)
    {
        var payment = await LoadScopedPayment(paymentId, restaurantScopeId, tableSessionToken, cancellationToken);
        var now = DateTime.UtcNow;

        payment.Status = PaymentStatus.Failed;
        payment.ErrorMessage = string.IsNullOrWhiteSpace(errorMessage)
            ? "Mock payment failed."
            : errorMessage.Trim();
        payment.UpdatedAt = now;

        if (payment.Order is not null)
        {
            payment.Order.PaymentStatus = PaymentStatus.Failed;
            payment.Order.PaymentProvider = payment.Provider;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return payment;
    }

    public async Task<Payment> MarkCashPaidAsync(
        int orderId,
        PaymentProvider provider,
        int restaurantScopeId,
        CancellationToken cancellationToken = default)
    {
        if (!SupportedCashProviders.Contains(provider))
        {
            throw new InvalidOperationException("Provider must be Cash or Pos.");
        }

        await LoadScopedOrder(
            orderId,
            restaurantScopeId,
            tableSessionToken: null,
            cancellationToken);

        var payment = await dbContext.Payments
            .Where(currentPayment =>
                currentPayment.OrderId == orderId &&
                currentPayment.RestaurantId == restaurantScopeId &&
                currentPayment.Provider == provider &&
                currentPayment.Status == PaymentStatus.Pending)
            .OrderByDescending(currentPayment => currentPayment.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        payment ??= await CreatePaymentAsync(
            orderId,
            provider,
            "TRY",
            restaurantScopeId,
            tableSessionToken: null,
            cancellationToken);

        return await MarkSucceededAsync(
            payment.Id,
            restaurantScopeId,
            tableSessionToken: null,
            cancellationToken);
    }

    public async Task<IReadOnlyList<Payment>> GetOrderPaymentsAsync(
        int orderId,
        int? restaurantScopeId,
        string? tableSessionToken,
        CancellationToken cancellationToken = default)
    {
        await LoadScopedOrder(orderId, restaurantScopeId, tableSessionToken, cancellationToken);

        return await dbContext.Payments
            .AsNoTracking()
            .Where(payment => payment.OrderId == orderId)
            .OrderByDescending(payment => payment.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    private async Task<Order> LoadScopedOrder(
        int orderId,
        int? restaurantScopeId,
        string? tableSessionToken,
        CancellationToken cancellationToken)
    {
        var order = await dbContext.Orders
            .Include(currentOrder => currentOrder.Items)
            .Include(currentOrder => currentOrder.Bill)
            .FirstOrDefaultAsync(currentOrder => currentOrder.Id == orderId, cancellationToken);

        if (order is null)
        {
            throw new KeyNotFoundException("Order not found.");
        }

        if (restaurantScopeId.HasValue && order.RestaurantId != restaurantScopeId.Value)
        {
            throw new UnauthorizedAccessException("Order belongs to another restaurant.");
        }

        if (!restaurantScopeId.HasValue)
        {
            await EnsureValidTableSession(order, tableSessionToken, cancellationToken);
        }

        return order;
    }

    private async Task<Payment> LoadScopedPayment(
        int paymentId,
        int? restaurantScopeId,
        string? tableSessionToken,
        CancellationToken cancellationToken)
    {
        var payment = await dbContext.Payments
            .Include(currentPayment => currentPayment.Order)
            .ThenInclude(order => order!.Items)
            .Include(currentPayment => currentPayment.Order)
            .ThenInclude(order => order!.Bill)
            .FirstOrDefaultAsync(currentPayment => currentPayment.Id == paymentId, cancellationToken);

        if (payment is null)
        {
            throw new KeyNotFoundException("Payment not found.");
        }

        if (restaurantScopeId.HasValue && payment.RestaurantId != restaurantScopeId.Value)
        {
            throw new UnauthorizedAccessException("Payment belongs to another restaurant.");
        }

        if (!restaurantScopeId.HasValue)
        {
            if (payment.Order is null)
            {
                throw new UnauthorizedAccessException("Payment cannot be accessed from customer flow.");
            }

            await EnsureValidTableSession(payment.Order, tableSessionToken, cancellationToken);
        }

        return payment;
    }

    private async Task EnsureValidTableSession(
        Order order,
        string? tableSessionToken,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(tableSessionToken))
        {
            throw new UnauthorizedAccessException("Table session token is required.");
        }

        var now = DateTime.UtcNow;
        var sessionExists = await dbContext.TableSessions.AnyAsync(
            session =>
                session.RestaurantId == order.RestaurantId &&
                session.TableId == order.TableId &&
                session.Token == tableSessionToken &&
                session.IsActive &&
                session.ExpiresAt > now,
            cancellationToken);

        if (!sessionExists)
        {
            throw new UnauthorizedAccessException("Invalid table session.");
        }
    }

    private static string NormalizeCurrency(string? currency)
    {
        return string.IsNullOrWhiteSpace(currency)
            ? "TRY"
            : currency.Trim().ToUpperInvariant()[..Math.Min(3, currency.Trim().Length)];
    }

    private static PaymentMethod ToPaymentMethod(PaymentProvider provider)
    {
        return provider switch
        {
            PaymentProvider.Cash => PaymentMethod.Cash,
            PaymentProvider.Pos => PaymentMethod.Card,
            PaymentProvider.MockOnline => PaymentMethod.Online,
            PaymentProvider.Iyzico => PaymentMethod.Online,
            PaymentProvider.PayTR => PaymentMethod.Online,
            _ => PaymentMethod.Online
        };
    }
}
