import { apiClient } from "./apiClient";
import type { paths } from "@/types/api.generated";

export type StripePaymentRequest =
  paths["/api/v1/invoices/{invoiceUuid}/stripe-payment"]["post"]["requestBody"]["content"]["application/json"];

export type StripePaymentResponse =
  paths["/api/v1/invoices/{invoiceUuid}/stripe-payment"]["post"]["responses"]["200"]["content"]["application/json"];

export async function createStripePayment(
  invoiceUuid: string,
  request: StripePaymentRequest,
): Promise<StripePaymentResponse> {
  const { data, error } = await apiClient.POST("/api/v1/invoices/{invoiceUuid}/stripe-payment", {
    params: {
      path: { invoiceUuid },
    },
    body: request,
  });

  if (error || !data) {
    const errorMsg =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : "Failed to create Stripe payment";
    throw new Error(errorMsg);
  }

  return data;
}
