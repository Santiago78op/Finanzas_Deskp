// Estilos de campo compartidos por FormGasto/FormPago/FormIngreso — mismo
// look que pide FinanzasQ.dc.html (Claude Design): label mayúscula chica
// arriba, caja panel2 con borde, sin el chrome de label flotante de MUI
// TextField (por eso son <input>/<select> nativos, no MUI aquí).
export const campoLabel = {
  fontSize: 12, fontWeight: 600, color: 'var(--suave)',
  textTransform: 'uppercase', letterSpacing: '.04em',
};

export const campoBase = {
  width: '100%', padding: '13px 14px', borderRadius: 12,
  border: '1px solid var(--borde)', background: 'var(--panel2)',
  color: 'var(--texto)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
  outline: 'none', boxSizing: 'border-box',
};

export const tipoBtnEstilo = (activo, colorVar) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
  flex: 1, padding: '11px 8px', borderRadius: 999, cursor: 'pointer',
  fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5, lineHeight: 1,
  border: activo ? '1px solid transparent' : '1px solid var(--borde)',
  background: activo ? colorVar : 'var(--panel2)',
  color: activo ? '#fff' : 'var(--suave)',
});
