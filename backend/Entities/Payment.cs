namespace QrOrderSystem.Api.Entities;

public class Payment
{
    public int Id { get; set; }
    public int BillId { get; set; }
    public decimal Amount { get; set; }
    public string Method { get; set; } = string.Empty;
    public DateTime PaidAt { get; set; }

    public Bill Bill { get; set; } = null!;
}
