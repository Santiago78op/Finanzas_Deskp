import { useState } from 'react';
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
    <form className="form-registro" autoComplete="off" onSubmit={submit}>
      <label>Monto (Q)</label>
      <input ref={inputRef} type="number" step="0.01" min="0.01" name="monto" inputMode="decimal"
             placeholder="0.00" required autoFocus value={monto} onChange={e => setMonto(e.target.value)} />
      <label>Descripción <span className="opcional">(opcional)</span></label>
      <input type="text" name="descripcion" placeholder="ej. almuerzo"
             value={descripcion} onChange={e => setDescripcion(e.target.value)} />
      <label>Categoría</label>
      <Chips items={catGasto} getLabel={c => c.nombre} value={categoria} onChange={setCategoria} />
      <label>Método de pago</label>
      <Chips items={metodos} getLabel={m => m.etiqueta} value={metodo} onChange={setMetodo} />
      {metodoRequiereCuenta && cuentas.length > 0 && (
        <div>
          <label>¿De qué cuenta salió? <span className="opcional">(opcional)</span></label>
          <Chips items={cuentasConNinguna} getLabel={c => c.nombre} value={cuenta} onChange={setCuenta} permitirNinguno />
        </div>
      )}
      <label>Fecha</label>
      <input type="date" name="fecha" required value={fecha} onChange={e => setFecha(e.target.value)} />
      <button type="submit" className="guardar gasto">Guardar gasto</button>
    </form>
  );
}
