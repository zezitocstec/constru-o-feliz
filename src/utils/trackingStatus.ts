// Utilitário central para mapear status de rastreio do site.
// Mantém a sequência oficial e trata valores desconhecidos com segurança.

import {
  Clock,
  CheckCircle,
  Package,
  Truck,
  XCircle,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

export type TrackingStep = {
  key: string;
  text: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bg: string;
};

// Sequência oficial do fluxo de pedido do site
export const TRACKING_FLOW: TrackingStep[] = [
  {
    key: "pending",
    text: "Pendente",
    description: "Aguardando confirmação no caixa.",
    icon: Clock,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  {
    key: "confirmed",
    text: "Confirmado",
    description: "Pagamento confirmado. Em breve seu pedido será preparado.",
    icon: CheckCircle,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    key: "leaving_warehouse",
    text: "Saindo do Depósito",
    description: "Seu pedido está sendo preparado para envio.",
    icon: Package,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
  {
    key: "on_the_way",
    text: "A Caminho",
    description: "O entregador já está a caminho do seu endereço.",
    icon: Truck,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    key: "delivered",
    text: "Recebido",
    description: "O pedido foi entregue com sucesso!",
    icon: CheckCircle,
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
];

const CANCELLED_STEP: TrackingStep = {
  key: "cancelled",
  text: "Cancelado",
  description: "Seu pedido foi cancelado.",
  icon: XCircle,
  color: "text-destructive",
  bg: "bg-destructive/10",
};

const UNKNOWN_STEP: TrackingStep = {
  key: "unknown",
  text: "Status indisponível",
  description:
    "Não foi possível identificar o status atual. Entre em contato com a loja para mais detalhes.",
  icon: HelpCircle,
  color: "text-muted-foreground",
  bg: "bg-muted",
};

/**
 * Resolve o status visual do pedido a partir de status + tracking_status.
 * Sempre retorna um TrackingStep válido (nunca quebra a UI).
 */
export function resolveTrackingStep(
  status?: string | null,
  trackingStatus?: string | null
): TrackingStep {
  const s = (status || "").toLowerCase().trim();
  const t = (trackingStatus || "").toLowerCase().trim();

  if (s === "cancelled" || t === "cancelled") return CANCELLED_STEP;

  // Tenta encontrar pelo tracking_status (prioritário) ou pelo status
  const match =
    TRACKING_FLOW.find((step) => step.key === t) ||
    TRACKING_FLOW.find((step) => step.key === s);

  if (match) return match;

  // Mapeamentos comuns para status do PDV/admin
  if (s === "completed") {
    return TRACKING_FLOW.find((x) => x.key === "confirmed") || UNKNOWN_STEP;
  }

  return UNKNOWN_STEP;
}

/** Índice na linha do tempo (para UI de progresso). -1 para desconhecidos/cancelados. */
export function getStepIndex(step: TrackingStep): number {
  return TRACKING_FLOW.findIndex((s) => s.key === step.key);
}
