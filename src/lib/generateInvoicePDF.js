/**
 * generateInvoicePDF.js
 *
 * Generates a GST-compliant, premium A4 PDF invoice for Curated by Banjaras.
 * Uses jsPDF v4 + jspdf-autotable v5.
 *
 * All prices on the website are GST-INCLUSIVE.
 * Back-calculation is used to separate base price and GST on the invoice.
 *
 * To update seller info: edit the SELLER constant below.
 * To add new HSN codes / GST rates: edit src/lib/hsnConfig.js.
 *
 * NOTE ON CURRENCY SYMBOL:
 * jsPDF's built-in Helvetica font uses Latin-1 encoding and does NOT include
 * the ₹ glyph (U+20B9). Using ₹ directly causes garbled output on some
 * machines/browsers. We use "Rs." prefix throughout instead — universally safe.
 *
 * NOTE ON BRAND FONT:
 * jsPDF does not support Google Fonts (e.g. Cormorant Garamond) natively.
 * The header wordmark ("CURATED / BY BANJARAS") is rendered using the built-in
 * Times-Roman serif font with wide character spacing and matching dark espresso
 * colour — the closest available approximation of the brand's Cormorant Garamond
 * wordmark within standard PDF font sets.
 */

import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';
import { getGstRate } from './hsnConfig';

// Register autotable plugin with jsPDF v4
applyPlugin(jsPDF);

// ── Seller / Business Details ─────────────────────────────────────────────────
const SELLER = {
  name:     'Curated by Banjaras',
  addr1:    'Basement, D-229, Sector-55',
  addr2:    'Noida, Gautambuddha Nagar',
  statePin: 'Uttar Pradesh - 201301',
  gstin:    '09LZFPS4192C1ZV',
  state:    'uttar pradesh',          // lowercase — used for intra/inter state check
};

// ── Brand Colour Palette (RGB arrays for jsPDF) ────────────────────────────────
const C = {
  terracotta: [166, 95,  70],    // #A65F46
  gold:       [184, 155, 114],   // #B89B72
  espresso:   [36,  28,  24],    // #241C18
  linen:      [245, 239, 232],   // #F5EFE8
  sand:       [243, 235, 225],   // #F3EBE1
  cocoa:      [74,  52,  43],    // #4A342B
  white:      [255, 255, 255],
  lightText:  [200, 185, 165],
  mutedText:  [180, 165, 145],
};

// ── Indian Number-to-Words Conversion ─────────────────────────────────────────
const ONES = [
  '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
  'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
];
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  const o = n % 10 ? ' ' + ONES[n % 10] : '';
  return (t + o).trim();
}

function threeDigits(n) {
  if (n >= 100) {
    const h = ONES[Math.floor(n / 100)] + ' HUNDRED';
    return n % 100 ? h + ' ' + twoDigits(n % 100) : h;
  }
  return twoDigits(n);
}

/**
 * Converts a numeric amount (rupees + paise) to Indian words.
 * e.g. 1924.50 → "ONE THOUSAND NINE HUNDRED TWENTY FOUR RUPEES AND FIFTY PAISE ONLY"
 */
