import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getConceptsBySection, sectionOrder } from './ubprConceptMap';

interface QuarterData {
  report_date: string;
  metrics: Record<string, number | string>;
}

function formatValue(raw: unknown, fmt: string): string {
  if (raw === null || raw === undefined || raw === '') return '—';
  const num = typeof raw === 'string' ? parseFloat(raw) : (raw as number);
  if (isNaN(num)) return String(raw);

  if (fmt === 'dollar') {
    const inThousands = Math.round(num / 1000);
    return inThousands.toLocaleString('en-US');
  }
  if (fmt === 'ratio') return num.toFixed(2) + '%';
  if (fmt === 'count') return Math.round(num).toLocaleString('en-US');
  return String(raw);
}

function formatQuarterLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.getMonth();
  const year = d.getFullYear();
  const q = month < 3 ? 'Q1' : month < 6 ? 'Q2' : month < 9 ? 'Q3' : 'Q4';
  return `${q} ${year}`;
}

export async function generateUBPRPdf(
  bankName: string,
  rssd: string,
  quarters: QuarterData[],
): Promise<string> {
  const sorted = [...quarters]
    .sort((a, b) => b.report_date.localeCompare(a.report_date))
    .slice(0, 5);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Uniform Bank Performance Report (UBPR)', pageWidth / 2, 40, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${bankName}  •  RSSD #${rssd}`, pageWidth / 2, 58, { align: 'center' });

  doc.setFontSize(9);
  doc.text(
    `Report generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}  •  Dollar amounts in thousands`,
    pageWidth / 2, 72, { align: 'center' },
  );

  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(1.5);
  doc.line(40, 78, pageWidth - 40, 78);

  const conceptsBySection = getConceptsBySection();
  const quarterLabels = sorted.map((q) => formatQuarterLabel(q.report_date));

  let startY = 92;

  const addFooter = (pageNum: number) => {
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(`UBPR – ${bankName} (RSSD ${rssd})`, 40, pageHeight - 20);
    doc.text(`Page ${pageNum}`, pageWidth - 40, pageHeight - 20, { align: 'right' });
    doc.setTextColor(0);
  };

  for (const sectionName of sectionOrder) {
    const items = conceptsBySection[sectionName];
    if (!items) continue;

    const body: string[][] = items
      .filter((item) =>
        sorted.some((q) => q.metrics[item.code] !== undefined && q.metrics[item.code] !== null),
      )
      .map((item) => [
        item.label,
        ...sorted.map((q) => formatValue(q.metrics[item.code], item.format)),
      ]);

    if (body.length === 0) continue;

    // Check if we need a new page for section title + at least a few rows
    if (startY > pageHeight - 100) {
      addFooter(doc.getNumberOfPages());
      doc.addPage();
      startY = 40;
    }

    // Section title
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text(sectionName, 40, startY);
    doc.setTextColor(0);
    startY += 8;

    autoTable(doc, {
      startY,
      head: [['Line Item', ...quarterLabels]],
      body,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 51, 102],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'right',
      },
      bodyStyles: { fontSize: 7.5, cellPadding: 3 },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 180 },
        ...Object.fromEntries(quarterLabels.map((_, i) => [i + 1, { halign: 'right' }])),
      },
      alternateRowStyles: { fillColor: [240, 245, 250] },
      margin: { left: 40, right: 40, top: 40, bottom: 40 },
    });

    startY = (doc as any).lastAutoTable.finalY + 16;
  }

  // Add footers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i);
  }

  return doc.output('datauristring');
}
