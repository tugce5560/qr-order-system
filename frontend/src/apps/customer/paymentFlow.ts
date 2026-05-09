export type PaymentOption = "Cash" | "Pos" | "Iyzico";

export type PaymentNotice = {
  tone: "success" | "warning" | "error";
  message: string;
};

export const paymentOptions: { value: PaymentOption; label: string }[] = [
  { value: "Cash", label: "Kasada öde" },
  { value: "Pos", label: "POS ile öde" },
  { value: "Iyzico", label: "Online öde" },
];

export function requiresOnlinePayment(paymentOption: PaymentOption) {
  return paymentOption !== "Cash";
}

export function getOrderPaymentNotice(
  paymentOption: PaymentOption,
  hasPayment: boolean,
): PaymentNotice {
  if (paymentOption === "Iyzico" && hasPayment) {
    return {
      tone: "warning",
      message: "Siparişiniz alındı. Online ödeme sayfasına yönlendiriliyorsunuz.",
    };
  }

  if (paymentOption === "Pos") {
    return {
      tone: "warning",
      message: "Siparişiniz alındı. POS ödeme bekliyor.",
    };
  }

  return {
    tone: "success",
    message: "Siparişiniz mutfağa iletildi. Durumu bu ekrandan canlı takip edebilirsiniz.",
  };
}

export function getPaymentBadgeLabel(
  paymentStatus?: string | null,
  isPaid = false,
) {
  if (isPaid || paymentStatus === "Paid") {
    return "Ödendi";
  }

  if (paymentStatus === "Failed") {
    return "Başarısız";
  }

  return "Bekliyor";
}
