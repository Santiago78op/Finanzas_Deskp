import { useCallback, useEffect, useRef, useState } from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import FormTarjeta from './FormTarjeta.jsx';
import CreditCard from '../shared/CreditCard.jsx';
import { getTarjetas } from '../../api/tarjetas.js';
import { fmtQ } from '../../utils.js';

// Solo tarjetas — "Mis cuentas" se fue a su propia vista (ver
// components/cuentas/CuentasView.jsx). El form de alta/edición está oculto
// por default (igual que en Cuentas) y aparece al tocar "Agregar tarjeta" o
// "Editar" en una tarjeta.
export default function TarjetasView() {
  const [tarjetas, setTarjetas] = useState([]);
  const [editando, setEditando] = useState(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const formRef = useRef(null);

  const cargar = useCallback(async () => {
    setTarjetas(await getTarjetas(true));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const activas = tarjetas.filter(t => t.activa);
  const deudaTotal = activas.reduce((s, t) => s + t.saldo, 0);
  const proximoCorte = activas.length ? Math.min(...activas.map(t => t.dias_corte)) : null;

  const abrirNueva = () => { setEditando(null); setFormAbierto(true); };
  const abrirEditar = (t) => {
    setEditando(t); setFormAbierto(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }));
  };
  const cerrarForm = () => { setEditando(null); setFormAbierto(false); };

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

      {formAbierto && (
        <div ref={formRef}>
          <FormTarjeta
            editando={editando}
            onGuardado={() => { cerrarForm(); cargar(); }}
            onCancelar={cerrarForm}
          />
        </div>
      )}

      <div className="tarjetas-grid">
        {tarjetas.map(t => (
          <CreditCard key={t.id} tarjeta={t} onEditar={() => abrirEditar(t)} />
        ))}
        <button type="button" onClick={abrirNueva} className="tile-agregar">
          <AddIcon fontSize="small" /> Agregar tarjeta
        </button>
      </div>
    </div>
  );
}
