# Configurar WhatsApp Business Cloud API

El juego funciona completo en **modo simulado** sin nada de esto. Configurá la API real solo si querés que los mensajes lleguen automáticamente a los teléfonos.

> **Importante:** un número personal de WhatsApp NO puede enviar por API. La Cloud API usa un número propio de WhatsApp Business que Meta te asigna (el número de prueba sirve para testear con hasta 5 destinatarios registrados).

## Pasos

1. **Cuenta Meta for Developers**: https://developers.facebook.com → crear una app tipo "Business".
2. Agregar el producto **WhatsApp** a la app. Meta crea automáticamente:
   - un **número de prueba** (test number);
   - un token temporal de acceso.
3. En *WhatsApp → API Setup* copiá:
   - `WHATSAPP_ACCESS_TOKEN` — para producción generá un **token permanente** (System User en Business Settings con permiso `whatsapp_business_messaging`).
   - `WHATSAPP_PHONE_NUMBER_ID` — ID del número emisor.
   - `WHATSAPP_BUSINESS_ACCOUNT_ID` — ID de la cuenta de WhatsApp Business.
4. **Webhook** (estados de entrega):
   - URL: `https://TU-APP.vercel.app/api/webhooks/whatsapp`
   - Verify token: inventá un valor y ponelo en `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
   - Suscribirse al campo `messages`.
5. Cargar las variables en Vercel y redeployar.
6. En el panel admin → Configuración → "Modo de mensajes" → **WhatsApp Cloud API real**.

## Plantillas

Para **iniciar** una conversación (el jugador no te escribió en las últimas 24 h), Meta exige una **plantilla aprobada**:

1. En *WhatsApp Manager → Message templates* creá una plantilla en `es_AR`, por ejemplo con cuerpo:
   `⁠Mensaje confidencial de CELDA 25 para {{1}}. {{2}}`
2. Esperá la aprobación de Meta (minutos a horas).
3. Poné el nombre en `WHATSAPP_TEMPLATE_NAME`. Si está definida, el proveedor envía la plantilla; si está vacía, envía texto libre (solo funciona dentro de la ventana de 24 h).

**Alternativa simple para el evento:** pedirle a cada jugador que mande "hola" al número del juego ese día — eso abre la ventana de 24 h y permite texto libre sin plantillas.

## Números de destino

Cargar los teléfonos en el panel en formato argentino; se normalizan a E.164:
`+54 9 11 2233-4455` → `+5491122334455`.

Con el número de prueba de Meta, agregá cada teléfono destinatario a la lista de números permitidos (API Setup → "To").

## Fallback siempre disponible

Aunque falle la API, desde el panel de Mensajes podés:
- **Copiar** el texto de cualquier mensaje.
- **WhatsApp manual**: abre `wa.me` con el texto precargado para mandarlo desde tu teléfono.
- **Reenviar** cuando la API se recupere (queda registrado como reenvío).
