import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getOrderPaymentNotice,
  getPaymentBadgeLabel,
  requiresOnlinePayment,
} from "../apps/customer/paymentFlow.ts";

describe("customer payment flow", () => {
  it("requires a payment record for POS and online options", () => {
    assert.equal(requiresOnlinePayment("Cash"), false);
    assert.equal(requiresOnlinePayment("Pos"), true);
    assert.equal(requiresOnlinePayment("Iyzico"), true);
  });

  it("returns the correct customer notice for each payment option", () => {
    assert.deepEqual(getOrderPaymentNotice("Iyzico", true), {
      tone: "warning",
      message: "Siparişiniz alındı. Online ödeme sayfasına yönlendiriliyorsunuz.",
    });
    assert.equal(getOrderPaymentNotice("Pos", false).message, "Siparişiniz alındı. POS ödeme bekliyor.");
    assert.equal(getOrderPaymentNotice("Cash", false).tone, "success");
  });

  it("maps backend payment statuses to customer labels", () => {
    assert.equal(getPaymentBadgeLabel("Paid"), "Ödendi");
    assert.equal(getPaymentBadgeLabel(null, true), "Ödendi");
    assert.equal(getPaymentBadgeLabel("Failed"), "Başarısız");
    assert.equal(getPaymentBadgeLabel("Pending"), "Bekliyor");
  });
});
