import { env } from "@/lib/env";
import type {
  MessagingProvider,
  ProviderMessageStatus,
  SendMessageInput,
  SendMessageResult,
} from "./types";

/**
 * WhatsApp Business Cloud API.
 * Requiere WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID.
 * Si Meta exige plantilla aprobada para iniciar conversación, configurar
 * WHATSAPP_TEMPLATE_NAME (o pasar templateName por mensaje).
 */
export class WhatsAppCloudApiProvider implements MessagingProvider {
  readonly name = "whatsapp" as const;

  private baseUrl() {
    return `https://graph.facebook.com/${env.whatsapp.apiVersion}`;
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    if (!env.whatsapp.isConfigured) {
      return { ok: false, status: "failed", error: "WhatsApp Cloud API no configurada" };
    }
    const to = input.to.replace(/[^\d]/g, "");
    const templateName = input.templateName || env.whatsapp.templateName;

    const payload = templateName
      ? {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: templateName,
            language: { code: "es_AR" },
            components: input.templateParams?.length
              ? [
                  {
                    type: "body",
                    parameters: input.templateParams.map((text) => ({ type: "text", text })),
                  },
                ]
              : undefined,
          },
        }
      : {
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: input.body, preview_url: false },
        };

    try {
      const res = await fetch(`${this.baseUrl()}/${env.whatsapp.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.whatsapp.accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        messages?: { id: string }[];
        error?: { message?: string; code?: number };
      };
      if (!res.ok || !data.messages?.[0]?.id) {
        // Nunca registrar tokens: solo el mensaje de error de la API.
        return {
          ok: false,
          status: "failed",
          error: data.error?.message ?? `HTTP ${res.status}`,
        };
      }
      return { ok: true, status: "sent", externalMessageId: data.messages[0].id };
    } catch (err) {
      return {
        ok: false,
        status: "failed",
        error: err instanceof Error ? err.message : "Error de red",
      };
    }
  }

  async getMessageStatus(): Promise<ProviderMessageStatus> {
    // La Cloud API no expone consulta directa de estado: llega por webhook.
    return "unknown";
  }
}
