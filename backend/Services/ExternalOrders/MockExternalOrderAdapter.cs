using System.Text.Json;
using QrOrderSystem.Api.Enums;

namespace QrOrderSystem.Api.Services.ExternalOrders;

public class MockExternalOrderAdapter : IExternalOrderAdapter
{
    public virtual ExternalOrderPlatform PlatformName => ExternalOrderPlatform.GetirYemek;

    public Task<IReadOnlyList<ExternalOrderRawPayload>> FetchNewOrdersAsync(
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult<IReadOnlyList<ExternalOrderRawPayload>>([]);
    }

    public Task<ExternalOrderNormalizedPayload> NormalizeOrderAsync(
        ExternalOrderRawPayload rawOrder,
        CancellationToken cancellationToken = default)
    {
        var request = JsonSerializer.Deserialize<MockExternalOrderRequest>(
            rawOrder.RawPayloadJson,
            ExternalOrderJson.Options) ?? throw new InvalidOperationException("Invalid mock external order payload.");

        return Task.FromResult(request.ToNormalizedPayload());
    }

    public Task AcknowledgeOrderAsync(string externalOrderId, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task AcceptOrderAsync(string externalOrderId, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task RejectOrderAsync(string externalOrderId, string reason, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task UpdatePreparationTimeAsync(string externalOrderId, int minutes, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task MarkReadyAsync(string externalOrderId, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task MarkDeliveredAsync(string externalOrderId, CancellationToken cancellationToken = default) => Task.CompletedTask;
}

public class TrendyolGoOrderAdapter : MockExternalOrderAdapter
{
    public override ExternalOrderPlatform PlatformName => ExternalOrderPlatform.TrendyolGo;
}

public class YemeksepetiOrderAdapter : MockExternalOrderAdapter
{
    public override ExternalOrderPlatform PlatformName => ExternalOrderPlatform.Yemeksepeti;
}

public class GetirYemekOrderAdapter : MockExternalOrderAdapter
{
    public override ExternalOrderPlatform PlatformName => ExternalOrderPlatform.GetirYemek;
}

public record MockExternalOrderRequest(
    int RestaurantId,
    int BranchId,
    string Platform,
    string ExternalOrderId,
    string? CustomerName,
    string? CustomerPhone,
    string? DeliveryAddress,
    IReadOnlyList<MockExternalOrderItemRequest> Items,
    decimal TotalAmount,
    string? Note,
    string? ExternalStatus = "New",
    string? Currency = "TRY")
{
    public ExternalOrderPlatform ParsedPlatform =>
        Enum.TryParse<ExternalOrderPlatform>(Platform, ignoreCase: true, out var parsedPlatform)
            ? parsedPlatform
            : throw new InvalidOperationException("Unsupported external order platform.");

    public ExternalOrderNormalizedPayload ToNormalizedPayload()
    {
        return new ExternalOrderNormalizedPayload(
            RestaurantId,
            BranchId,
            ParsedPlatform,
            ExternalOrderId,
            ExternalStatus ?? "New",
            CustomerName,
            CustomerPhone,
            DeliveryAddress,
            Note,
            TotalAmount,
            Currency ?? "TRY",
            Items.Select(item => new ExternalOrderNormalizedItem(
                item.Name,
                item.Quantity,
                item.UnitPrice,
                item.Note)).ToList());
    }
}

public record MockExternalOrderItemRequest(
    string Name,
    int Quantity,
    decimal UnitPrice,
    string? Note = null);

public static class ExternalOrderJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false
    };
}
