import type { MessagingMode } from "@/lib/types";
import { MockMessagingProvider } from "./mock";
import { WhatsAppCloudApiProvider } from "./whatsapp";
import type { MessagingProvider } from "./types";

export function getProvider(mode: MessagingMode): MessagingProvider {
  return mode === "whatsapp" ? new WhatsAppCloudApiProvider() : new MockMessagingProvider();
}

export { MockMessagingProvider, WhatsAppCloudApiProvider };
export { waMeLink } from "./mock";
export type { MessagingProvider, SendMessageInput, SendMessageResult } from "./types";
