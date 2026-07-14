import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useToast } from '../shared/Toast.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { fmtQ } from '../../utils.js';

const VACIO = {
  descripcion: '', categoria_id: '', frecuencia: 'Mensual', monto: '', dia_mes: '', dia_mes_2: '',
  metodo: '', cuenta_id: '', activo: true,
};

export default function FormGastoRecurrente({ onCambio }) {
  const { catGasto, metodos, cuentas } = useCatalog();
  const toast = useToast();
  const [recs, setRecs] = useState([]);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);

  const cargar = useCallback(async () => setRecs(await api('/api/gastos_recurrentes')), []);
  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (editando) {
      setForm({
        descripcion: editando.descripcion, categoria_id: String(editando.categoria_id),
        frecuencia: editando.frecuencia || 'Mensual', monto: String(editando.monto),
        dia_mes: String(editando.dia_mes), dia_mes_2: editando.dia_mes_2 ? String(editando.dia_mes_2) : '',
        metodo: editando.metodo === 'Tarjeta' ? `Tarjeta:${editando.tarjeta_id}` : editando.metodo,
        cuenta_id: editando.cuenta_id ? String(editando.cuenta_id) : '',
        activo: !!editando.activo,
      });
    } else {
      const primerMetodo = metodos[0] ? (metodos[0].tarjeta_id ? `Tarjeta:${metodos[0].tarjeta_id}` : metodos[0].metodo) : '';
      setForm({ ...VACIO, categoria_id: catGasto[0] ? String(catGasto[0].id) : '', metodo: primerMetodo });
    }
  }, [editando, catGasto, metodos]);

  const esQuincenal = form.frecuencia === 'Quincenal';
  const usaCuenta = (form.metodo === 'Débito' || form.metodo === 'Transferencia') && cuentas.length > 0;

  const submit = async (e) => {
    e.preventDefault();
    const esTarjeta = form.metodo.startsWith('Tarjeta:');
    const body = {
      descripcion: form.descripcion, categoria_id: parseInt(form.categoria_id),
      monto: parseFloat(form.monto), dia_mes: parseInt(form.dia_mes),
      frecuencia: form.frecuencia,
      dia_mes_2: esQuincenal ? parseInt(form.dia_mes_2) : null,
      metodo: esTarjeta ? 'Tarjeta' : form.metodo,
      tarjeta_id: esTarjeta ? parseInt(form.metodo.split(':')[1]) : null,
      cuenta_id: form.cuenta_id ? parseInt(form.cuenta_id) : null,
      activo: form.activo,
    };
    try {
      if (editando) await api(`/api/gastos_recurrentes/${editando.id}`, { method: 'PUT', body });
      else await api('/api/gastos_recurrentes', { method: 'POST', body });
      toast('Pago frecuente guardado ✓');
      setEditando(null);
      await cargar();
      onCambio?.();
    } catch (err) { toast(err.message, true); }
  };

  const borrar = async (r) => {
    if (!confirm(`¿Eliminar el pago frecuente "${r.descripcion}" definitivamente?\nLos gastos ya registrados en Movimientos NO se borran.`)) return;
    try {
      await api(`/api/gastos_recurrentes/${r.id}`, { method: 'DELETE' });
      toast('Pago frecuente eliminado ✓');
      await cargar();
      onCambio?.();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <div className="panel">
      <h3>{editando ? `Editar pago frecuente: ${editando.descripcion}` : 'Pagos frecuentes (renta, internet, colegio...)'}</h3>
      <p className="texto-suave">La app te pedirá confirmar cada pago en su fecha y creará el gasto con el método configurado.</p>
      <form className="form-grid" autoComplete="off" onSubmit={submit}>
        <label>Descripción
          <input type="text" placeholder="ej. Renta" required
                 value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
        </label>
        <label>Categoría
          <select value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
            {catGasto.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label>Frecuencia
          <select value={form.frecuencia} onChange={e => setForm(f => ({ ...f, frecuencia: e.target.value }))}>
            <option value="Mensual">Mensual (una vez al mes)</option>
            <option value="Quincenal">Quincenal (dos veces al mes)</option>
          </select>
        </label>
        <label>{esQuincenal ? 'Monto por quincena (Q)' : 'Monto (Q)'}
          <input type="number" step="0.01" min="0.01" required
                 value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
        </label>
        <label>Día de pago
          <input type="number" min="1" max="31" required
                 value={form.dia_mes} onChange={e => setForm(f => ({ ...f, dia_mes: e.target.value }))} />
        </label>
        {esQuincenal && (
          <label>Segundo día de pago
            <input type="number" min="1" max="31" required={esQuincenal}
                   value={form.dia_mes_2} onChange={e => setForm(f => ({ ...f, dia_mes_2: e.target.value }))} />
          </label>
        )}
        <label>Método de pago
          <select value={form.metodo} onChange={e => setForm(f => ({ ...f, metodo: e.target.value }))}>
            {metodos.map(m => {
              const val = m.tarjeta_id ? `Tarjeta:${m.tarjeta_id}` : m.metodo;
              return <option key={val} value={val}>{m.etiqueta}</option>;
            })}
          </select>
        </label>
        {usaCuenta && (
          <label>Cuenta de la que sale
            <select value={form.cuenta_id} onChange={e => setForm(f => ({ ...f, cuenta_id: e.target.value }))}>
              <option value="">Sin cuenta</option>
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
        )}
        <label className="check">
          <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} /> Activo
        </label>
        <button type="submit" className="guardar">Guardar pago frecuente</button>
        {editando && <button type="button" className="mini-btn" onClick={() => setEditando(null)}>Cancelar edición</button>}
      </form>

      {!recs.length && <p className="texto-suave">Sin pagos frecuentes configurados todavía.</p>}
      {recs.map(r => (
        <div className="item-lista" key={r.id}>
          <span className={r.activo ? '' : 'inactivo'}>
            <b>{r.descripcion}</b> ({r.categoria}) —{' '}
            {r.frecuencia === 'Quincenal'
              ? `${fmtQ(r.monto)} por quincena, los días ${r.dia_mes} y ${r.dia_mes_2}`
              : `${fmtQ(r.monto)} el día ${r.dia_mes}`}
            {' · '}{r.metodo === 'Tarjeta' ? r.tarjeta : r.metodo}{r.cuenta ? ` (${r.cuenta})` : ''}
          </span>
          <span>
            <button className="mini-btn" onClick={() => setEditando(r)}>Editar</button>
            <button className="mini-btn peligro" onClick={() => borrar(r)}>Eliminar</button>
          </span>
        </div>
      ))}
    </div>
  );
}
