// Estilos (sx/style) compartidos por 3+ vistas — Dashboard, Cuentas/Tarjetas
// (vía AccountCard/CreditCard), Registro. No mezclar con clases de Tailwind:
// esto es solo para objetos que hoy se repiten copy-pasteados.

export const tabularNums = { fontVariantNumeric: 'tabular-nums' };

export function puntoAcento(color, size = 9) {
  return { width: size, height: size, borderRadius: 999, flex: 'none', background: color };
}

export function bordeFilaLista(esUltima) {
  return { borderBottom: esUltima ? 'none' : '1px solid var(--borde)' };
}
