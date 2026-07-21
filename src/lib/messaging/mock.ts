import type {
  MessagingProvider,
  ProviderMessageStatus,
  SendMessageInput,
  SendMessageResult,
} from "./types";

/**
 * Proveedor simulado: funciona sin credenciales de Meta. El mensaje queda
 * registrado como "simulated" y el panel ofrece copiarlo o abrir wa.me.
 */
export class MockMessagingProvider implements MessagingProvider {
  readonly name = "mock" as const;

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    if (!input.to || !input.to.startsWith("+")) {
      return { ok: false, status: "failed", error: "Teléfono inválido (se espera E.164)" };
    }
    return {
      ok: true,
      status: "simulated",
      externalMessageId: `mock-${crypto.randomUUID()}`,
    };
  }

  async getMessageStatus(): Promise<ProviderMessageStatus> {
    return "unknown";
  }
}

/** Link wa.me con texto precargado para envío manual desde el panel. */
export function waMeLink(phoneE164: string, body: string): string {
  const phone = phoneE164.replace(/[^\d]/g, "");
  return `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
}
