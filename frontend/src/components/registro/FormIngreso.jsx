import { useState } from 'react';
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
    <form className="form-registro" autoComplete="off" onSubmit={submit}>
      <label>Monto (Q)</label>
      <input ref={inputRef} type="number" step="0.01" min="0.01" name="monto" inputMode="decimal"
             placeholder="0.00" required value={monto} onChange={e => setMonto(e.target.value)} />
      <label>Descripción <span className="opcional">(opcional)</span></label>
      <input type="text" name="descripcion" placeholder="ej. venta"
             value={descripcion} onChange={e => setDescripcion(e.target.value)} />
      <label>Categoría</label>
      <Chips items={catIngreso} getLabel={c => c.nombre} value={categoria} onChange={setCategoria} />
      <label>¿A qué cuenta entró? <span className="opcional">(opcional)</span></label>
      <Chips items={cuentasConNinguna} getLabel={c => c.nombre} value={cuenta} onChange={setCuenta} permitirNinguno />
      <label>Fecha</label>
      <input type="date" name="fecha" required value={fecha} onChange={e => setFecha(e.target.value)} />
      <button type="submit" className="guardar ingreso">Guardar ingreso</button>
    </form>
  );
}
