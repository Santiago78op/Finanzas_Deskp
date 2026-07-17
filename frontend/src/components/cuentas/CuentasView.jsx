import { useCallback, useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/AddOutlined';
import FormCuenta from './FormCuenta.jsx';
import AccountCard from '../shared/AccountCard.jsx';
import { getCuentas } from '../../api/cuentas.js';
import { fmtQ } from '../../utils.js';

// "Mis cuentas" con vista propia (antes vivía combinada con Tarjetas en
// TarjetasView.jsx) — split que pide FinanzasQ.dc.html (Claude Design).
// Alta/edición vía modal (no panel embebido): un formulario en el flujo
// normal se perdía entre las cards y no "resaltaba" como debería.
export default function CuentasView() {
  const [cuentas, setCuentas] = useState([]);
  const [editando, setEditando] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  const cargar = useCallback(async () => {
    setCuentas(await getCuentas(true));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const disponibleTotal = cuentas.filter(c => c.activa).reduce((s, c) => s + c.saldo, 0);

  const abrirNueva = () => { setEditando(null); setModalAbierto(true); };
  const abrirEditar = (c) => { setEditando(c); setModalAbierto(true); };
  const cerrarModal = () => { setEditando(null); setModalAbierto(false); };

  return (
    <div id="vista-cuentas" className="vista flex flex-col">
      <Card component="section" aria-label="Disponible total" className="p-4 flex items-center justify-between gap-5 flex-wrap">
        <div>
          <Typography variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">Disponible total</Typography>
          <Typography variant="h4" fontWeight={700} letterSpacing="-.02em">{fmtQ(disponibleTotal)}</Typography>
        </div>
        <Typography variant="body2" className="text-[var(--suave)] max-w-xs">
          Sumado de tus {cuentas.length} cuenta{cuentas.length === 1 ? '' : 's'}. Es lo que tenés hoy, sin contar deuda de tarjetas.
        </Typography>
      </Card>

      <Divider sx={{ mt: 5, mb: 3 }} />

      <div className="cuentas-grid">
        {cuentas.map(c => (
          <AccountCard key={c.id} cuenta={c} onEditar={() => abrirEditar(c)} />
        ))}
        <button type="button" onClick={abrirNueva} className="tile-agregar">
          <AddIcon fontSize="small" /> Agregar cuenta
        </button>
      </div>

      {modalAbierto && (
        <FormCuenta editando={editando} onGuardado={() => { cerrarModal(); cargar(); }} onCerrar={cerrarModal} />
      )}
    </div>
  );
}
