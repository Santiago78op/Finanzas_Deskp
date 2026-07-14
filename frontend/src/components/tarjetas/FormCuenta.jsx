import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useToast } from '../shared/Toast.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';

const VACIO = { banco: '', nombre: '', tipo: 'Monetaria', saldo_inicial: '0', activa: true };

export default function FormCuenta({ editando, onGuardado, onCancelar }) {
  const { refetch } = useCatalog();
  const toast = useToast();
  const [form, setForm] = useState(VACIO);

  useEffect(() => {
    setForm(editando ? {
      banco: editando.banco, nombre: editando.nombre, tipo: editando.tipo,
      saldo_inicial: String(editando.saldo_inicial), activa: !!editando.activa,
    } : VACIO);
  }, [editando]);

  const submit = async (e) => {
    e.preventDefault();
    const body = {
      banco: form.banco, nombre: form.nombre, tipo: form.tipo,
      saldo_inicial: parseFloat(form.saldo_inicial || 0), activa: form.activa,
    };
    try {
      if (editando) await api(`/api/cuentas/${editando.id}`, { method: 'PUT', body });
      else await api('/api/cuentas', { method: 'POST', body });
      toast('Cuenta guardada ✓');
      await refetch();
      onGuardado();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <div className="panel">
      <h3>{editando ? `Editar: ${editando.nombre}` : 'Nueva cuenta (Monetaria / Ahorro)'}</h3>
      <form className="form-grid" autoComplete="off" onSubmit={submit}>
        <label>Banco
          <input type="text" placeholder="ej. BI" required
                 value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} />
        </label>
        <label>Nombre único
          <input type="text" placeholder="ej. Monetaria BI" required
                 value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
        </label>
        <label>Tipo
          <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
            <option value="Monetaria">Monetaria</option>
            <option value="Ahorro">Ahorro</option>
          </select>
        </label>
        <label>Saldo actual (Q) <span className="opcional">— opcional, lo que tenés hoy</span>
          <input type="number" step="0.01" min="0"
                 value={form.saldo_inicial} onChange={e => setForm(f => ({ ...f, saldo_inicial: e.target.value }))} />
        </label>
        <label className="check">
          <input type="checkbox" checked={form.activa} onChange={e => setForm(f => ({ ...f, activa: e.target.checked }))} /> Activa
        </label>
        <button type="submit" className="guardar">Guardar cuenta</button>
        {editando && <button type="button" className="mini-btn" onClick={onCancelar}>Cancelar edición</button>}
      </form>
    </div>
  );
}
