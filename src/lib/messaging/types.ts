export interface SendMessageInput {
  to: string; // E.164, ej: +5491122334455
  body: string;
  templateName?: string;
  templateParams?: string[];
}

export interface SendMessageResult {
  ok: boolean;
  status: "sent" | "simulated" | "failed";
  externalMessageId?: string;
  error?: string;
}

export type ProviderMessageStatus = "sent" | "delivered" | "read" | "failed" | "unknown";

export interface MessagingProvider {
  readonly name: "mock" | "whatsapp";
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
  getMessageStatus(messageId: string): Promise<ProviderMessageStatus>;
}
