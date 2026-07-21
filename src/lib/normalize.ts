/**
 * Normalización canónica de códigos: trim, colapso de espacios internos,
 * mayúsculas y eliminación de tildes. La comparación es exacta sobre la forma
 * normalizada: no se aceptan respuestas "parecidas".
 */
export function normalizeCode(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/** Normaliza un teléfono a formato E.164 sin espacios (+549...). */
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("54")) return `+${cleaned}`;
  return cleaned ? `+54${cleaned}` : "";
}
