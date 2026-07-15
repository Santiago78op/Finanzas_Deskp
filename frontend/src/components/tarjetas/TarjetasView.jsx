import { useCallback, useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import FormCuenta from './FormCuenta.jsx';
import FormTarjeta from './FormTarjeta.jsx';
import AccountCard from '../shared/AccountCard.jsx';
import CreditCard from '../shared/CreditCard.jsx';
import GridOCarrusel from '../shared/GridOCarrusel.jsx';
import { api } from '../../api.js';

export default function TarjetasView() {
  const [cuentas, setCuentas] = useState([]);
  const [tarjetas, setTarjetas] = useState([]);
  const [editandoCuenta, setEditandoCuenta] = useState(null);
  const [editandoTarjeta, setEditandoTarjeta] = useState(null);

  const cargarCuentas = useCallback(async () => {
    setCuentas(await api('/api/cuentas?incluir_inactivas=true'));
  }, []);
  const cargarTarjetas = useCallback(async () => {
    setTarjetas(await api('/api/tarjetas?incluir_inactivas=true'));
  }, []);

  useEffect(() => { cargarCuentas(); cargarTarjetas(); }, [cargarCuentas, cargarTarjetas]);

  return (
    <div id="vista-tarjetas" className="vista flex flex-col gap-4">
      <FormCuenta
        editando={editandoCuenta}
        onGuardado={() => { setEditandoCuenta(null); cargarCuentas(); }}
        onCancelar={() => setEditandoCuenta(null)}
      />
      <Card className="p-4">
        <Typography variant="h6" className="mb-3">Mis cuentas</Typography>
        <GridOCarrusel
          items={cuentas}
          vacio="Registrá tus cuentas Monetaria y de Ahorro para saber cuánto dinero tenés."
          render={c => <AccountCard cuenta={c} onEditar={() => setEditandoCuenta(c)} />}
        />
      </Card>

      <FormTarjeta
        editando={editandoTarjeta}
        onGuardado={() => { setEditandoTarjeta(null); cargarTarjetas(); }}
        onCancelar={() => setEditandoTarjeta(null)}
      />
      <Card className="p-4">
        <Typography variant="h6" className="mb-3">Mis tarjetas</Typography>
        <GridOCarrusel
          items={tarjetas}
          vacio="Todavía no tenés tarjetas registradas."
          render={t => <CreditCard tarjeta={t} onEditar={() => setEditandoTarjeta(t)} />}
        />
      </Card>
    </div>
  );
}
