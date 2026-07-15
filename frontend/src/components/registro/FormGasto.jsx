import { useState } from 'react';
import Card from '@mui/material/Card';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Chips from '../shared/Chips.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useDataVersion } from '../../context/DataVersionContext.jsx';
import { useToast } from '../shared/Toast.jsx';
import { api } from '../../api.js';
import { fmtQ, hoyISO } from '../../utils.js';

export default function FormGasto({ inputRef }) {
  const { catGasto, metodos, cuentas } = useCatalog();
  const { bump } = useDataVersion();
  const toast = useToast();

  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [categoria, setCategoria] = useState();
  const [metodo, setMetodo] = useState();
  const [cuenta, setCuenta] = useState();

  const metodoRequiereCuenta = metodo && (metodo.metodo === 'Débito' || metodo.metodo === 'Transferencia');
  const cuentasConNinguna = cuentas.length ? [...cuentas, { id: null, nombre: 'Sin cuenta' }] : [];

  const submit = async (e) => {
    e.preventDefault();
    if (!categoria) return toast('Elegí una categoría', true);
    if (!metodo) return toast('Elegí un método de pago', true);
    const ctaG = metodoRequiereCuenta ? cuenta : null;
    try {
      await api('/api/gastos', {
        method: 'POST',
        body: {
          fecha, descripcion,
          categoria_id: categoria.id, metodo: metodo.metodo, tarjeta_id: metodo.tarjeta_id,
          cuenta_id: ctaG ? ctaG.id : null,
          monto: parseFloat(monto),
        },
      });
      toast(`Gasto de ${fmtQ(monto)} guardado ✓`);
      setMonto(''); setDescripcion('');
      inputRef?.current?.focus();
      bump();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <Card className="p-4">
      <form aria-label="Registrar gasto" className="flex flex-col gap-3" autoComplete="off" onSubmit={submit}>
        <TextField label="Monto (Q)" type="number" inputProps={{ step: 0.01, min: 0.01, inputMode: 'decimal' }}
          inputRef={inputRef} required autoFocus placeholder="0.00"
          value={monto} onChange={e => setMonto(e.target.value)} />
        <TextField label="Descripción (opcional)" placeholder="ej. almuerzo"
          value={descripcion} onChange={e => setDescripcion(e.target.value)} />
        <Typography variant="body2" color="text.secondary">Categoría</Typography>
        <Chips items={catGasto} getLabel={c => c.nombre} value={categoria} onChange={setCategoria} />
        <Typography variant="body2" color="text.secondary">Método de pago</Typography>
        <Chips items={metodos} getLabel={m => m.etiqueta} value={metodo} onChange={setMetodo} />
        {metodoRequiereCuenta && cuentas.length > 0 && (
          <>
            <Typography variant="body2" color="text.secondary">¿De qué cuenta salió? (opcional)</Typography>
            <Chips items={cuentasConNinguna} getLabel={c => c.nombre} value={cuenta} onChange={setCuenta} permitirNinguno />
          </>
        )}
        <TextField label="Fecha" type="date" required InputLabelProps={{ shrink: true }}
          value={fecha} onChange={e => setFecha(e.target.value)} />
        <Button type="submit" variant="contained" color="error" size="large">Guardar gasto</Button>
      </form>
    </Card>
  );
}
