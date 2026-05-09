using System.Globalization;
using Iyzipay;
using Iyzipay.Model;
using Iyzipay.Request;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using QrOrderSystem.Api.Data;
using QrOrderSystem.Api.Entities;
using QrOrderSystem.Api.Enums;
using PaymentEntity = QrOrderSystem.Api.Entities.Payment;

namespace QrOrderSystem.Api.Services.Payments;

public interface IIyzicoPaymentService
{
    Task<IyzicoCheckoutResult> CreateCheckoutAsync(int billId, CancellationToken cancellationToken = default);

    Task<IyzicoCallbackResult> CompleteCheckoutAsync(string token, CancellationToken cancellationToken = default);
}

public class IyzicoPaymentService(
    AppDbContext dbContext,
    IConfiguration configuration,
    ILogger<IyzicoPaymentService> logger) : IIyzicoPaymentService
{
    private const string SuccessStatus = "success";
    private const string IyzicoPaymentSuccessStatus = "SUCCESS";
    private const string CurrencyCode = "TRY";

    public async Task<IyzicoCheckoutResult> CreateCheckoutAsync(
        int billId,
        CancellationToken cancellationToken = default)
    {
        var bill = await LoadBill(billId, tracking: true, cancellationToken);

        if (bill.Status == BillStatus.Paid)
        {
            throw new InvalidOperationException("Bill is already paid.");
        }

        var pendingPayment = bill.Payments
            .Where(payment =>
                payment.Provider == PaymentProvider.Iyzico &&
                payment.Status == PaymentStatus.Pending)
            .OrderByDescending(payment => payment.CreatedAt)
            .FirstOrDefault();

        if (pendingPayment is not null)
        {
            if (string.IsNullOrWhiteSpace(pendingPayment.PaymentUrl) ||
                string.IsNullOrWhiteSpace(pendingPayment.Token))
            {
                throw new InvalidOperationException("A pending iyzico payment is already being initialized.");
            }

            return new IyzicoCheckoutResult(
                pendingPayment.PaymentUrl,
                pendingPayment.Token,
                bill.Id);
        }

        var payableItems = GetPayableItems(bill);
        var amount = decimal.Round(
            payableItems.Sum(item => item.LineTotal),
            2,
            MidpointRounding.AwayFromZero);

        if (amount <= 0)
        {
            throw new InvalidOperationException("No payable amount found for this bill.");
        }

        bill.SubTotal = amount;
        bill.TaxAmount = 0;
        bill.DiscountAmount = 0;
        bill.GrandTotal = amount;
        bill.TotalAmount = amount;

        var callbackUrl = BuildCallbackUrl();
        var conversationId = $"bill-{bill.Id}-{Guid.NewGuid():N}";
        var basketId = $"bill-{bill.Id}";
        var request = new CreateCheckoutFormInitializeRequest
        {
            Locale = Locale.TR.ToString(),
            ConversationId = conversationId,
            Price = FormatMoney(amount),
            PaidPrice = FormatMoney(amount),
            Currency = Currency.TRY.ToString(),
            BasketId = basketId,
            PaymentGroup = PaymentGroup.PRODUCT.ToString(),
            CallbackUrl = callbackUrl,
            EnabledInstallments = [1],
            Buyer = BuildBuyer(bill),
            BillingAddress = BuildAddress(bill),
            ShippingAddress = BuildAddress(bill),
            BasketItems = payableItems
                .Select(item => new BasketItem
                {
                    Id = item.Id,
                    Name = item.Name,
                    Category1 = "Menu",
                    ItemType = BasketItemType.PHYSICAL.ToString(),
                    Price = FormatMoney(item.LineTotal)
                })
                .ToList()
        };

        var checkoutForm = await CheckoutFormInitialize.Create(request, BuildOptions());

        if (!string.Equals(checkoutForm.Status, SuccessStatus, StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrWhiteSpace(checkoutForm.PaymentPageUrl) ||
            string.IsNullOrWhiteSpace(checkoutForm.Token))
        {
            logger.LogWarning(
                "iyzico checkout initialization failed for bill {BillId}: {ErrorCode} {ErrorGroup} {ErrorMessage}",
                bill.Id,
                checkoutForm.ErrorCode,
                checkoutForm.ErrorGroup,
                checkoutForm.ErrorMessage);
            throw new InvalidOperationException(SanitizeError(checkoutForm.ErrorMessage, "iyzico checkout could not be initialized."));
        }

        var now = DateTime.UtcNow;
        var payment = new PaymentEntity
        {
            BillId = bill.Id,
            RestaurantId = bill.RestaurantId,
            TableId = bill.TableId,
            Provider = PaymentProvider.Iyzico,
            Status = PaymentStatus.Pending,
            Amount = amount,
            Currency = CurrencyCode,
            TransactionId = conversationId,
            Token = checkoutForm.Token,
            PaymentUrl = checkoutForm.PaymentPageUrl,
            Method = PaymentMethod.Online.ToString(),
            CreatedAt = now,
            UpdatedAt = now,
            Bill = bill
        };

        dbContext.Payments.Add(payment);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsUniqueConstraintViolation(exception))
        {
            logger.LogWarning(
                exception,
                "Duplicate pending iyzico checkout prevented for bill {BillId}.",
                bill.Id);
            dbContext.Entry(payment).State = EntityState.Detached;

            var existingPendingPayment = await dbContext.Payments
                .AsNoTracking()
                .Where(currentPayment =>
                    currentPayment.BillId == bill.Id &&
                    currentPayment.Provider == PaymentProvider.Iyzico &&
                    currentPayment.Status == PaymentStatus.Pending)
                .OrderByDescending(currentPayment => currentPayment.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (existingPendingPayment?.PaymentUrl is not null &&
                existingPendingPayment.Token is not null)
            {
                return new IyzicoCheckoutResult(
                    existingPendingPayment.PaymentUrl,
                    existingPendingPayment.Token,
                    bill.Id);
            }

            throw new InvalidOperationException("A pending iyzico payment is already being initialized.");
        }

        logger.LogInformation("iyzico checkout initialized for bill {BillId}, payment {PaymentId}.", bill.Id, payment.Id);

        return new IyzicoCheckoutResult(checkoutForm.PaymentPageUrl, checkoutForm.Token, bill.Id);
    }

    public async Task<IyzicoCallbackResult> CompleteCheckoutAsync(
        string token,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new InvalidOperationException("iyzico token is required.");
        }

        var payment = await dbContext.Payments
            .Include(currentPayment => currentPayment.Bill)
            .ThenInclude(bill => bill!.Orders)
            .ThenInclude(order => order.Items)
            .FirstOrDefaultAsync(
                currentPayment =>
                    currentPayment.Provider == PaymentProvider.Iyzico &&
                    currentPayment.Token == token,
                cancellationToken);

        if (payment is null)
        {
            throw new KeyNotFoundException("Payment not found for iyzico token.");
        }

        if (payment.Status == PaymentStatus.Paid)
        {
            return new IyzicoCallbackResult(true, payment.BillId ?? 0, payment);
        }

        var retrieveRequest = new RetrieveCheckoutFormRequest
        {
            Locale = Locale.TR.ToString(),
            ConversationId = payment.TransactionId,
            Token = token
        };
        var checkoutForm = await CheckoutForm.Retrieve(retrieveRequest, BuildOptions());
        var now = DateTime.UtcNow;
        var isSuccessful =
            string.Equals(checkoutForm.Status, SuccessStatus, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(checkoutForm.PaymentStatus, IyzicoPaymentSuccessStatus, StringComparison.OrdinalIgnoreCase);

        payment.UpdatedAt = now;
        payment.ProviderPaymentId = checkoutForm.PaymentId;
        payment.ErrorMessage = null;

        if (isSuccessful)
        {
            MarkPaymentPaid(payment, now);
            await AddPaymentLogs(payment, now, cancellationToken);
            logger.LogInformation("iyzico payment succeeded for bill {BillId}, payment {PaymentId}.", payment.BillId, payment.Id);
        }
        else
        {
            payment.Status = PaymentStatus.Failed;
            payment.ErrorMessage = SanitizeError(
                checkoutForm.ErrorMessage,
                checkoutForm.PaymentStatus ?? "iyzico payment failed.");
            logger.LogWarning(
                "iyzico payment failed for bill {BillId}, payment {PaymentId}: {PaymentStatus} {ErrorCode} {ErrorMessage}",
                payment.BillId,
                payment.Id,
                checkoutForm.PaymentStatus,
                checkoutForm.ErrorCode,
                checkoutForm.ErrorMessage);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return new IyzicoCallbackResult(isSuccessful, payment.BillId ?? 0, payment);
    }

    private Options BuildOptions()
    {
        var apiKey = configuration["IYZICO_API_KEY"];
        var secretKey = configuration["IYZICO_SECRET_KEY"];
        var baseUrl = configuration["IYZICO_BASE_URL"] ?? "https://sandbox-api.iyzipay.com";

        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(secretKey))
        {
            throw new InvalidOperationException("iyzico credentials are not configured.");
        }

        return new Options
        {
            ApiKey = apiKey,
            SecretKey = secretKey,
            BaseUrl = baseUrl.TrimEnd('/')
        };
    }

    private string BuildCallbackUrl()
    {
        var appPublicUrl = configuration["APP_PUBLIC_URL"];

        if (string.IsNullOrWhiteSpace(appPublicUrl))
        {
            throw new InvalidOperationException("APP_PUBLIC_URL is not configured.");
        }

        return $"{appPublicUrl.TrimEnd('/')}/api/payments/iyzico/callback";
    }

    private async Task<Bill> LoadBill(int billId, bool tracking, CancellationToken cancellationToken)
    {
        var query = dbContext.Bills
            .Include(bill => bill.Restaurant)
            .Include(bill => bill.Table)
            .Include(bill => bill.Payments)
            .Include(bill => bill.Orders)
            .ThenInclude(order => order.Items)
            .ThenInclude(item => item.Product)
            .Where(bill => bill.Id == billId);

        if (!tracking)
        {
            query = query.AsNoTracking();
        }

        return await query.FirstOrDefaultAsync(cancellationToken)
            ?? throw new KeyNotFoundException("Bill not found.");
    }

    private static List<IyzicoPayableItem> GetPayableItems(Bill bill)
    {
        return bill.Orders
            .Where(order =>
                !order.IsPaid &&
                order.Status != OrderStatus.Paid &&
                order.Status != OrderStatus.Cancelled)
            .SelectMany(order => order.Items)
            .Select(item =>
            {
                var lineTotal = decimal.Round(item.UnitPrice * item.Quantity, 2, MidpointRounding.AwayFromZero);
                var productName = string.IsNullOrWhiteSpace(item.Product?.Name)
                    ? item.ProductName
                    : item.Product.Name;

                return new IyzicoPayableItem(
                    $"order-item-{item.Id}",
                    productName,
                    lineTotal);
            })
            .Where(item => item.LineTotal > 0)
            .ToList();
    }

    private static Buyer BuildBuyer(Bill bill)
    {
        return new Buyer
        {
            Id = $"table-{bill.TableId}",
            Name = "QR",
            Surname = "Customer",
            Email = "customer@qrorder.local",
            IdentityNumber = "11111111111",
            RegistrationAddress = BuildAddressDescription(bill),
            City = "Istanbul",
            Country = "Turkey",
            ZipCode = "34000",
            Ip = "127.0.0.1"
        };
    }

    private static Address BuildAddress(Bill bill)
    {
        return new Address
        {
            ContactName = "QR Customer",
            Description = BuildAddressDescription(bill),
            City = "Istanbul",
            Country = "Turkey",
            ZipCode = "34000"
        };
    }

    private static string BuildAddressDescription(Bill bill)
    {
        return $"{bill.Restaurant.Name} Masa {bill.Table.TableNumber}";
    }

    private static string FormatMoney(decimal value)
    {
        return decimal.Round(value, 2, MidpointRounding.AwayFromZero)
            .ToString("0.00", CultureInfo.InvariantCulture);
    }

    private static string SanitizeError(string? errorMessage, string fallback)
    {
        if (string.IsNullOrWhiteSpace(errorMessage))
        {
            return fallback;
        }

        return errorMessage.Length > 1000
            ? errorMessage[..1000]
            : errorMessage;
    }

    private static bool IsUniqueConstraintViolation(DbUpdateException exception)
    {
        return exception.InnerException is PostgresException postgresException &&
            postgresException.SqlState == PostgresErrorCodes.UniqueViolation;
    }

    private static void MarkPaymentPaid(PaymentEntity payment, DateTime now)
    {
        payment.Status = PaymentStatus.Paid;
        payment.PaidAt ??= now;

        if (payment.Bill is null)
        {
            return;
        }

        payment.Bill.Status = BillStatus.Paid;
        payment.Bill.PaymentMethod = PaymentMethod.Online;
        payment.Bill.PaidAt ??= now;
        payment.Bill.ClosedAt ??= now;

        foreach (var order in payment.Bill.Orders.Where(order => order.Status != OrderStatus.Cancelled))
        {
            order.IsPaid = true;
            order.PaymentStatus = PaymentStatus.Paid;
            order.PaymentProvider = PaymentProvider.Iyzico;
            order.PaidAt ??= now;
            order.Status = OrderStatus.Paid;
        }
    }

    private async Task AddPaymentLogs(PaymentEntity payment, DateTime now, CancellationToken cancellationToken)
    {
        if (payment.Bill is null)
        {
            return;
        }

        var orderIds = payment.Bill.Orders.Select(order => order.Id).ToList();
        var existingLogOrderIds = await dbContext.OrderActivityLogs
            .Where(log =>
                orderIds.Contains(log.OrderId) &&
                log.Action == "IyzicoPaymentPaid")
            .Select(log => log.OrderId)
            .ToListAsync(cancellationToken);
        var existingLogOrderIdSet = existingLogOrderIds.ToHashSet();

        foreach (var order in payment.Bill.Orders.Where(order => !existingLogOrderIdSet.Contains(order.Id)))
        {
            dbContext.OrderActivityLogs.Add(new OrderActivityLog
            {
                OrderId = order.Id,
                Action = "IyzicoPaymentPaid",
                OldSummary = "Pending",
                NewSummary = $"Paid via iyzico payment {payment.Id}",
                CreatedAt = now
            });
        }
    }

    private record IyzicoPayableItem(string Id, string Name, decimal LineTotal);
}

public record IyzicoCheckoutResult(string PaymentPageUrl, string Token, int BillId);

public record IyzicoCallbackResult(bool IsSuccessful, int BillId, PaymentEntity Payment);
