import { useCallback, useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import FormTarjeta from './FormTarjeta.jsx';
import CreditCard from '../shared/CreditCard.jsx';
import GridOCarrusel from '../shared/GridOCarrusel.jsx';
import { api } from '../../api.js';
import { fmtQ } from '../../utils.js';

// Solo tarjetas — "Mis cuentas" se fue a su propia vista (ver
// components/cuentas/CuentasView.jsx). Split que pide FinanzasQ.dc.html
// (Claude Design). El banner de deuda total se calcula client-side sobre
// las tarjetas activas.
export default function TarjetasView() {
  const [tarjetas, setTarjetas] = useState([]);
  const [editando, setEditando] = useState(null);

  const cargar = useCallback(async () => {
    setTarjetas(await api('/api/tarjetas?incluir_inactivas=true'));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const activas = tarjetas.filter(t => t.activa);
  const deudaTotal = activas.reduce((s, t) => s + t.saldo, 0);
  const proximoCorte = activas.length
    ? Math.min(...activas.map(t => t.dias_corte))
    : null;

  return (
    <div id="vista-tarjetas" className="vista flex flex-col gap-4">
      <Card component="section" aria-label="Deuda total en tarjetas" className="p-4 flex items-center justify-between gap-5 flex-wrap">
        <div>
          <Typography variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">Deuda total en tarjetas</Typography>
          <Typography variant="h4" fontWeight={700} letterSpacing="-.02em" className="text-[var(--pago)]">{fmtQ(deudaTotal)}</Typography>
        </div>
        <Typography variant="body2" className="text-[var(--suave)] max-w-xs">
          Repartida en {activas.length} tarjeta{activas.length === 1 ? '' : 's'}.
          {proximoCorte !== null && ` La próxima corta en ${proximoCorte} día${proximoCorte === 1 ? '' : 's'}.`}
        </Typography>
      </Card>

      <FormTarjeta
        editando={editando}
        onGuardado={() => { setEditando(null); cargar(); }}
        onCancelar={() => setEditando(null)}
      />
      <Card component="section" aria-labelledby="sec-mis-tarjetas" className="p-4">
        <Typography id="sec-mis-tarjetas" variant="h6" className="mb-3">Mis tarjetas</Typography>
        <GridOCarrusel
          items={tarjetas}
          vacio="Todavía no tenés tarjetas registradas."
          render={t => <CreditCard tarjeta={t} onEditar={() => setEditando(t)} />}
        />
      </Card>
    </div>
  );
}
