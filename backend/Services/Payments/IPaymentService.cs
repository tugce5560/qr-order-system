using QrOrderSystem.Api.Entities;
using QrOrderSystem.Api.Enums;

namespace QrOrderSystem.Api.Services.Payments;

public interface IPaymentService
{
    Task<Payment> CreatePaymentAsync(
        int orderId,
        PaymentProvider provider,
        string currency,
        int? restaurantScopeId,
        string? tableSessionToken,
        CancellationToken cancellationToken = default);

    Task<Payment> MarkSucceededAsync(
        int paymentId,
        int? restaurantScopeId,
        string? tableSessionToken,
        CancellationToken cancellationToken = default);

    Task<Payment> MarkFailedAsync(
        int paymentId,
        string? errorMessage,
        int? restaurantScopeId,
        string? tableSessionToken,
        CancellationToken cancellationToken = default);

    Task<Payment> MarkCashPaidAsync(
        int orderId,
        PaymentProvider provider,
        int restaurantScopeId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Payment>> GetOrderPaymentsAsync(
        int orderId,
        int? restaurantScopeId,
        string? tableSessionToken,
        CancellationToken cancellationToken = default);
}
