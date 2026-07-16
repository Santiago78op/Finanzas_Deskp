import { useCallback, useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import FormCuenta from './FormCuenta.jsx';
import AccountCard from '../shared/AccountCard.jsx';
import GridOCarrusel from '../shared/GridOCarrusel.jsx';
import { api } from '../../api.js';
import { fmtQ } from '../../utils.js';

// "Mis cuentas" con vista propia (antes vivía combinada con Tarjetas en
// TarjetasView.jsx) — split que pide FinanzasQ.dc.html (Claude Design) para
// que cada una tenga su propio ítem de sidebar. El banner "Disponible total"
// se calcula client-side sobre las cuentas activas (no hace falta pegarle a
// /api/dashboard de nuevo solo para ese número).
export default function CuentasView() {
  const [cuentas, setCuentas] = useState([]);
  const [editando, setEditando] = useState(null);

  const cargar = useCallback(async () => {
    setCuentas(await api('/api/cuentas?incluir_inactivas=true'));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const disponibleTotal = cuentas.filter(c => c.activa).reduce((s, c) => s + c.saldo, 0);

  return (
    <div id="vista-cuentas" className="vista flex flex-col gap-4">
      <Card component="section" aria-label="Disponible total" className="p-4 flex items-center justify-between gap-5 flex-wrap">
        <div>
          <Typography variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">Disponible total</Typography>
          <Typography variant="h4" fontWeight={700} letterSpacing="-.02em">{fmtQ(disponibleTotal)}</Typography>
        </div>
        <Typography variant="body2" className="text-[var(--suave)] max-w-xs">
          Sumado de tus {cuentas.filter(c => c.activa).length} cuenta{cuentas.filter(c => c.activa).length === 1 ? '' : 's'} activa{cuentas.filter(c => c.activa).length === 1 ? '' : 's'}. Es lo que tenés hoy, sin contar deuda de tarjetas.
        </Typography>
      </Card>

      <FormCuenta
        editando={editando}
        onGuardado={() => { setEditando(null); cargar(); }}
        onCancelar={() => setEditando(null)}
      />
      <Card component="section" aria-labelledby="sec-mis-cuentas" className="p-4">
        <Typography id="sec-mis-cuentas" variant="h6" className="mb-3">Mis cuentas</Typography>
        <GridOCarrusel
          items={cuentas}
          vacio="Registrá tus cuentas Monetaria y de Ahorro para saber cuánto dinero tenés."
          render={c => <AccountCard cuenta={c} onEditar={() => setEditando(c)} />}
        />
      </Card>
    </div>
  );
}
