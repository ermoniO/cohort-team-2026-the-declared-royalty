import { describe, expect, it } from "vitest";
import { invoiceListUrl } from "@/app/services/invoiceService";

describe("invoiceListUrl", () => {
  it("sends page and size by default", () => {
    expect(invoiceListUrl({})).toBe("/api/v1/invoices?page=0&size=20");
  });

  it("repeats status once per value and trims the search", () => {
    const url = invoiceListUrl({ page: 2, size: 10, statuses: ["INGESTED", "FAILED"], search: "  north line " });
    expect(url).toBe("/api/v1/invoices?page=2&size=10&status=INGESTED&status=FAILED&q=north+line");
  });

  it("leaves out a blank search", () => {
    expect(invoiceListUrl({ search: "   " })).not.toContain("q=");
  });
});
