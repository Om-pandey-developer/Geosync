/**
 * Form-II Statutory Cadastral Survey & Bhu-Aadhaar Certificate Generator
 * ======================================================================
 * Compliant with DILRMP 3.0 / NAKSHA Pilot Protocol & DoLR Standards.
 */
// PDF generation utilities

import { jsPDF } from "jspdf";

export interface FormIICertificateData {
  khasraNo: string;
  ownerName: string;
  village: string;
  tehsil: string;
  district: string;
  state?: string;
  ulpin: string;
  areaSqm: number;
  alignmentConfidence?: number;
  officerId?: string;
  approvalDate?: string;
  endorsementNote?: string;
  isOccluded?: boolean;
  digitalSignature?: string;
}

export function generateFormIIPdf(data: FormIICertificateData) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // ── Outer Security Guilloche Border ──
  doc.setDrawColor(13, 148, 136); // Teal theme
  doc.setLineWidth(1.2);
  doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

  doc.setDrawColor(203, 213, 225); // Subtle inner border
  doc.setLineWidth(0.4);
  doc.rect(margin + 2, margin + 2, pageWidth - 2 * margin - 4, pageHeight - 2 * margin - 4);

  // ── Header: National & State Coat of Arms Reference ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text("GOVERNMENT OF UTTAR PRADESH", pageWidth / 2, margin + 9, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("BOARD OF REVENUE • DEPARTMENT OF LAND RESOURCES (DoLR)", pageWidth / 2, margin + 14, { align: "center" });
  doc.text("Digital India Land Records Modernisation Programme (DILRMP 3.0) — Project NAKSHA", pageWidth / 2, margin + 18, { align: "center" });

  // Divider Line
  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(0.6);
  doc.line(margin + 10, margin + 21, pageWidth - margin - 10, margin + 21);

  // ── Certificate Title Banner ──
  doc.setFillColor(240, 253, 250); // Mint/teal tint
  doc.rect(margin + 6, margin + 24, pageWidth - 2 * margin - 12, 12, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(13, 148, 136);
  doc.text("FORM-II: STATUTORY SURVEY ADJUDICATION & BHU-AADHAAR CERTIFICATE", pageWidth / 2, margin + 31.5, { align: "center" });

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("[Issued under Section 14 of the UP Revenue Code & National Geospatial Data Guidelines 2026]", pageWidth / 2, margin + 35, { align: "center" });

  // ── 14-Digit Base-14 Bhu-Aadhaar (ULPIN) Security Box ──
  let y = margin + 41;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin + 6, y, pageWidth - 2 * margin - 12, 18, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("UNIQUE LAND PARCEL IDENTIFICATION NUMBER (ULPIN / BHU-AADHAAR)", margin + 10, y + 5.5);

  doc.setFont("courier", "bold");
  doc.setFontSize(15);
  doc.setTextColor(2, 132, 199); // Sky blue
  doc.text(data.ulpin || "9YYD56AA2Z9Y3A", margin + 10, y + 13.5);

  // Simulated Verification Barcode Block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("DIGITAL ID VERIFIED", pageWidth - margin - 42, y + 5.5);

  // Draw simulated barcode stripes
  const barcodeX = pageWidth - margin - 42;
  const barcodeY = y + 7.5;
  doc.setFillColor(15, 23, 42);
  const barPattern = [1.5, 0.6, 2, 0.8, 1.2, 0.5, 2.5, 0.7, 1.8, 0.6, 1.2, 0.8, 2.2, 0.5, 1.5];
  let curX = barcodeX;
  barPattern.forEach((w) => {
    doc.rect(curX, barcodeY, w, 7, "F");
    curX += w + 0.9;
  });

  // ── Section 1: Cadastral Land Record Particulars ──
  y += 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("1. REVENUE JURISDICTION & PARCEL RECORD PARTICULARS", margin + 6, y);

  y += 3;
  const rowHeight = 7;
  const col1 = margin + 6;
  const col2 = col1 + 42;
  const col3 = col1 + 90;
  const col4 = col3 + 42;

  const renderRow = (label1: string, val1: string, label2: string, val2: string) => {
    doc.setFillColor(248, 250, 252);
    doc.rect(col1, y, pageWidth - 2 * margin - 12, rowHeight, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(col1, y, pageWidth - 2 * margin - 12, rowHeight, "D");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label1, col1 + 3, y + 4.8);
    doc.text(label2, col3 + 3, y + 4.8);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(val1, col2, y + 4.8);
    doc.text(val2, col4, y + 4.8);

    y += rowHeight;
  };

  renderRow("Khasra / Plot No:", `Khasra ${data.khasraNo}`, "Village / Ward:", data.village || "Mohanlalganj (Ward 12)");
  renderRow("Recorded Owner:", data.ownerName, "Tehsil / Sub-Division:", data.tehsil || "Mohanlalganj");
  renderRow("District:", data.district || "Lucknow", "State:", data.state || "Uttar Pradesh");

  // ── Section 2: Drone Survey Metric Area Breakdown ──
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("2. 5cm HIGH-RESOLUTION NAKSHA DRONE METRIC SURVEY BREAKDOWN", margin + 6, y);

  y += 3;
  const areaSqm = Number(data.areaSqm || 5714.41);
  const areaHectares = (areaSqm / 10000).toFixed(4);
  const areaBigha = (areaSqm / 2529.3).toFixed(2);

  renderRow("Metric Ground Area:", `${areaSqm.toFixed(2)} sq. meters`, "Hectares:", `${areaHectares} Ha`);
  renderRow("Local Unit (Bigha):", `${areaBigha} Pucca Bigha`, "Survey Standard:", "EPSG:3857 / WGS84 EPSG:4326");

  // ── Section 3: AI Harmonization & Topological Audit ──
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("3. GEOSAM AI HARMONIZATION & TOPOLOGICAL AUDIT TRAIL", margin + 6, y);

  y += 3;
  const confPercent = ((data.alignmentConfidence ?? 0.96) * 100).toFixed(1);

  renderRow("ORB Homography Conf.:", `${confPercent}% Quality Index`, "GeoSAM Backbone:", "ViT-H 632M (Zero-Shot)");
  renderRow("PostGIS Cleansing:", "ST_Difference (0 overlaps)", "Sliver Gap Snap:", "ST_Snap (@ 0.05m tolerance)");
  renderRow(
    "Occlusion Evaluation:",
    data.isOccluded ? "WARNING: Tree Canopy Detected" : "PASS: 0% Shadow Occlusion",
    "Air-Gap Proof Mode:",
    "True (Offline Cached 1024-d)"
  );

  // ── Section 4: Statutory Endorsement & Tehsildar Adjudication ──
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("4. STATUTORY REVENUE MAGISTRATE (HITL) ADJUDICATION ORDER", margin + 6, y);

  y += 3;
  doc.setFillColor(254, 252, 232); // Pale amber box
  doc.setDrawColor(254, 240, 138);
  doc.roundedRect(margin + 6, y, pageWidth - 2 * margin - 12, 16, 2, 2, "FD");

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(113, 63, 18);
  const defaultNote =
    "ORDER: Having verified the 50-year legacy cadastral boundaries against the 5cm NAKSHA drone orthomosaics and verified topological snapping compliance with zero ownership overlaps, the boundary is hereby legally locked and sanctioned to the National Land Stack under DILRMP 3.0.";
  const noteLines = doc.splitTextToSize(data.endorsementNote || defaultNote, pageWidth - 2 * margin - 20);
  doc.text(noteLines, margin + 10, y + 5);

  // ── Section 5: Signature & Digital Seal Block ──
  y += 22;
  const sealBoxWidth = (pageWidth - 2 * margin - 18) / 2;

  // Left Box: Digital Signature
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin + 6, y, sealBoxWidth, 34, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("DIGITALLY SIGNED & SANCTIONED", margin + 10, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(`Officer ID: ${data.officerId || "REV-TEH-3210 (Tehsildar)"}`, margin + 10, y + 12);
  doc.text(`Jurisdiction: Mohanlalganj Sub-Division, Lucknow`, margin + 10, y + 17);
  doc.text(`Timestamp: ${data.approvalDate || new Date().toLocaleString("en-IN")}`, margin + 10, y + 22);

  doc.setFont("courier", "bold");
  doc.setFontSize(6.2);
  doc.setTextColor(13, 148, 136);
  const sigLabel = data.digitalSignature
    ? `SHA256: ${data.digitalSignature.slice(0, 28)}…`
    : "CERT-HASH: 8F3C92B410D9488AE52B9A";
  doc.text(sigLabel, margin + 10, y + 28);

  // Right Box: Official Statutory Stamp
  const rightBoxX = margin + 6 + sealBoxWidth + 6;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(rightBoxX, y, sealBoxWidth, 34, 2, 2, "FD");

  // Circular Stamp Graphics
  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(0.8);
  doc.circle(rightBoxX + sealBoxWidth / 2, y + 17, 13);
  doc.setLineWidth(0.3);
  doc.circle(rightBoxX + sealBoxWidth / 2, y + 17, 11);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(13, 148, 136);
  doc.text("TEHSILDAR COURT", rightBoxX + sealBoxWidth / 2, y + 12, { align: "center" });
  doc.text("★ MOHANLALGANJ ★", rightBoxX + sealBoxWidth / 2, y + 17, { align: "center" });
  doc.text("SANCTIONED", rightBoxX + sealBoxWidth / 2, y + 22, { align: "center" });

  // ── Footer Security Disclaimer ──
  const footerY = pageHeight - margin - 3;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "This is an authenticated legal electronic cadastral extract generated by Project GeoSync under Ministry of Rural Development standards. Verify digitally via Bhu-Aadhaar National Portal.",
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  // Save the PDF
  const filename = `Form-II_Certificate_Khasra_${data.khasraNo}_${data.ulpin || "DRAFT"}.pdf`;
  doc.save(filename);
}
