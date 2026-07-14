import { useRef, useState } from 'react';
import { api } from '../../api.js';
import { useToast } from '../shared/Toast.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';

const TABLAS = ['gastos', 'ingresos', 'pagos_tarjetas', 'tarjetas', 'cuentas', 'categorias', 'ingresos_recurrentes', 'gastos_recurrentes'];

export default function RespaldoPanel() {
  const { refetch } = useCatalog();
  const toast = useToast();
  const [tabla, setTabla] = useState(TABLAS[0]);
  const [resultado, setResultado] = useState(null); // { importados, rechazados }
  const archivoRef = useRef(null);

  const importar = async () => {
    const archivo = archivoRef.current?.files[0];
    if (!archivo) return toast('Elegí un archivo CSV', true);
    const fd = new FormData();
    fd.append('archivo', archivo);
    try {
      const r = await api(`/api/import/${tabla}`, { method: 'POST', body: fd });
      setResultado(r);
      toast(`Importación: ${r.importados} filas ✓`);
      await refetch();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <div className="panel">
      <h3>Respaldo (CSV)</h3>
      <p className="texto-suave">Exportá todo a un ZIP con un CSV por tabla, o importá un CSV con el mismo formato.</p>
      <a href="/api/export" className="guardar enlace-btn" download>Exportar todo (ZIP)</a>
      <div className="importar">
        <select value={tabla} onChange={e => setTabla(e.target.value)}>
          {TABLAS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="file" accept=".csv" ref={archivoRef} />
        <button className="mini-btn" onClick={importar}>Importar CSV</button>
      </div>
      {resultado && (
        <div className="texto-suave">
          <b>{resultado.importados}</b> filas importadas.
          {resultado.rechazados.length > 0 && (
            <>
              {' '}<b>{resultado.rechazados.length}</b> rechazadas:
              <ul>
                {resultado.rechazados.slice(0, 15).map((x, i) => <li key={i}>Fila {x.fila}: {x.motivo}</li>)}
                {resultado.rechazados.length > 15 && <li>…y más</li>}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
