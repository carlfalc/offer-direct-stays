import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportRow {
  ref: string;
  property: string;
  room: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  currency: string;
  nightly: number;
  total: number;
  fee: number;
  entered: string;
  confirmed: string;
}

const HEADERS = [
  'Booking', 'Property', 'Room', 'Check-in', 'Check-out', 'Nights', 'Guests',
  'Nightly', 'Total', 'Booking fee', 'Entered', 'Confirmed',
];

function money(cur: string, n: number) {
  return `${cur} $${n.toLocaleString()}`;
}

/** Download the bookings as a real .xlsx workbook. */
export function exportBookingsXlsx(rows: ReportRow[], fileBase: string) {
  const data = rows.map((r) => ({
    Booking: r.ref,
    Property: r.property,
    Room: r.room,
    'Check-in': r.checkIn,
    'Check-out': r.checkOut,
    Nights: r.nights,
    Guests: r.guests,
    Nightly: money(r.currency, r.nightly),
    Total: money(r.currency, r.total),
    'Booking fee': money(r.currency, r.fee),
    Entered: r.entered,
    Confirmed: r.confirmed,
  }));
  const ws = XLSX.utils.json_to_sheet(data, { header: HEADERS });
  ws['!cols'] = HEADERS.map((h) => ({ wch: Math.max(h.length + 2, 12) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bookings');
  XLSX.writeFile(wb, `${fileBase}.xlsx`);
}

/** Download the bookings as a formatted PDF table. */
export function exportBookingsPdf(rows: ReportRow[], title: string, subtitle: string, fileBase: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' });
  doc.setFontSize(16);
  doc.text(title, 40, 40);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(subtitle, 40, 58);

  const totalRevenue = rows.reduce((s, r) => s + r.total, 0);
  const totalFees = rows.reduce((s, r) => s + r.fee, 0);
  const cur = rows[0]?.currency || 'NZD';
  doc.text(`${rows.length} bookings · ${money(cur, totalRevenue)} value · ${money(cur, totalFees)} in booking fees`, 40, 74);

  autoTable(doc, {
    startY: 90,
    head: [HEADERS.filter((h) => h !== 'Confirmed')],
    body: rows.map((r) => [
      r.ref, r.property, r.room, r.checkIn, r.checkOut, String(r.nights), String(r.guests),
      money(r.currency, r.nightly), money(r.currency, r.total), money(r.currency, r.fee), r.entered,
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [23, 42, 69], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 248, 251] },
  });

  doc.save(`${fileBase}.pdf`);
}
