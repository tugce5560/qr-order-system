import { Link, useSearchParams } from "react-router-dom";
import "./CustomerPage.css";

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const billId = searchParams.get("billId");
  const returnPath = sessionStorage.getItem("customerReturnPath") || "/customer";
  const isSuccessful = status === "success";

  return (
    <main className="customer-page payment-result-page">
      <section className="payment-result-panel">
        <span
          className={
            isSuccessful
              ? "customer-payment-badge payment-paid"
              : "customer-payment-badge payment-failed"
          }
        >
          {isSuccessful ? "Başarılı" : "Başarısız"}
        </span>
        <h1>
          {isSuccessful
            ? "Ödeme başarılı. Hesabınız kapatıldı."
            : "Ödeme başarısız veya iptal edildi. Tekrar deneyebilirsiniz."}
        </h1>
        {billId && <p>Adisyon No: {billId}</p>}
        <Link className="payment-result-button" to={returnPath}>
          QR menüye geri dön
        </Link>
      </section>
    </main>
  );
}