function numberToWords(amount) {
  const rupees = Math.floor(amount);
  const paise  = Math.round((amount - rupees) * 100);

  const parts = [];
  let rem = rupees;

  if (rem >= 10_000_000) {
    parts.push(threeDigits(Math.floor(rem / 10_000_000)) + ' CRORE');
    rem %= 10_000_000;
  }
  if (rem >= 100_000) {
    parts.push(twoDigits(Math.floor(rem / 100_000)) + ' LAKH');
    rem %= 100_000;
  }
  if (rem >= 1_000) {
    parts.push(threeDigits(Math.floor(rem / 1_000)) + ' THOUSAND');
    rem %= 1_000;
  }
  if (rem > 0) {
    parts.push(threeDigits(rem));
  }

  let result = (parts.length ? parts.join(' ') : 'ZERO') + ' RUPEES';
  if (paise > 0) result += ' AND ' + twoDigits(paise) + ' PAISE';
  return result + ' ONLY';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function r2(n) { return Math.round(n * 100) / 100; }
function fmt(n) { return r2(n).toFixed(2); }

/**
 * Maps the stored payment_method value to a human-readable label.
 * Razorpay orders store 'upi' | 'card' | 'netbanking' as-is.
 * COD orders store 'COD' or 'cod'.
 * Wallet-only orders store 'WALLET'.
 */
function formatPaymentMethod(method) {
  switch ((method || '').toLowerCase()) {
    case 'upi':        return 'UPI';
    case 'card':       return 'Credit / Debit Card';
    case 'netbanking': return 'Net Banking';
    case 'cod':        return 'Cash on Delivery';
    case 'wallet':     return 'Wallet Balance';
    case 'online':     return 'Online (Razorpay)';
    case 'paylater':   return 'Pay Later';
    default:           return method || 'Online';
  }
}

// ── Main Export ───────────────────────────────────────────────────────────────
/**
 * Generates and downloads a GST-compliant PDF invoice for the given order.
 *
 * @param {object} order   — full order object from Supabase
 * @param {object} hsnMap  — productId → hsn_code lookup (from AdminOrders state)
 */
export function generateInvoicePDF(order, hsnMap = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W = 210;    // A4 width mm
  const M = 14;     // margin mm

  // ── Metadata ────────────────────────────────────────────────────────────────
  const addr        = order.delivery_address || {};
  const displayId   = order.id?.startsWith('CB') ? order.id : `CB${order.id}`;
  const invoiceNum  = `INV-${displayId}`;
  const invoiceDate = new Date(order.created_at).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  // ── State Detection (CGST/SGST vs IGST) ────────────────────────────────────
  // For GST billing orders, use the billing state; otherwise use delivery state.
  const custState = (
    addr.isGstBilling
      ? (addr.billingState || addr.shippingState || addr.state || '')
      : (addr.state || addr.shippingState || '')
  ).trim().toLowerCase();
  const isIntraState = custState === SELLER.state;

  // ── Items + Tax Calculations ─────────────────────────────────────────────────
  // Debug: log what we're looking up vs what the hsnMap has
  console.log('[Invoice] hsnMap keys:', Object.keys(hsnMap));
  console.log('[Invoice] order item IDs:', (order.items || []).map(i => ({
    id: i.id, product_id: i.product_id, 'Product Id': i['Product Id'],
  })));

  const items = (order.items || []).map(item => {
    // FIX 2: Try all possible HSN lookup keys — item.hsn_code, then hsnMap by
    // item.id (string), item.product_id (string), or item['Product Id'] (string).
    const hsnCode = (
      item.hsn_code ||
      hsnMap[String(item.id)] ||
      hsnMap[String(item.product_id)] ||
      hsnMap[String(item['Product Id'])] ||
      ''
    ).toString().trim();

    const gstRate   = getGstRate(hsnCode);
    const qty       = (item.bundleQty || 1) * (item.quantity || 1);

    // item.price is the GST-INCLUSIVE price per unit (as stored in the cart)
    const unitPriceInclGst = parseFloat(item.price) || 0;

    // The GST-inclusive line total = price-per-unit × quantity (no bundleQty
    // multiplication here — bundleQty is already factored into item.price at
    // order creation time for bundle products).
    const lineTotal  = r2(unitPriceInclGst * (item.quantity || 1));

    // Back-calculate the taxable (pre-GST) value for the whole line
    const taxable    = r2(lineTotal / (1 + gstRate / 100));

    // GST amount for the whole line
    const gstAmt     = r2(lineTotal - taxable);

    // FIX 4: Unit Price shown on invoice = taxable value ÷ qty (pre-GST per unit)
    // e.g. Rs. 360 incl. 5% GST → taxable = 342.86, so unit price = 342.86 / 1 = 342.86
    const unitPriceExGst = r2(taxable / qty);

    return { ...item, hsnCode, gstRate, qty, unitPriceExGst, lineTotal, taxable, gstAmt };
  });

  // ── Dominant GST rate (for tax line labels) ───────────────────────────────────
  const dominantRate = items[0]?.gstRate ?? 5;
  const halfRate     = dominantRate / 2;

  // ── Totals ───────────────────────────────────────────────────────────────────
  const baseTaxable = r2(items.reduce((s, i) => s + i.taxable, 0));
  const baseGst     = r2(items.reduce((s, i) => s + i.gstAmt, 0));

  let codCharge = 0;
  let codTaxable = 0;
  let codGstAmt = 0;
  if ((order.payment_method || '').toLowerCase() === 'cod') {
    codCharge = 100;
    codTaxable = r2(codCharge / (1 + dominantRate / 100));
    codGstAmt = r2(codCharge - codTaxable);
  }

  const totalTaxable = r2(baseTaxable + codTaxable);
  const totalGst     = r2(baseGst + codGstAmt);

  // Validation assertion to prevent silent math bugs
  const productTotals = r2(items.reduce((s, i) => s + i.lineTotal, 0));
  const calcGrandTotal = r2(totalTaxable + totalGst);
  const chargedBase = r2(productTotals + codCharge);
  if (Math.abs(calcGrandTotal - chargedBase) > 0.05) {
    console.error(`Invoice math mismatch: (totalTaxable + totalGST) ${calcGrandTotal} != (productTotals + codCharge) ${chargedBase}`);
  }

  const couponAmt    = r2(parseFloat(order.coupon_discount_amount) || 0);
  const walletAmt    = r2(parseFloat(order.wallet_used_amount) || 0);
  // grandTotal = order.total_amount = totalBeforeWallet (pre-wallet, post-coupon).
  // netPayable = what the customer actually paid in cash / card (post wallet deduction).
  const grandTotal   = r2(parseFloat(order.total_amount) || 0);
  const netPayable   = r2(Math.max(0, grandTotal - walletAmt));

  // ── Payment method display label ───────────────────────────────────────────────
  const pmtLabel = formatPaymentMethod(order.payment_method);

  // ═══════════════════════════════════════════════════════════════════════════
  //  SECTION A — HEADER
  // ═══════════════════════════════════════════════════════════════════════════

  const HEADER_H = 46;

  // Linen background
  doc.setFillColor(...C.linen);
  doc.rect(0, 0, W, HEADER_H, 'F');

  // ── FIX 1: Left: Brand / Logo Block using Times-Roman serif ─────────────────
  // "CURATED" — large Times-Roman (serif), light/normal weight, wide tracking,
  // dark espresso colour — matches the Cormorant Garamond brand wordmark style.
  doc.setFont('times', 'normal');
  doc.setFontSize(28);
  doc.setTextColor(...C.espresso);
  doc.setCharSpace(5);            // wide tracking to match the logo
  doc.text('CURATED', M, 17);

  // "BY BANJARAS" — smaller Times-Roman, moderate tracking, same espresso colour
  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...C.espresso);
  doc.setCharSpace(3);
  doc.text('BY BANJARAS', M, 25);
  doc.setCharSpace(0);

  // Seller address lines
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.espresso);
  doc.text(SELLER.addr1, M, 31.5);
  doc.text(SELLER.addr2 + ', ' + SELLER.statePin, M, 36);
  doc.text('GSTIN: ' + SELLER.gstin, M, 40.5);

  // ── Right: Invoice Label + Meta ──────────────────────────────────────────────
  // "TAX INVOICE"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...C.terracotta);
  doc.text('TAX INVOICE', W - M, 14, { align: 'right' });

  // Invoice number, date, order ID
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.espresso);
  doc.text(`Invoice No: ${invoiceNum}`, W - M, 22, { align: 'right' });
  doc.text(`Invoice Date: ${invoiceDate}`, W - M, 27.5, { align: 'right' });
  doc.text(`Order ID: #${displayId}`, W - M, 33, { align: 'right' });

  // Gold divider line below header
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.4);
  doc.line(M, HEADER_H + 1, W - M, HEADER_H + 1);

  // ═══════════════════════════════════════════════════════════════════════════
  //  SECTION B — BILL TO / ORDER DETAILS
  // ═══════════════════════════════════════════════════════════════════════════

  let y = HEADER_H + 9;
  const colMid = W / 2 + 2;

  // ── Column headings ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.terracotta);
  doc.text('BILL TO:', M, y);
  doc.text('ORDER DETAILS:', colMid, y);

  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.espresso);

  // Customer name
  const custName = addr.isGstBilling
    ? (addr.legalName || addr.tradeName || 'N/A')
    : `${addr.firstName || ''} ${addr.lastName || ''}`.trim() || 'N/A';

  doc.setFont('helvetica', 'bold');
  doc.text(custName, M, y);
  doc.setFont('helvetica', 'normal');

  // Order details right column — no status, just ID / date / payment method
  doc.text(`Order ID:  #${displayId}`, colMid, y);
  y += 4.5;
  doc.text(`Date:        ${invoiceDate}`, colMid, y);
  y += 4.5;
  doc.text(`Payment:   ${pmtLabel}`, colMid, y);

  // Customer address rows (left column)
  let addrY = y - 4.5;   // start from after name row (2 right-column lines already drawn)

  if (addr.isGstBilling) {
    if (addr.gstin) {
      doc.setFont('helvetica', 'bold');
      doc.text(`GSTIN: ${addr.gstin}`, M, addrY); addrY += 4.5;
      doc.setFont('helvetica', 'normal');
    }
    const b1 = [addr.billingAddr1, addr.billingAddr2].filter(Boolean).join(', ');
    if (b1) { doc.text(b1, M, addrY); addrY += 4.5; }
    const b2 = [addr.billingCity, addr.billingState].filter(Boolean).join(', ') +
               (addr.billingPincode ? ` - ${addr.billingPincode}` : '');
    if (b2) { doc.text(b2, M, addrY); addrY += 4.5; }
  } else {
    const line1 = [addr.house, addr.building].filter(Boolean).join(', ');
    const line2 = [addr.area, addr.landmark].filter(Boolean).join(', ');
    const line3 = [addr.city, addr.state].filter(Boolean).join(', ') +
                  (addr.pincode ? ` - ${addr.pincode}` : '');
    if (line1) { doc.text(line1, M, addrY); addrY += 4.5; }
    if (line2) { doc.text(line2, M, addrY); addrY += 4.5; }
    if (line3) { doc.text(line3, M, addrY); addrY += 4.5; }
  }
  if (addr.mobile) { doc.text(`Phone: ${addr.mobile}`, M, addrY); addrY += 4.5; }
  if (addr.email)  { doc.text(`Email: ${addr.email}`, M, addrY); }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SECTION C — ITEMS TABLE
  // ═══════════════════════════════════════════════════════════════════════════

  const tableStartY = Math.max(Math.max(y, addrY) + 8, 108);

  // Available table width: 210 - 14 - 14 = 182mm
  // FIX 3 & 4: Correct column order per spec:
  //   Sr.(7) + Name(52) + HSN(20) + UnitPrice(23) + Qty(10) + Taxable(24) + GST%(11) + GSTAmt(20) + Total(15) = 182
  // Qty column is 10mm (was 8mm) — enough for "Qty" header to fit on one line.
  const tableColumns = [
    { header: 'Sr.',          dataKey: 'sr'        },
    { header: 'Product Name', dataKey: 'name'      },
    { header: 'HSN Code',     dataKey: 'hsn'       },
    { header: 'Unit Price',   dataKey: 'unitPrice' },
    { header: 'Qty',          dataKey: 'qty'       },
    { header: 'Taxable Value',dataKey: 'taxable'   },
    { header: 'GST %',        dataKey: 'gstPct'    },
    { header: 'GST Amount',   dataKey: 'gstAmt'    },
    { header: 'Total',        dataKey: 'total'     },
  ];

  // FIX 4: unitPrice = pre-GST per-unit price; taxable = unitPrice × qty;
  // gstAmt = its own visible column; total = taxable + gstAmt
  const tableRows = items.map((item, i) => ({
    sr:        i + 1,
    name:      item.name || 'Product',
    hsn:       item.hsnCode || '-',
    unitPrice: `Rs. ${fmt(item.unitPriceExGst)}`,
    qty:       item.qty,
    taxable:   `Rs. ${fmt(item.taxable)}`,
    gstPct:    `${item.gstRate}%`,
    gstAmt:    `Rs. ${fmt(item.gstAmt)}`,
    total:     `Rs. ${fmt(item.lineTotal)}`,
  }));

  doc.autoTable({
    startY: tableStartY,
    columns: tableColumns,
    body: tableRows,
    margin: { left: M, right: M },
    tableWidth: W - 2 * M,    // pin to exact available width
    styles: {
      fontSize: 7,
      cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
      textColor: C.espresso,
      lineColor: C.gold,
      lineWidth: 0.15,
      font: 'helvetica',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: C.terracotta,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 6.5,
      halign: 'center',
      // FIX 3: prevent header text from wrapping — use ellipsize for narrow cols
      overflow: 'ellipsize',
      cellPadding: { top: 3, bottom: 3, left: 1, right: 1 },
    },
    alternateRowStyles: { fillColor: C.sand },
    columnStyles: {
      0: { cellWidth: 7,  halign: 'center' },   // Sr.
      1: { cellWidth: 52 },                      // Product Name
      2: { cellWidth: 20, halign: 'center' },    // HSN Code
      3: { cellWidth: 23, halign: 'right'  },    // Unit Price
      4: { cellWidth: 10, halign: 'center' },    // Qty  (widened to prevent wrapping)
      5: { cellWidth: 24, halign: 'right'  },    // Taxable Value
      6: { cellWidth: 11, halign: 'center' },    // GST %
      7: { cellWidth: 20, halign: 'right'  },    // GST Amount
      8: { cellWidth: 15, halign: 'right'  },    // Total
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  SECTION D — TAX SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  let ty = doc.lastAutoTable.finalY + 7;

  // FIX 6: Use wider label+value box to prevent "TOTAL" being clipped.
  // labelX is the right-edge of the label text (right-aligned).
  // valueX is the right-edge of the value text.
  // The enclosing box starts at boxStartX and spans to W - M.
  const boxStartX = M + 90;          // start of the summary block
  const labelX    = W - M - 38;      // right-edge for labels  (was W - M - 56)
  const valueX    = W - M;           // right-edge for values

  // Thin separator line
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.2);
  doc.line(boxStartX - 2, ty - 3, W - M, ty - 3);

  // Helper: draw a summary row — uses "Rs." prefix, never ₹
  const summaryRow = (label, value) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.espresso);
    doc.text(label, labelX, ty, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(value, valueX, ty, { align: 'right' });
    ty += 5.5;
  };

  summaryRow('Subtotal (Taxable):', `Rs. ${fmt(baseTaxable)}`);
  if (codCharge > 0) {
    summaryRow('Cash on Delivery Charges (Taxable):', `Rs. ${fmt(codTaxable)}`);
    summaryRow('Total Taxable Amount:', `Rs. ${fmt(totalTaxable)}`);
  }

  // FIX 5: Dynamically show CGST+SGST (intra-state) or IGST (inter-state)
  if (isIntraState) {
    summaryRow(`CGST (${halfRate}%):`, `Rs. ${fmt(totalGst / 2)}`);
    summaryRow(`SGST (${halfRate}%):`, `Rs. ${fmt(totalGst / 2)}`);
  } else {
    summaryRow(`IGST (${dominantRate}%):`, `Rs. ${fmt(totalGst)}`);
  }

  if (couponAmt > 0) {
    summaryRow(
      `Coupon${order.coupon_code_used ? ` (${order.coupon_code_used})` : ''}:`,
      `-Rs. ${fmt(couponAmt)}`
    );
  }
  if (walletAmt > 0) {
    summaryRow('Wallet Credit Used:', `-Rs. ${fmt(walletAmt)}`);
  }

  // Divider before grand total
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.3);
  doc.line(boxStartX - 2, ty - 2, W - M, ty - 2);
  ty += 2;

  // FIX 6: Grand Total — highlighted Terracotta pill, wide enough to fit full text
  // The pill starts at boxStartX - 2 and spans to the right margin (W - M).
  const gtBoxX = boxStartX - 4;
  const gtBoxW = W - M - gtBoxX;
  doc.setFillColor(...C.terracotta);
  doc.roundedRect(gtBoxX, ty - 4, gtBoxW, 10, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.white);
  // "TOTAL:" label — right-aligned against labelX; value right-aligned at valueX
  doc.text('TOTAL:', labelX, ty + 2, { align: 'right' });
  doc.text(`Rs. ${fmt(netPayable)}`, valueX, ty + 2, { align: 'right' });
  ty += 15;

  // ═══════════════════════════════════════════════════════════════════════════
  //  SECTION E — AMOUNT IN WORDS
  // ═══════════════════════════════════════════════════════════════════════════

  doc.setFillColor(...C.linen);
  doc.rect(M, ty - 3, W - 2 * M, 10, 'F');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...C.espresso);

  const wordsText = `Amount in words: ${numberToWords(netPayable)}`;
  const splitWords = doc.splitTextToSize(wordsText, W - 2 * M - 6);
  doc.text(splitWords, M + 3, ty + 3);
  ty += (splitWords.length > 1 ? 14 + (splitWords.length - 1) * 4 : 14);

  // ═══════════════════════════════════════════════════════════════════════════
  //  SECTION F — PAYMENT METHOD (method only — no status line per Fix 7)
  // ═══════════════════════════════════════════════════════════════════════════

  if (order.payment_method) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.terracotta);
    doc.text('PAYMENT INFO', M, ty);
    ty += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.espresso);
    doc.text(`Payment Method: ${pmtLabel}`, M, ty);
    ty += 6;
    // FIX 7: "Payment Status: PENDING" line removed entirely.
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SECTION G — FOOTER
  // ═══════════════════════════════════════════════════════════════════════════

  const FOOTER_Y  = 270;
  const FOOTER_H  = 27;

  // Dark cocoa footer background
  doc.setFillColor(...C.cocoa);
  doc.rect(0, FOOTER_Y, W, FOOTER_H, 'F');

  // Terms & Conditions
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(...C.lightText);
  doc.text(
    'Terms: All sales are subject to our Return & Refund Policy. Goods once dispatched are subject to our shipping terms.',
    W / 2, FOOTER_Y + 5, { align: 'center' }
  );
  doc.text(
    'For support: reach us via our website contact form.',
    W / 2, FOOTER_Y + 9.5, { align: 'center' }
  );
  doc.text(
    'This is a computer-generated invoice. No physical signature is required.',
    W / 2, FOOTER_Y + 14, { align: 'center' }
  );

  // "Thank you" in Antique Gold
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...C.gold);
  doc.text('Thank you for shopping with us!', W / 2, FOOTER_Y + 20, { align: 'center' });

  // Brand tag line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.mutedText);
  doc.text('CURATED BY BANJARAS  |  Noida, Uttar Pradesh', W / 2, FOOTER_Y + 25, { align: 'center' });

  // ── Save PDF ─────────────────────────────────────────────────────────────────
  doc.save(`Invoice-${displayId}.pdf`);
}
