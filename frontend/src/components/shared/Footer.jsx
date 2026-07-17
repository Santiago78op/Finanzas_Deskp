import Stack from '@mui/material/Stack';

// Footer con algo de peso visual propio (antes era una sola línea de texto
// gris, se sentía "roto"/inconcluso en páginas cortas) — marca + copyright,
// mismo wordmark que el sidebar.
export default function Footer() {
  const anio = new Date().getFullYear();
  return (
    <Stack
      component="footer"
      direction="row"
      sx={{ borderTop: '1px solid var(--borde)', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}
      className="py-5 px-6"
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
        <svg className="ico text-[var(--texto)]" style={{ width: 18, height: 18 }}><use href="#ico-billetera" /></svg>
        <span className="font-display" style={{ fontSize: 15, letterSpacing: '.02em' }}>Finanzas</span>
        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--suave)' }}>Q</span>
      </Stack>
      <span className="text-xs text-[var(--suave)]">© {anio} Julian Barrera · Todos los derechos reservados</span>
    </Stack>
  );
}
