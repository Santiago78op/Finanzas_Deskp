import { useCallback, useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/AddOutlined';
import PrestamoCard from './PrestamoCard.jsx';
import VisacuotaCard from './VisacuotaCard.jsx';
import FormPrestamo from './FormPrestamo.jsx';
import FormVisacuota from './FormVisacuota.jsx';
import FormPagoDeuda from './FormPagoDeuda.jsx';
import { getPrestamos } from '../../api/prestamos.js';
import { getVisacuotas } from '../../api/visacuotas.js';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { fmtQ } from '../../utils.js';

// "Préstamos" con vista propia: registra deuda que hoy no vivía en ningún
// lado de la app (préstamos de banco/financiera + compras diferidas a Visa
// Cuotas), separada de Tarjetas porque son productos distintos. El botón
// "Registrar pago" es simple, sin el mecanismo de confirmación mensual de
// Ajustes > Recurrentes — decisión tomada con el usuario.
export default function PrestamosView() {
  const { tarjetas } = useCatalog();
  const [prestamos, setPrestamos] = useState([]);
  const [visacuotas, setVisacuotas] = useState([]);
  const [editandoPrestamo, setEditandoPrestamo] = useState(null);
  const [modalPrestamo, setModalPrestamo] = useState(false);
  const [editandoVisacuota, setEditandoVisacuota] = useState(null);
  const [modalVisacuota, setModalVisacuota] = useState(false);
  const [pagando, setPagando] = useState(null); // { tipo: 'prestamo'|'visacuota', entidad }

  const cargar = useCallback(async () => {
    const [p, v] = await Promise.all([getPrestamos(true), getVisacuotas(true)]);
    setPrestamos(p); setVisacuotas(v);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const deudaTotal = prestamos.filter(p => p.activo).reduce((s, p) => s + p.saldo, 0)
    + visacuotas.filter(v => v.activo).reduce((s, v) => s + v.saldo, 0);
  const pagoMensualTotal = prestamos.filter(p => p.activo).reduce((s, p) => s + p.cuota_mensual, 0)
    + visacuotas.filter(v => v.activo && v.cuotas_restantes > 0).reduce((s, v) => s + v.cuota_mensual, 0);

  const nombreTarjeta = (id) => tarjetas.find(t => t.id === id)?.nombre;

  const abrirNuevoPrestamo = () => { setEditandoPrestamo(null); setModalPrestamo(true); };
  const abrirEditarPrestamo = (p) => { setEditandoPrestamo(p); setModalPrestamo(true); };
  const abrirNuevaVisacuota = () => { setEditandoVisacuota(null); setModalVisacuota(true); };
  const abrirEditarVisacuota = (v) => { setEditandoVisacuota(v); setModalVisacuota(true); };

  return (
    <div id="vista-prestamos" className="vista flex flex-col">
      <Card component="section" aria-label="Qué son estos productos" className="p-5 flex flex-col gap-3">
        <div>
          <Typography variant="subtitle2" fontWeight={700}>¿Qué es un préstamo?</Typography>
          <Typography variant="body2" className="text-[var(--suave)]">
            Dinero que te prestó un banco u otra institución, que pagás en cuotas fijas
            mensuales — generalmente con interés — hasta saldarlo.
          </Typography>
        </div>
        <div>
          <Typography variant="subtitle2" fontWeight={700}>¿Qué es Visa Cuotas?</Typography>
          <Typography variant="body2" className="text-[var(--suave)]">
            Una compra que hiciste con tarjeta de crédito y difiriste a cuotas fijas. No es
            parte del saldo revolvente de la tarjeta: es un plan aparte, con número de
            cuotas y monto fijo cada mes.
          </Typography>
        </div>
      </Card>

      <Card component="section" aria-label="Resumen de deuda" className="p-5 flex items-center justify-between gap-5 flex-wrap" sx={{ mt: 3 }}>
        <div>
          <Typography variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">
            Deuda total (préstamos + cuotas)
          </Typography>
          <Typography variant="h4" fontWeight={700} letterSpacing="-.02em">{fmtQ(deudaTotal)}</Typography>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Typography variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">
            Pago mensual comprometido
          </Typography>
          <Typography variant="h5" fontWeight={700}>{fmtQ(pagoMensualTotal)}</Typography>
        </div>
      </Card>

      <Divider sx={{ mt: 5, mb: 2 }} />
      <Typography variant="h6" sx={{ mb: 2 }}>Préstamos</Typography>
      <div className="prestamos-grid">
        {prestamos.map(p => (
          <PrestamoCard key={p.id} prestamo={p}
            onEditar={() => abrirEditarPrestamo(p)}
            onPagar={() => setPagando({ tipo: 'prestamo', entidad: p })} />
        ))}
        <button type="button" onClick={abrirNuevoPrestamo} className="tile-agregar">
          <AddIcon fontSize="small" /> Agregar préstamo
        </button>
      </div>

      <Divider sx={{ mt: 5, mb: 2 }} />
      <Typography variant="h6" sx={{ mb: 2 }}>Visa Cuotas</Typography>
      <div className="prestamos-grid">
        {visacuotas.map(v => (
          <VisacuotaCard key={v.id} visacuota={v} tarjetaNombre={nombreTarjeta(v.tarjeta_id)}
            onEditar={() => abrirEditarVisacuota(v)}
            onPagar={() => setPagando({ tipo: 'visacuota', entidad: v })} />
        ))}
        <button type="button" onClick={abrirNuevaVisacuota} className="tile-agregar">
          <AddIcon fontSize="small" /> Agregar cuota
        </button>
      </div>

      {modalPrestamo && (
        <FormPrestamo editando={editandoPrestamo}
          onGuardado={() => { setModalPrestamo(false); cargar(); }}
          onCerrar={() => setModalPrestamo(false)} />
      )}
      {modalVisacuota && (
        <FormVisacuota editando={editandoVisacuota}
          onGuardado={() => { setModalVisacuota(false); cargar(); }}
          onCerrar={() => setModalVisacuota(false)} />
      )}
      {pagando && (
        <FormPagoDeuda tipo={pagando.tipo} entidad={pagando.entidad}
          onGuardado={() => { setPagando(null); cargar(); }}
          onCerrar={() => setPagando(null)} />
      )}
    </div>
  );
}
