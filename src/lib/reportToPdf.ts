/**
 * Report to PDF — Capture the report wrapper DOM and download as multi-page PDF.
 * Uses html2canvas to render the element and jsPDF to build the document.
 */

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

export async function reportToPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const scale = 2;
  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    logging: false,
    backgroundColor: "#0f0f1a",
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF("p", "mm", "a4");
  const pdfWidth = A4_WIDTH_MM;
  const pdfHeight = A4_HEIGHT_MM;
  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;

  pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);

  let heightLeft = imgHeight - pdfHeight;
  let page = 1;
  while (heightLeft > 0) {
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, -page * pdfHeight, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
    page += 1;
  }

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
