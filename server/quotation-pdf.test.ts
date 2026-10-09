import test from "node:test";
import assert from "node:assert/strict";
import { createQuotationPdf, type PdfQuotationData, type PdfQuotationItem } from "./services/quotation-pdf.ts";
import { extractPdfText } from "./quotation-pdf-test-utils.ts";

const base: PdfQuotationData = {
  quotation_number: "QT-20261009-ABC12345", title: "Brand identity", description: "Identity design services",
  currency: "INR", issue_date: "2026-10-09", valid_until: "2026-11-09", subtotal_minor: 25000,
  discount_type: "percentage", discount_value: 10, discount_minor: 2500, tax_minor: 0, total_minor: 22500,
  terms: "Payment due within 14 days.", client_name: "A Client", company_name: "Client Co", client_email: "client@example.com",
  client_phone: "+91 90000 00000", client_address: "Mumbai", business_name: "JSN Designs", contact_person: "Studio",
  email: "hello@example.com", phone: "+91 80000 00000", address: "Mumbai", website: "https://example.com",
};
const items: PdfQuotationItem[] = [
  { description: "Logo", quantity: 2, unit_price_minor: 10000, line_total_minor: 20000 },
  { description: "Guide", quantity: 1, unit_price_minor: 5000, line_total_minor: 5000 },
];
const render = (data = base, rows = items) => new Promise<Buffer>((resolve, reject) => {
  const chunks: Buffer[] = [];
  const pdf = createQuotationPdf(data, rows);
  pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  pdf.on("end", () => resolve(Buffer.concat(chunks)));
  pdf.on("error", reject);
});
test("quotation PDF contains persisted values and paginates long item lists", async () => {
  const first = await render();
  assert.equal(first.subarray(0, 5).toString(), "%PDF-");
  const extracted = await extractPdfText(first);
  for (const value of ["QT-20261009-ABC12345", "Brand identity", "Logo", "Guide", "2", "INR 100.00", "INR 200.00", "INR 50.00", "INR 225.00", "Payment due within 14 days.", "Page 1"])
    assert.ok(extracted.text.includes(value), `PDF should include ${value}; extracted: ${extracted.text}`);
  assert.ok(!extracted.text.includes("internal"), "Internal notes are excluded from customer PDFs.");
  const many = Array.from({ length: 100 }, (_, index) => ({
    description: `Service ${index + 1} ${"Detailed project service description ".repeat(8)}`,
    quantity: 1,
    unit_price_minor: 1000,
    line_total_minor: 1000,
  }));
  const multiple = await render({ ...base, subtotal_minor: 100000, discount_minor: 0, total_minor: 100000, discount_type: "none", discount_value: 0 }, many);
  const extractedMultiple = await extractPdfText(multiple);
  assert.ok(extractedMultiple.pageCount > 1);
  assert.ok(extractedMultiple.text.includes("Page 1"));
  assert.ok(extractedMultiple.text.includes(`Page ${extractedMultiple.pageCount}`));
  assert.ok(extractedMultiple.text.includes("Service 100"), extractedMultiple.text.slice(-1200));
});
