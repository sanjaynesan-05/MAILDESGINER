import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import type { Writable } from "node:stream";
import { fileURLToPath } from "node:url";

const logoPath = fileURLToPath(new URL("../../src/assets/JSN DESIGN.png", import.meta.url));
const money = (minor: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, currencyDisplay: "code" }).format(minor / 100).replace(/\u00a0/g, " ");

export type PdfQuotationData = {
  quotation_number: string;
  title: string;
  description: string | null;
  currency: string;
  issue_date: string;
  valid_until: string | null;
  subtotal_minor: number;
  discount_type: "none" | "fixed" | "percentage";
  discount_value: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  terms: string | null;
  client_name: string;
  company_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  business_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  website: string;
};
export type PdfQuotationItem = {
  description: string;
  quantity: number;
  unit_price_minor: number;
  line_total_minor: number;
};

export function createQuotationPdf(data: PdfQuotationData, items: PdfQuotationItem[], destination?: Writable, onError?: (error: Error) => void) {
  const safeText = (value: unknown) => typeof value === "string" ? value
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-").replace(/\u2026/g, "...")
    .replace(/\u00b7/g, "|").replace(/\u2212/g, "-")
    .replace(/[^\x20-\x7e\x80-\xff\n\t]/g, "?")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ") : "";
  data = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, typeof value === "string" ? safeText(value) : value])) as PdfQuotationData;
  items = items.map((item) => ({ ...item, description: safeText(item.description) }));
  const doc = new PDFDocument({ size: "A4", margin: 46, compress: false, info: { Title: `Quotation ${data.quotation_number}`, Author: data.business_name || "Business" } });
  if (onError) doc.on("error", onError);
  if (destination) doc.pipe(destination);
  const pageWidth = doc.page.width;
  const margin = 46;
  const usableWidth = pageWidth - margin * 2;
  const green = "#20594f";
  const muted = "#66736f";
  let pageNumber = 1;
  const drawPageNumber = (number: number) => {
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 10;
    doc.y = doc.page.height - 28;
    doc.fillColor(muted).font("Helvetica").fontSize(8).text(`${data.quotation_number}  |  Page ${number}`, margin, doc.page.height - 28, { width: usableWidth, align: "right", lineBreak: false });
    doc.page.margins.bottom = bottomMargin;
    doc.y = margin;
  };
  drawPageNumber(pageNumber);
  doc.on("pageAdded", () => { pageNumber += 1; drawPageNumber(pageNumber); });

  if (existsSync(logoPath)) doc.image(logoPath, margin, 40, { fit: [58, 58] });
  const businessX = existsSync(logoPath) ? margin + 72 : margin;
  doc.fillColor(green).font("Helvetica-Bold").fontSize(18).text(safeText(data.business_name) || "Business", businessX, 44, { width: usableWidth - 72 });
  doc.fillColor(muted).font("Helvetica").fontSize(8.5);
  const businessContact = [data.contact_person, data.email, data.phone, data.address, data.website].filter(Boolean).join("  |  ");
  if (businessContact) doc.text(businessContact, businessX, 67, { width: usableWidth - 72, lineGap: 2 });
  doc.moveTo(margin, 106).lineTo(pageWidth - margin, 106).strokeColor("#d9e2de").stroke();

  doc.fillColor(green).font("Helvetica-Bold").fontSize(22).text("QUOTATION", margin, 122);
  doc.fillColor("#18211e").fontSize(10).text(`Reference  ${data.quotation_number}`, margin, 153);
  doc.text(`Issue date  ${data.issue_date}`, margin, 169);
  doc.text(`Valid until  ${data.valid_until || "No expiry"}`, margin, 185);
  doc.fillColor(muted).font("Helvetica-Bold").fontSize(8).text("PREPARED FOR", pageWidth / 2 + 5, 127);
  doc.fillColor("#18211e").font("Helvetica-Bold").fontSize(11).text(data.client_name, pageWidth / 2 + 5, 142, { width: pageWidth / 2 - margin - 5 });
  doc.font("Helvetica").fontSize(9);
  const clientLines = [data.company_name, data.client_email, data.client_phone, data.client_address].filter(Boolean).join("\n");
  if (clientLines) doc.text(clientLines, pageWidth / 2 + 5, 158, { width: pageWidth / 2 - margin - 5, lineGap: 2 });

  let y = Math.max(doc.y, 205) + 10;
  doc.fillColor(green).font("Helvetica-Bold").fontSize(14).text(data.title, margin, y, { width: usableWidth });
  y = doc.y + 5;
  if (data.description) {
    doc.fillColor("#34413c").font("Helvetica").fontSize(9.5).text(data.description, margin, y, { width: usableWidth, lineGap: 3 });
    y = doc.y + 12;
  } else y += 12;

  const cols = { description: margin + 8, qty: margin + 287, unit: margin + 336, amount: margin + 424 };
  const widths = { description: 267, qty: 43, unit: 82, amount: 76 };
  const tableHeader = () => {
    doc.rect(margin, y, usableWidth, 25).fill(green);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5);
    doc.y = y + 8;
    doc.text("DESCRIPTION", cols.description, y + 8, { width: widths.description });
    doc.y = y + 8;
    doc.text("QTY", cols.qty, y + 8, { width: widths.qty, align: "right" });
    doc.y = y + 8;
    doc.text("UNIT PRICE", cols.unit, y + 8, { width: widths.unit, align: "right" });
    doc.y = y + 8;
    doc.text("LINE TOTAL", cols.amount, y + 8, { width: widths.amount, align: "right" });
    y += 25;
  };
  tableHeader();
  items.forEach((item, index) => {
    doc.font("Helvetica").fontSize(9);
    const descriptionHeight = doc.heightOfString(item.description, { width: widths.description, lineGap: 2 });
    const rowHeight = Math.max(26, descriptionHeight + 14);
    if (y + rowHeight > doc.page.height - margin - 62) {
      doc.addPage();
      y = margin;
      tableHeader();
    }
    if (index % 2 === 1) doc.rect(margin, y, usableWidth, rowHeight).fill("#f4f7f5");
    doc.fillColor("#25312c").font("Helvetica").fontSize(9);
    doc.y = y + 7;
    doc.text(item.description, cols.description, y + 7, { width: widths.description, lineGap: 2 });
    doc.y = y + 7;
    doc.text(String(item.quantity), cols.qty, y + 7, { width: widths.qty, align: "right" });
    doc.y = y + 7;
    doc.text(money(item.unit_price_minor, data.currency), cols.unit, y + 7, { width: widths.unit, align: "right" });
    doc.y = y + 7;
    doc.text(money(item.line_total_minor, data.currency), cols.amount, y + 7, { width: widths.amount, align: "right" });
    y += rowHeight;
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).strokeColor("#e0e7e3").stroke();
  });

  const totalsHeight = data.tax_minor > 0 ? 108 : 88;
  if (y + totalsHeight > doc.page.height - margin - 38) { doc.addPage(); y = margin; }
  y += 12;
  const totalLabelX = pageWidth - margin - 202;
  const totalValueX = pageWidth - margin - 104;
  const totalRow = (label: string, value: string, strong = false) => {
    doc.fillColor(strong ? green : muted).font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(strong ? 12 : 9.5);
    doc.y = y;
    doc.text(label, totalLabelX, y, { width: 115 });
    doc.y = y;
    doc.text(value, totalValueX, y, { width: 104, align: "right" });
    y += strong ? 23 : 18;
  };
  totalRow("Subtotal", money(data.subtotal_minor, data.currency));
  if (data.discount_minor > 0) {
    const discountLabel = data.discount_type === "percentage" ? `Discount (${data.discount_value}%)` : "Discount";
    totalRow(discountLabel, `- ${money(data.discount_minor, data.currency)}`);
  }
  if (data.tax_minor > 0) totalRow("Tax", money(data.tax_minor, data.currency));
  doc.moveTo(totalLabelX, y - 3).lineTo(pageWidth - margin, y - 3).strokeColor(green).lineWidth(1.2).stroke();
  totalRow("TOTAL", money(data.total_minor, data.currency), true);

  if (data.terms) {
    if (y + 60 > doc.page.height - margin - 38) { doc.addPage(); y = margin; }
    y += 12;
    doc.fillColor(green).font("Helvetica-Bold").fontSize(10).text("Terms and conditions", margin, y);
    y = doc.y + 5;
    doc.fillColor("#34413c").font("Helvetica").fontSize(8.5).text(data.terms, margin, y, { width: usableWidth, lineGap: 3 });
  }

  doc.end();
  return doc;
}
