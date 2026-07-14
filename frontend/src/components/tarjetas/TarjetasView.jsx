import { useCallback, useEffect, useState } from 'react';
import FormCuenta from './FormCuenta.jsx';
import FormTarjeta from './FormTarjeta.jsx';
import AccountCard from '../shared/AccountCard.jsx';
import CreditCard from '../shared/CreditCard.jsx';
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
    <div id="vista-tarjetas" className="vista">
      <FormCuenta
        editando={editandoCuenta}
        onGuardado={() => { setEditandoCuenta(null); cargarCuentas(); }}
        onCancelar={() => setEditandoCuenta(null)}
      />
      <div className="panel">
        <h3>Mis cuentas</h3>
        <div className="cuentas-grid">
          {!cuentas.length && <p className="texto-suave">Registrá tus cuentas Monetaria y de Ahorro para saber cuánto dinero tenés.</p>}
          {cuentas.map(c => (
            <AccountCard key={c.id} cuenta={c} onEditar={() => setEditandoCuenta(c)} />
          ))}
        </div>
      </div>

      <FormTarjeta
        editando={editandoTarjeta}
        onGuardado={() => { setEditandoTarjeta(null); cargarTarjetas(); }}
        onCancelar={() => setEditandoTarjeta(null)}
      />
      <div className="panel">
        <h3>Mis tarjetas</h3>
        <div className="tarjetas-grid">
          {!tarjetas.length && <p className="texto-suave">Todavía no tenés tarjetas registradas.</p>}
          {tarjetas.map(t => (
            <CreditCard key={t.id} tarjeta={t} onEditar={() => setEditandoTarjeta(t)} />
          ))}
        </div>
      </div>
    </div>
  );
}
