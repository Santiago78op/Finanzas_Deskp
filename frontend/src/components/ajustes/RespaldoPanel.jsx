import { useRef, useState } from 'react';
import Card from '@mui/material/Card';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
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
    <Card component="section" aria-labelledby="sec-respaldo" className="p-4 flex flex-col gap-4">
      <Typography id="sec-respaldo" variant="h6">Respaldo (CSV)</Typography>
      <Typography variant="body2" className="text-[var(--suave)]">Exportá todo a un ZIP con un CSV por tabla, o importá un CSV con el mismo formato.</Typography>
      <Button variant="contained" component="a" href="/api/export" download className="self-start">Exportar todo (ZIP)</Button>
      <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField select label="Tabla" value={tabla} onChange={e => setTabla(e.target.value)}>
          {TABLAS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
        <Button variant="outlined" size="small" onClick={() => archivoRef.current?.click()}>Elegir archivo CSV</Button>
        <input type="file" accept=".csv" ref={archivoRef} className="hidden" />
        <Button variant="outlined" size="small" onClick={importar}>Importar CSV</Button>
      </Stack>
      {resultado && (
        <Typography variant="body2" className="text-[var(--suave)]">
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
        </Typography>
      )}
    </Card>
  );
}
