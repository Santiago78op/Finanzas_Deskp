import { useCallback, useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import FormTarjeta from './FormTarjeta.jsx';
import CreditCard from '../shared/CreditCard.jsx';
import { getTarjetas } from '../../api/tarjetas.js';
import { fmtQ } from '../../utils.js';

// Solo tarjetas — "Mis cuentas" se fue a su propia vista (ver
// components/cuentas/CuentasView.jsx). Alta/edición vía modal (no panel
// embebido), igual que CuentasView.jsx.
export default function TarjetasView() {
  const [tarjetas, setTarjetas] = useState([]);
  const [editando, setEditando] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  const cargar = useCallback(async () => {
    setTarjetas(await getTarjetas(true));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const activas = tarjetas.filter(t => t.activa);
  const deudaTotal = activas.reduce((s, t) => s + t.saldo, 0);
  const proximoCorte = activas.length ? Math.min(...activas.map(t => t.dias_corte)) : null;

  const abrirNueva = () => { setEditando(null); setModalAbierto(true); };
  const abrirEditar = (t) => { setEditando(t); setModalAbierto(true); };
  const cerrarModal = () => { setEditando(null); setModalAbierto(false); };

  return (
    <div id="vista-tarjetas" className="vista flex flex-col">
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

      <Divider sx={{ mt: 5, mb: 3 }} />

      <div className="tarjetas-grid">
        {tarjetas.map(t => (
          <CreditCard key={t.id} tarjeta={t} onEditar={() => abrirEditar(t)} />
        ))}
        <button type="button" onClick={abrirNueva} className="tile-agregar">
          <AddIcon fontSize="small" /> Agregar tarjeta
        </button>
      </div>

      {modalAbierto && (
        <FormTarjeta editando={editando} onGuardado={() => { cerrarModal(); cargar(); }} onCerrar={cerrarModal} />
      )}
    </div>
  );
}
