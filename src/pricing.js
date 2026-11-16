// Descuentos por medio de pago (se aplican sobre el precio vigente:
// precio oferta si el producto tiene descuento, si no precio lista)
export const DESC_EFECTIVO = 0.25;
export const DESC_TRANSFERENCIA = 0.20;

// "$ 99.990,00" | 99990 → 99990
export function parseARS(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const cleaned = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// 99990 → "$ 99.990"
export function formatARS(amount) {
  if (amount == null) return null;
  return "$ " + Math.round(amount).toLocaleString("es-AR");
}

export function getPrices(product) {
  const lista = parseARS(product.Precio);
  const oferta = product.Descuento === "SI" ? parseARS(product.Pdesceunto) : null;
  const hasOferta = oferta != null && lista != null && oferta < lista;
  const base = hasOferta ? oferta : lista;

  return {
    hasOferta,
    lista: formatARS(lista),
    oferta: hasOferta ? formatARS(oferta) : null,
    porcentajeOferta: hasOferta ? `${Math.round((1 - oferta / lista) * 100)}%` : null,
    efectivo: base != null ? formatARS(base * (1 - DESC_EFECTIVO)) : null,
    transferencia: base != null ? formatARS(base * (1 - DESC_TRANSFERENCIA)) : null,
  };
}

export const pctLabel = (d) => `${Math.round(d * 100)}%`;
