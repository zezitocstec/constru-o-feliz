import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';

interface ReceiptItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
}

interface ReceiptData {
  saleId: string;
  items: ReceiptItem[];
  subtotal: number;
  totalDiscount: number;
  total: number;
  paymentMethod: string;
  customerName?: string;
  amountPaid?: number;
  change?: number;
  createdAt: Date;
}

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_debito: 'Cartão de Débito',
  cartao_credito: 'Cartão de Crédito',
  transferencia: 'Transferência',
  misto: 'Pagamento Misto',
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export async function generateReceiptPDF(data: ReceiptData): Promise<Blob> {
  let COMPANY = {
    name: 'itsega4PDV',
    cnpj: '00.000.000/0001-00',
    address: 'Endereço da Empresa, 123 - Cidade/UF',
    phone: '(00) 0000-0000',
    logo: null as string | null
  };

  try {
    const { data: settings } = await supabase.from('pdv_settings').select('*').maybeSingle();
    if (settings) {
      COMPANY = {
        name: settings.company_name || COMPANY.name,
        cnpj: settings.company_cnpj || COMPANY.cnpj,
        address: settings.company_address || COMPANY.address,
        phone: settings.company_phone || COMPANY.phone,
        logo: settings.company_logo || null
      };
    }
  } catch (err) {
    console.error("Error fetching pdv_settings", err);
  }

  // 80mm thermal receipt width ≈ 226 points
  const pageWidth = 226;
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  const doc = new jsPDF({ unit: 'pt', format: [pageWidth, 800] });

  let y = margin;
  const lineHeight = 12;
  const smallLine = 10;

  if (COMPANY.logo) {
    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = COMPANY.logo;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      const imgWidth = 80;
      const imgHeight = (img.height * imgWidth) / img.width;
      doc.addImage(img, 'PNG', (pageWidth - imgWidth) / 2, y, imgWidth, imgHeight);
      y += imgHeight + 10;
    } catch (e) {
      console.error("Could not load logo for receipt", e);
    }
  }

  const center = (text: string, size: number, bold = false) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(text, pageWidth / 2, y, { align: 'center' });
    y += size === 6 ? smallLine : lineHeight;
  };

  const leftRight = (left: string, right: string, size = 7, bold = false) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(left, margin, y);
    doc.text(right, pageWidth - margin, y, { align: 'right' });
    y += smallLine;
  };

  const separator = () => {
    doc.setLineDashPattern([2, 2], 0);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  // === Header ===
  center(COMPANY.name, 12, true);
  center(COMPANY.cnpj, 7);
  center(COMPANY.address, 6);
  center(COMPANY.phone, 6);
  y += 4;
  separator();

  // === Sale info ===
  const dateStr = data.createdAt.toLocaleDateString('pt-BR');
  const timeStr = data.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  center('CUPOM NÃO FISCAL', 8, true);
  leftRight(`Venda: ${data.saleId.slice(0, 8).toUpperCase()}`, `${dateStr} ${timeStr}`, 6);
  if (data.customerName) {
    doc.setFontSize(6);
    doc.text(`Cliente: ${data.customerName}`, margin, y);
    y += smallLine;
  }
  separator();

  // === Items header ===
  leftRight('ITEM', 'SUBTOTAL', 6, true);
  y += 2;

  // === Items ===
  for (const item of data.items) {
    // Product name
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    const nameLines = doc.splitTextToSize(item.product_name, contentWidth - 50);
    for (const line of nameLines) {
      doc.text(line, margin, y);
      y += smallLine;
    }

    // Qty x Price = Subtotal
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    let detail = `  ${item.quantity} x ${formatCurrency(item.unit_price)}`;
    if (item.discount > 0) {
      detail += ` (-${item.discount}%)`;
    }
    doc.text(detail, margin, y);
    doc.text(formatCurrency(item.subtotal), pageWidth - margin, y, { align: 'right' });
    y += smallLine + 2;
  }

  separator();

  // === Totals ===
  leftRight('Subtotal:', formatCurrency(data.subtotal), 7);
  if (data.totalDiscount > 0) {
    leftRight('Desconto:', `-${formatCurrency(data.totalDiscount)}`, 7);
  }
  y += 2;
  leftRight('TOTAL:', formatCurrency(data.total), 10, true);
  y += 2;
  separator();

  // === Payment ===
  leftRight('Pagamento:', PAYMENT_LABELS[data.paymentMethod] || data.paymentMethod, 7);
  if (data.amountPaid && data.amountPaid > 0) {
    leftRight('Valor Recebido:', formatCurrency(data.amountPaid), 7);
    leftRight('Troco:', formatCurrency(data.change || 0), 7);
  }
  separator();

  // === QR Code ===
  y += 4;
  center('Escaneie para detalhes da venda', 6);
  try {
    const qrDataUrl = await QRCode.toDataURL(
      `sale:${data.saleId}|total:${data.total}|date:${data.createdAt.toISOString()}`,
      { width: 100, margin: 1 }
    );
    const qrSize = 80;
    doc.addImage(qrDataUrl, 'PNG', (pageWidth - qrSize) / 2, y, qrSize, qrSize);
    y += qrSize + 6;
  } catch {
    // QR generation failed, skip
    y += 4;
  }

  separator();
  center('Obrigado pela preferência!', 7, true);
  center(`${COMPANY.name} — ${dateStr}`, 6);
  y += 6;

  // Trim page height to content
  const finalHeight = y + margin;
  const trimmedDoc = new jsPDF({ unit: 'pt', format: [pageWidth, finalHeight] });

  // Re-render on trimmed page
  const pages = doc.output('arraybuffer');
  // Simpler approach: just return with original doc
  // The extra whitespace at the bottom is acceptable for thermal printing

  return doc.output('blob');
}

export function downloadReceiptPDF(blob: Blob, saleId: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cupom-${saleId.slice(0, 8)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
