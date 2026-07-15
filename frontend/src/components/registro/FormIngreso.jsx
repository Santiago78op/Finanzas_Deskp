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

export default function FormIngreso({ inputRef }) {
  const { catIngreso, cuentas } = useCatalog();
  const { bump } = useDataVersion();
  const toast = useToast();

  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [categoria, setCategoria] = useState();
  const [cuenta, setCuenta] = useState();

  const cuentasConNinguna = [{ id: null, nombre: 'Sin cuenta' }, ...cuentas];

  const submit = async (e) => {
    e.preventDefault();
    if (!categoria) return toast('Elegí una categoría', true);
    try {
      await api('/api/ingresos', {
        method: 'POST',
        body: { fecha, descripcion, categoria_id: categoria.id, cuenta_id: cuenta ? cuenta.id : null, monto: parseFloat(monto) },
      });
      toast(`Ingreso de ${fmtQ(monto)} guardado ✓`);
      setMonto(''); setDescripcion('');
      inputRef?.current?.focus();
      bump();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <Card className="p-4">
      <form aria-label="Registrar ingreso" className="flex flex-col gap-3" autoComplete="off" onSubmit={submit}>
        <TextField label="Monto (Q)" type="number" inputProps={{ step: 0.01, min: 0.01, inputMode: 'decimal' }}
          inputRef={inputRef} required placeholder="0.00"
          value={monto} onChange={e => setMonto(e.target.value)} />
        <TextField label="Descripción (opcional)" placeholder="ej. venta"
          value={descripcion} onChange={e => setDescripcion(e.target.value)} />
        <Typography variant="body2" color="text.secondary">Categoría</Typography>
        <Chips items={catIngreso} getLabel={c => c.nombre} value={categoria} onChange={setCategoria} />
        <Typography variant="body2" color="text.secondary">¿A qué cuenta entró? (opcional)</Typography>
        <Chips items={cuentasConNinguna} getLabel={c => c.nombre} value={cuenta} onChange={setCuenta} permitirNinguno />
        <TextField label="Fecha" type="date" required InputLabelProps={{ shrink: true }}
          value={fecha} onChange={e => setFecha(e.target.value)} />
        <Button type="submit" variant="contained" color="success" size="large">Guardar ingreso</Button>
      </form>
    </Card>
  );
}
