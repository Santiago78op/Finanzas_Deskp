import { useCallback, useEffect, useRef, useState } from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import FormTarjeta from './FormTarjeta.jsx';
import CreditCard from '../shared/CreditCard.jsx';
import { api } from '../../api.js';
import { fmtQ } from '../../utils.js';

// Solo tarjetas — "Mis cuentas" se fue a su propia vista (ver
// components/cuentas/CuentasView.jsx). Grid fijo de 2 columnas (no
// carrusel: página de gestión completa) que pide FinanzasQ.dc.html.
export default function TarjetasView() {
  const [tarjetas, setTarjetas] = useState([]);
  const [editando, setEditando] = useState(null);
  const formRef = useRef(null);

  const cargar = useCallback(async () => {
    setTarjetas(await api('/api/tarjetas?incluir_inactivas=true'));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const activas = tarjetas.filter(t => t.activa);
  const deudaTotal = activas.reduce((s, t) => s + t.saldo, 0);
  const proximoCorte = activas.length ? Math.min(...activas.map(t => t.dias_corte)) : null;

  return (
    <div id="vista-tarjetas" className="vista flex flex-col gap-4">
      <Card component="section" aria-label="Deuda total en tarjetas" className="p-4 flex items-center justify-between gap-5 flex-wrap">
        <div>
          <Typography variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">Deuda total en tarjetas</Typography>
          <Typography variant="h4" fontWeight={700} letterSpacing="-.02em" className="text-[var(--pago)]">{fmtQ(deudaTotal)}</Typography>
        </div>
        <Typography variant="body2" className="text-[var(--suave)] max-w-xs">
          Repartida en {tarjetas.length} tarjeta{tarjetas.length === 1 ? '' : 's'}.
          {proximoCorte !== null && ` La próxima corta en ${proximoCorte} día${proximoCorte === 1 ? '' : 's'}.`}
        </Typography>
      </Card>

      <div ref={formRef}>
        <FormTarjeta
          editando={editando}
          onGuardado={() => { setEditando(null); cargar(); }}
          onCancelar={() => setEditando(null)}
        />
      </div>

      <div className="tarjetas-grid">
        {tarjetas.map(t => (
          <CreditCard key={t.id} tarjeta={t} onEditar={() => { setEditando(t); formRef.current?.scrollIntoView({ behavior: 'smooth' }); }} />
        ))}
        <button
          type="button"
          onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="tile-agregar"
        >
          <AddIcon fontSize="small" /> Agregar tarjeta
        </button>
      </div>
    </div>
  );
}
