import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

interface QuoteItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface QuoteData {
  quoteId: string;
  items: QuoteItem[];
  subtotal: number;
  discountPercent: number;
  discountValue: number;
  surchargePercent: number;
  surchargeValue: number;
  total: number;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  validUntil?: Date;
  createdAt: Date;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export async function generateQuotePDF(data: QuoteData): Promise<Blob> {
  let COMPANY = {
    name: 'itsega4PDV',
    cnpj: '00.000.000/0001-00',
    address: 'Endereço da Empresa, 123 - Cidade/UF',
    phone: '(00) 0000-0000',
    logo: null as string | null,
  };

  try {
    const { data: settings } = await supabase.from('pdv_settings').select('*').maybeSingle();
    if (settings) {
      COMPANY = {
        name: settings.company_name || COMPANY.name,
        cnpj: settings.company_cnpj || COMPANY.cnpj,
        address: settings.company_address || COMPANY.address,
        phone: settings.company_phone || COMPANY.phone,
        logo: settings.company_logo || null,
      };
    }
  } catch (err) {
    console.error('Error fetching pdv_settings', err);
  }

  const pageWidth = 595; // A4
  const pageHeight = 842;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  let y = margin;

  const center = (text: string, size: number, bold = false) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(text, pageWidth / 2, y, { align: 'center' });
    y += size + 4;
  };

  const leftRight = (left: string, right: string, size = 10, bold = false) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(left, margin, y);
    doc.text(right, pageWidth - margin, y, { align: 'right' });
    y += size + 4;
  };

  const separator = () => {
    doc.setDrawColor(200);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
  };

  // Header
  if (COMPANY.logo) {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = COMPANY.logo;
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
      const imgW = 100;
      const imgH = (img.height * imgW) / img.width;
      doc.addImage(img, 'PNG', margin, y, imgW, imgH);
      y += imgH + 10;
    } catch { /* skip */ }
  }

  center(COMPANY.name, 16, true);
  center(COMPANY.cnpj, 9);
  center(`${COMPANY.address} | ${COMPANY.phone}`, 8);
  y += 8;
  separator();

  // Title
  center('ORÇAMENTO', 18, true);
  y += 4;

  const dateStr = data.createdAt.toLocaleDateString('pt-BR');
  leftRight(`Nº: ${data.quoteId.slice(0, 8).toUpperCase()}`, `Data: ${dateStr}`);

  if (data.customerName) {
    doc.setFontSize(10);
    doc.text(`Cliente: ${data.customerName}`, margin, y);
    y += 14;
  }
  if (data.customerPhone) {
    doc.setFontSize(10);
    doc.text(`Telefone: ${data.customerPhone}`, margin, y);
    y += 14;
  }
  if (data.validUntil) {
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(`Válido até: ${data.validUntil.toLocaleDateString('pt-BR')}`, margin, y);
    doc.setTextColor(0);
    y += 14;
  }
  y += 4;
  separator();

  // Table header
  const colX = [margin, margin + 30, margin + 280, margin + 350, margin + 440];
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('#', colX[0], y);
  doc.text('Produto', colX[1], y);
  doc.text('Qtd', colX[2], y);
  doc.text('Preço Un.', colX[3], y);
  doc.text('Subtotal', colX[4], y);
  y += 14;
  separator();

  // Items
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    if (y > pageHeight - 120) {
      doc.addPage();
      y = margin;
    }
    doc.text(String(i + 1), colX[0], y);
    const nameLines = doc.splitTextToSize(item.product_name, 240);
    doc.text(nameLines[0], colX[1], y);
    doc.text(String(item.quantity), colX[2], y);
    doc.text(formatCurrency(item.unit_price), colX[3], y);
    doc.text(formatCurrency(item.subtotal), colX[4], y);
    y += nameLines.length > 1 ? 14 * nameLines.length : 14;
  }

  y += 4;
  separator();

  // Totals
  leftRight('Subtotal:', formatCurrency(data.subtotal));
  if (data.discountValue > 0) {
    leftRight(`Desconto (${data.discountPercent}%):`, `- ${formatCurrency(data.discountValue)}`, 10);
  }
  if (data.surchargeValue > 0) {
    leftRight(`Acréscimo (${data.surchargePercent}%):`, `+ ${formatCurrency(data.surchargeValue)}`, 10);
  }
  y += 4;
  leftRight('TOTAL:', formatCurrency(data.total), 14, true);
  y += 4;
  separator();

  // Notes
  if (data.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Observações:', margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(data.notes, contentWidth);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 12 + 8;
  }

  // Footer
  y += 16;
  doc.setFontSize(8);
  doc.setTextColor(130);
  doc.text('Este orçamento não representa compromisso de venda.', pageWidth / 2, y, { align: 'center' });
  y += 12;
  doc.text(`${COMPANY.name} — ${dateStr}`, pageWidth / 2, y, { align: 'center' });

  return doc.output('blob');
}

export function downloadQuotePDF(blob: Blob, quoteId: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orcamento-${quoteId.slice(0, 8)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
