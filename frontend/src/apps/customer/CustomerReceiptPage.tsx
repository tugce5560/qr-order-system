import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../services/api";

type ReceiptItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
  removedIngredients?: string | null;
  lineTotal: number;
};

type Receipt = {
  id: number;
  restaurantName: string;
  tableNumber: number;
  billNumber: string;
  status: string;
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod?: string | null;
  createdAt?: string;
  paidAt?: string | null;
  items: ReceiptItem[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CustomerReceiptPage() {
  const { billId } = useParams();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReceipt() {
      const restaurantId = sessionStorage.getItem("customerRestaurantId");
      const tableId = sessionStorage.getItem("customerTableId");

      if (!billId || !restaurantId || !tableId) {
        setError("Adisyon bilgisi bulunamadı. Lütfen QR menüden tekrar deneyin.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.get<Receipt>(`/payments/receipts/${billId}`, {
          params: { restaurantId, tableId },
        });
        setReceipt(response.data);
      } catch {
        setError("Adisyon yüklenemedi.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadReceipt();
  }, [billId]);

  if (isLoading) {
    return <main className="customer-page"><p>Adisyon yükleniyor...</p></main>;
  }

  if (error || !receipt) {
    return (
      <main className="customer-page">
        <p>{error ?? "Adisyon bulunamadı."}</p>
        <Link to="/customer">Menüye dön</Link>
      </main>
    );
  }

  return (
    <main className="customer-page">
      <section className="receipt-card">
        <p>{receipt.restaurantName}</p>
        <h1>Adisyon</h1>
        <div>
          <span>Masa {receipt.tableNumber}</span>
          <span>{receipt.billNumber}</span>
          <span>{receipt.status === "Paid" ? "Ödendi" : receipt.status}</span>
        </div>

        <ul>
          {receipt.items.map((item) => (
            <li key={`${item.productName}-${item.unitPrice}`}>
              <span>
                {item.productName} x {item.quantity}
                {item.removedIngredients && <small> Çıkarılan: {item.removedIngredients}</small>}
              </span>
              <strong>{formatCurrency(item.lineTotal)}</strong>
            </li>
          ))}
        </ul>

        <dl>
          <dt>Ara toplam</dt>
          <dd>{formatCurrency(receipt.subTotal)}</dd>
          <dt>Vergi</dt>
          <dd>{formatCurrency(receipt.taxAmount)}</dd>
          <dt>İndirim</dt>
          <dd>{formatCurrency(receipt.discountAmount)}</dd>
          <dt>Toplam</dt>
          <dd>{formatCurrency(receipt.grandTotal)}</dd>
        </dl>
      </section>
    </main>
  );
}
