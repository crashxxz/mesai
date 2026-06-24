import type { PixPaymentStatus, PixProvider, UUID } from "@/lib/types";

export type { PixPaymentStatus, PixProvider };

export interface PixCharge {
  paymentId: UUID;
  provider: PixProvider;
  status: PixPaymentStatus;
  amount: number;
  copyPaste?: string;
  externalPaymentId?: string;
  txid?: string;
  expiresAt?: string;
  message?: string;
}

export const pixProviderLabel: Record<PixProvider, string> = {
  manual: "Manual",
  openpix: "OpenPix",
  mercado_pago: "Mercado Pago"
};

export const pixStatusLabel: Record<PixPaymentStatus, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  expired: "Expirado",
  cancelled: "Cancelado",
  error: "Erro"
};
