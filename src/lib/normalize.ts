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

/**
 * Normaliza un teléfono a E.164 de celular argentino (+54 9 ...).
 * Reglas:
 *  - Con `+` explícito se respeta tal cual (el usuario fue explícito).
 *  - `00` inicial = prefijo internacional → `+`.
 *  - `0` inicial (prefijo nacional) y `15` de celular viejo se descartan.
 *  - A un número nacional argentino se le antepone `+54 9` (el `9` es el
 *    indicador de móvil que WhatsApp exige); si ya trae `54`/`9` no se duplica.
 */
export function normalizePhone(raw: string): string {
  let s = raw.replace(/[^\d+]/g, "");
  if (!s) return "";
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (s.startsWith("+")) return s;
  if (s.startsWith("0")) s = s.slice(1);
  if (s.startsWith("54")) {
    const rest = s.slice(2);
    return `+54${rest.startsWith("9") ? rest : `9${rest}`}`;
  }
  if (s.startsWith("9")) return `+54${s}`;
  return `+549${s}`;
}
