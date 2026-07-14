import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useToast } from '../shared/Toast.jsx';
import { useDataVersion } from '../../context/DataVersionContext.jsx';

// Aviso de ingresos recurrentes y pagos frecuentes pendientes de confirmar
// este mes (salario, alquiler, etc.) — port 1:1 de revisarSalarioPendiente().
export default function AvisoSalario() {
  const toast = useToast();
  const { bump } = useDataVersion();
  const [pendIng, setPendIng] = useState([]);
  const [pendGas, setPendGas] = useState([]);
  const [montos, setMontos] = useState({});      // { [`ing-${i}`]: string, [`gas-${i}`]: string }

  const revisar = useCallback(async () => {
    try {
      const [ing, gas] = await Promise.all([
        api('/api/recurrentes/pendientes'),
        api('/api/gastos_recurrentes/pendientes'),
      ]);
      setPendIng(ing);
      setPendGas(gas);
      setMontos(m => ({
        ...Object.fromEntries(ing.map((p, i) => [`ing-${i}`, m[`ing-${i}`] ?? String(p.monto)])),
        ...Object.fromEntries(gas.map((p, i) => [`gas-${i}`, m[`gas-${i}`] ?? String(p.monto)])),
      }));
    } catch {
      setPendIng([]); setPendGas([]);
    }
  }, []);

  useEffect(() => { revisar(); }, [revisar]);

  if (!pendIng.length && !pendGas.length) return null;

  const confirmarIngreso = async (i) => {
    const p = pendIng[i];
    try {
      await api(`/api/recurrentes/${p.id}/confirmar`, {
        method: 'POST', body: { monto: parseFloat(montos[`ing-${i}`]), quincena: p.quincena },
      });
      toast(`${p.etiqueta} confirmado ✓`);
      revisar();
      bump();
    } catch (err) { toast(err.message, true); }
  };

  const omitirIngreso = async (i) => {
    const p = pendIng[i];
    if (!confirm(`¿Omitir "${p.etiqueta}" este mes? No se creará el ingreso y el aviso desaparecerá.`)) return;
    try {
      await api(`/api/recurrentes/${p.id}/omitir?quincena=${p.quincena}`, { method: 'POST' });
      toast(`${p.etiqueta} omitido este mes`);
      revisar();
    } catch (err) { toast(err.message, true); }
  };

  const confirmarGasto = async (i) => {
    const p = pendGas[i];
    try {
      await api(`/api/gastos_recurrentes/${p.id}/confirmar`, {
        method: 'POST', body: { monto: parseFloat(montos[`gas-${i}`]), quincena: p.quincena },
      });
      toast(`Pago ${p.etiqueta} registrado ✓`);
      revisar();
      bump();
    } catch (err) { toast(err.message, true); }
  };

  const omitirGasto = async (i) => {
    const p = pendGas[i];
    if (!confirm(`¿Omitir el pago "${p.etiqueta}" este mes? No se creará el gasto.`)) return;
    try {
      await api(`/api/gastos_recurrentes/${p.id}/omitir?quincena=${p.quincena}`, { method: 'POST' });
      toast(`Pago ${p.etiqueta} omitido este mes`);
      revisar();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <div id="aviso-salario" className="aviso-salario">
      {pendIng.map((p, i) => (
        <span key={`ing-${i}`} style={{ display: 'contents' }}>
          <span>💵 Confirmar ingreso <b>{p.etiqueta}</b> de <b>{p.mes_nombre}</b>:</span>
          <input type="number" step="0.01" min="0.01"
                 value={montos[`ing-${i}`] ?? ''}
                 onChange={e => setMontos(m => ({ ...m, [`ing-${i}`]: e.target.value }))} />
          <button onClick={() => confirmarIngreso(i)}>Confirmar</button>
          <button className="mini-btn" onClick={() => omitirIngreso(i)}
                  title="No lo recibiste este mes: descarta el aviso sin crear el ingreso">Omitir</button>
          <br />
        </span>
      ))}
      {pendGas.map((p, i) => (
        <span key={`gas-${i}`} style={{ display: 'contents' }}>
          <span>💸 Confirmar pago <b>{p.etiqueta}</b> de <b>{p.mes_nombre}</b>{' '}
            <small>({p.metodo === 'Tarjeta' ? p.tarjeta : p.metodo})</small>:</span>
          <input type="number" step="0.01" min="0.01"
                 value={montos[`gas-${i}`] ?? ''}
                 onChange={e => setMontos(m => ({ ...m, [`gas-${i}`]: e.target.value }))} />
          <button onClick={() => confirmarGasto(i)}>Confirmar</button>
          <button className="mini-btn" onClick={() => omitirGasto(i)}
                  title="No lo pagaste este mes: descarta el aviso sin crear el gasto">Omitir</button>
          <br />
        </span>
      ))}
    </div>
  );
}
