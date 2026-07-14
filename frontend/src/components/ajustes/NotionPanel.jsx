import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useToast } from '../shared/Toast.jsx';

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
      const e = await api('/api/notion/estado');
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
      const r = await api('/api/notion/check', { method: 'POST' });
      setCheck({ ok: true, mensaje: r.mensaje });
    } catch (err) {
      setCheck({ ok: false, mensaje: err.message });
    }
    setProbando(false);
  };

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const r = await api('/api/notion/sync', { method: 'POST' });
      toast('Sincronizado con Notion ✓');
      mensajeBandeja(r).forEach((m, i) => setTimeout(() => toast(m), 900 + i * 2600));
    } catch (err) { toast(err.message, true); }
    setSincronizando(false);
    cargarEstado();
  };

  return (
    <div className="panel">
      <h3>Notion</h3>
      <p className="texto-suave">{estadoTexto}</p>
      {check && (
        <p className="texto-suave" style={{ color: check.ok ? 'var(--ingreso)' : 'var(--gasto)' }}>
          {check.ok ? '✓ ' : '✗ '}{check.mensaje}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="mini-btn" disabled={probando} onClick={probarConexion}
                title="Valida el token y el acceso a la página, sin crear nada">
          {probando ? 'Probando...' : 'Probar conexión'}
        </button>
        <button className="guardar" style={{ marginTop: 0 }} disabled={sincronizando} onClick={sincronizar}>
          {sincronizando ? 'Sincronizando...' : 'Sincronizar con Notion'}
        </button>
      </div>
    </div>
  );
}
