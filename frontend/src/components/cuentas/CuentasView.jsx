import { useCallback, useEffect, useRef, useState } from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import FormCuenta from './FormCuenta.jsx';
import AccountCard from '../shared/AccountCard.jsx';
import { api } from '../../api.js';
import { fmtQ } from '../../utils.js';

// "Mis cuentas" con vista propia (antes vivía combinada con Tarjetas en
// TarjetasView.jsx) — split que pide FinanzasQ.dc.html (Claude Design).
// El form de alta/edición está oculto por default (el diseño real no lo
// muestra siempre, solo el grid + el tile "Agregar cuenta") y aparece al
// tocar ese tile o "Editar" en una cuenta.
export default function CuentasView() {
  const [cuentas, setCuentas] = useState([]);
  const [editando, setEditando] = useState(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const formRef = useRef(null);

  const cargar = useCallback(async () => {
    setCuentas(await api('/api/cuentas?incluir_inactivas=true'));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const disponibleTotal = cuentas.filter(c => c.activa).reduce((s, c) => s + c.saldo, 0);

  const abrirNueva = () => { setEditando(null); setFormAbierto(true); };
  const abrirEditar = (c) => {
    setEditando(c); setFormAbierto(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }));
  };
  const cerrarForm = () => { setEditando(null); setFormAbierto(false); };

  return (
    <div id="vista-cuentas" className="vista flex flex-col gap-4">
      <Card component="section" aria-label="Disponible total" className="p-4 flex items-center justify-between gap-5 flex-wrap">
        <div>
          <Typography variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">Disponible total</Typography>
          <Typography variant="h4" fontWeight={700} letterSpacing="-.02em">{fmtQ(disponibleTotal)}</Typography>
        </div>
        <Typography variant="body2" className="text-[var(--suave)] max-w-xs">
          Sumado de tus {cuentas.length} cuenta{cuentas.length === 1 ? '' : 's'}. Es lo que tenés hoy, sin contar deuda de tarjetas.
        </Typography>
      </Card>

      {formAbierto && (
        <div ref={formRef}>
          <FormCuenta
            editando={editando}
            onGuardado={() => { cerrarForm(); cargar(); }}
            onCancelar={cerrarForm}
          />
        </div>
      )}

      <div className="cuentas-grid">
        {cuentas.map(c => (
          <AccountCard key={c.id} cuenta={c} onEditar={() => abrirEditar(c)} />
        ))}
        <button type="button" onClick={abrirNueva} className="tile-agregar">
          <AddIcon fontSize="small" /> Agregar cuenta
        </button>
      </div>
    </div>
  );
}
