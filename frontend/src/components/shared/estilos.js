// Estilos (sx/style) compartidos por 3+ vistas — Dashboard, Cuentas/Tarjetas
// (vía AccountCard/CreditCard), Registro. No mezclar con clases de Tailwind:
// esto es solo para objetos que hoy se repiten copy-pasteados.

// Toda cifra monetaria o porcentual: monoespaciada + ancho fijo de dígito.
// Sin esto, una columna de montos no alinea y los tickers animados
// (useTickerNumber) tiemblan mientras cuentan.
export const tabularNums = {
  fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', monospace",
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '-.01em',
};

export function puntoAcento(color, size = 9) {
  return { width: size, height: size, borderRadius: 999, flex: 'none', background: color };
}

export function bordeFilaLista(esUltima) {
  return { borderBottom: esUltima ? 'none' : '1px solid var(--borde)' };
}
