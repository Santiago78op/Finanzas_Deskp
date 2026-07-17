import { useCallback, useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { getRecurrentesPendientes, confirmarRecurrente, omitirRecurrente } from '../../api/recurrentes.js';
import { getGastosRecurrentesPendientes, confirmarGastoRecurrente, omitirGastoRecurrente } from '../../api/gastosRecurrentes.js';
import { useToast } from '../shared/Toast.jsx';
import { useConfirm } from '../shared/ConfirmDialog.jsx';
import { useDataVersion } from '../../context/DataVersionContext.jsx';

// Aviso de ingresos recurrentes y pagos frecuentes pendientes de confirmar
// este mes (salario, alquiler, etc.) — port 1:1 de revisarSalarioPendiente().
export default function AvisoSalario() {
  const toast = useToast();
  const confirmar = useConfirm();
  const { bump } = useDataVersion();
  const [pendIng, setPendIng] = useState([]);
  const [pendGas, setPendGas] = useState([]);
  const [montos, setMontos] = useState({});      // { [`ing-${i}`]: string, [`gas-${i}`]: string }

  const revisar = useCallback(async () => {
    try {
      const [ing, gas] = await Promise.all([
        getRecurrentesPendientes(),
        getGastosRecurrentesPendientes(),
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
      await confirmarRecurrente(p.id, { monto: parseFloat(montos[`ing-${i}`]), quincena: p.quincena });
      toast(`${p.etiqueta} confirmado ✓`);
      revisar();
      bump();
    } catch (err) { toast(err.message, true); }
  };

  const omitirIngreso = async (i) => {
    const p = pendIng[i];
    if (!(await confirmar(`¿Omitir "${p.etiqueta}" este mes? No se creará el ingreso y el aviso desaparecerá.`))) return;
    try {
      await omitirRecurrente(p.id, p.quincena);
      toast(`${p.etiqueta} omitido este mes`);
      revisar();
    } catch (err) { toast(err.message, true); }
  };

  const confirmarGasto = async (i) => {
    const p = pendGas[i];
    try {
      await confirmarGastoRecurrente(p.id, { monto: parseFloat(montos[`gas-${i}`]), quincena: p.quincena });
      toast(`Pago ${p.etiqueta} registrado ✓`);
      revisar();
      bump();
    } catch (err) { toast(err.message, true); }
  };

  const omitirGasto = async (i) => {
    const p = pendGas[i];
    if (!(await confirmar(`¿Omitir el pago "${p.etiqueta}" este mes? No se creará el gasto.`))) return;
    try {
      await omitirGastoRecurrente(p.id, p.quincena);
      toast(`Pago ${p.etiqueta} omitido este mes`);
      revisar();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <Card id="aviso-salario" className="p-5 flex flex-col gap-3 mb-4">
      {pendIng.map((p, i) => (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }} key={`ing-${i}`}>
          <Typography variant="body2">💵 Confirmar ingreso <b>{p.etiqueta}</b> de <b>{p.mes_nombre}</b>:</Typography>
          <TextField size="small" type="number" inputProps={{ step: 0.01, min: 0.01 }} className="w-28"
            value={montos[`ing-${i}`] ?? ''}
            onChange={e => setMontos(m => ({ ...m, [`ing-${i}`]: e.target.value }))} />
          <Button size="small" variant="contained" color="success" onClick={() => confirmarIngreso(i)}>Confirmar</Button>
          <Button size="small" variant="outlined"
            title="No lo recibiste este mes: descarta el aviso sin crear el ingreso"
            onClick={() => omitirIngreso(i)}>Omitir</Button>
        </Stack>
      ))}
      {pendGas.map((p, i) => (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }} key={`gas-${i}`}>
          <Typography variant="body2">💸 Confirmar pago <b>{p.etiqueta}</b> de <b>{p.mes_nombre}</b>{' '}
            <small>({p.metodo === 'Tarjeta' ? p.tarjeta : p.metodo})</small>:</Typography>
          <TextField size="small" type="number" inputProps={{ step: 0.01, min: 0.01 }} className="w-28"
            value={montos[`gas-${i}`] ?? ''}
            onChange={e => setMontos(m => ({ ...m, [`gas-${i}`]: e.target.value }))} />
          <Button size="small" variant="contained" color="error" onClick={() => confirmarGasto(i)}>Confirmar</Button>
          <Button size="small" variant="outlined"
            title="No lo pagaste este mes: descarta el aviso sin crear el gasto"
            onClick={() => omitirGasto(i)}>Omitir</Button>
        </Stack>
      ))}
    </Card>
  );
}
