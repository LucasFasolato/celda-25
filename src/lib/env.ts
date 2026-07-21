/**
 * Acceso perezoso a variables de entorno: la app debe compilar sin credenciales
 * y fallar con un mensaje claro recién cuando una feature las necesita.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Ver .env.example.`);
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get appUrl() {
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  },
  get adminUsername() {
    return required("ADMIN_USERNAME");
  },
  get adminPassword() {
    return required("ADMIN_PASSWORD");
  },
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  whatsapp: {
    get accessToken() {
      return process.env.WHATSAPP_ACCESS_TOKEN ?? "";
    },
    get phoneNumberId() {
      return process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
    },
    get webhookVerifyToken() {
      return process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "";
    },
    get apiVersion() {
      return process.env.WHATSAPP_API_VERSION ?? "v21.0";
    },
    get templateName() {
      return process.env.WHATSAPP_TEMPLATE_NAME ?? "";
    },
    get isConfigured() {
      return Boolean(
        process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
      );
    },
  },
};
