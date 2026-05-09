using QrOrderSystem.Api.Enums;

namespace QrOrderSystem.Api.Services.ExternalOrders;

public interface IExternalOrderAdapter
{
    ExternalOrderPlatform PlatformName { get; }

    Task<IReadOnlyList<ExternalOrderRawPayload>> FetchNewOrdersAsync(CancellationToken cancellationToken = default);

    Task<ExternalOrderNormalizedPayload> NormalizeOrderAsync(
        ExternalOrderRawPayload rawOrder,
        CancellationToken cancellationToken = default);

    Task AcknowledgeOrderAsync(string externalOrderId, CancellationToken cancellationToken = default);

    Task AcceptOrderAsync(string externalOrderId, CancellationToken cancellationToken = default);

    Task RejectOrderAsync(string externalOrderId, string reason, CancellationToken cancellationToken = default);

    Task UpdatePreparationTimeAsync(string externalOrderId, int minutes, CancellationToken cancellationToken = default);

    Task MarkReadyAsync(string externalOrderId, CancellationToken cancellationToken = default);

    Task MarkDeliveredAsync(string externalOrderId, CancellationToken cancellationToken = default);
}

public record ExternalOrderRawPayload(
    ExternalOrderPlatform Platform,
    string ExternalOrderId,
    string ExternalStatus,
    string RawPayloadJson);

public record ExternalOrderNormalizedPayload(
    int RestaurantId,
    int BranchId,
    ExternalOrderPlatform Platform,
    string ExternalOrderId,
    string ExternalStatus,
    string? CustomerName,
    string? CustomerPhone,
    string? DeliveryAddress,
    string? Note,
    decimal TotalAmount,
    string Currency,
    IReadOnlyList<ExternalOrderNormalizedItem> Items);

public record ExternalOrderNormalizedItem(
    string Name,
    int Quantity,
    decimal UnitPrice,
    string? Note = null);
