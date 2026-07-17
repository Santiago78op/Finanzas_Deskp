import { useCallback, useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { getEstadoNotion, checkNotion, syncNotion } from '../../api/notion.js';
import { useToast } from '../shared/Toast.jsx';
import { filaControles } from './ajustes.styles.js';

function mensajeBandeja(r) {
  const partes = [];
  if (r.bandeja_importados) {
    const desc = r.bandeja_detalle.slice(0, 3).map(g => `${g.descripcion} (Q ${Number(g.monto).toFixed(2)})`).join(', ');
    partes.push(`${r.bandeja_importados} gasto(s) importado(s) de Notion: ${desc}` + (r.bandeja_importados > 3 ? '…' : ''));
  }
  if (r.bandeja_rechazados && r.bandeja_rechazados.length) {
    partes.push(`${r.bandeja_rechazados.length} fila(s) en la Bandeja tienen datos inválidos y siguen ahí para que las corrijas (revisá categoría/método/monto).`);
  }
  return partes;
}

export default function NotionPanel() {
  const toast = useToast();
  const [estadoTexto, setEstadoTexto] = useState('');
  const [check, setCheck] = useState(null); // { ok, mensaje }
  const [probando, setProbando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);

  const cargarEstado = useCallback(async () => {
    try {
      const e = await getEstadoNotion();
      let texto;
      if (!e.configurado) texto = 'Notion no está configurado. Copiá .env.example como .env y seguí el README.';
      else {
        texto = e.ultima_sync ? `Última sincronización: ${e.ultima_sync}` : 'Configurado, aún sin sincronizar.';
        if (e.sync_pendiente) texto += ' · Hay cambios pendientes de subir.';
      }
      setEstadoTexto(texto);
    } catch { /* sin conexión con la API */ }
  }, []);

  useEffect(() => { cargarEstado(); }, [cargarEstado]);

  const probarConexion = async () => {
    setProbando(true);
    setCheck(null);
    try {
      const r = await checkNotion();
      setCheck({ ok: true, mensaje: r.mensaje });
    } catch (err) {
      setCheck({ ok: false, mensaje: err.message });
    }
    setProbando(false);
  };

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const r = await syncNotion();
      toast('Sincronizado con Notion ✓');
      mensajeBandeja(r).forEach((m, i) => setTimeout(() => toast(m), 900 + i * 2600));
    } catch (err) { toast(err.message, true); }
    setSincronizando(false);
    cargarEstado();
  };

  return (
    <Card component="section" aria-labelledby="sec-notion" className="p-5 flex flex-col gap-3">
      <Typography id="sec-notion" variant="h6">Notion</Typography>
      <Typography variant="body2" className="text-[var(--suave)]">{estadoTexto}</Typography>
      {check && (
        <Typography variant="body2" sx={{ color: check.ok ? 'success.main' : 'error.main' }}>
          {check.ok ? '✓ ' : '✗ '}{check.mensaje}
        </Typography>
      )}
      <Stack direction="row" sx={filaControles}>
        <Button
          variant="outlined"
          disabled={probando}
          onClick={probarConexion}
          title="Valida el token y el acceso a la página, sin crear nada"
        >
          {probando ? 'Probando...' : 'Probar conexión'}
        </Button>
        <Button variant="contained" disabled={sincronizando} onClick={sincronizar}>
          {sincronizando ? 'Sincronizando...' : 'Sincronizar con Notion'}
        </Button>
      </Stack>
    </Card>
  );
}
