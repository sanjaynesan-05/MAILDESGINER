import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractPdfText(buffer: Buffer) {
  const pdf = await getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
  }
  return { pageCount: pdf.numPages, text: pages.join("\n") };
}
