import TableContainer from '@mui/material/TableContainer';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { fmtFecha, fmtQ } from '../../utils.js';
import { tablaScroll } from './movimientos.styles.js';

const COLOR_TIPO = { gasto: 'error', ingreso: 'success', pago: 'warning' };

export default function TablaMovimientos({ movs, onEditar, onEliminar }) {
  if (!movs.length) return <Typography variant="body2" className="texto-suave">No hay movimientos con esos filtros.</Typography>;

  return (
    <TableContainer sx={tablaScroll}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Fecha</TableCell>
            <TableCell>Tipo</TableCell>
            <TableCell>Descripción</TableCell>
            <TableCell>Categoría</TableCell>
            <TableCell>Método</TableCell>
            <TableCell align="right">Monto</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {movs.map((m, i) => (
            <TableRow key={`${m.tipo}-${m.id}`} className={`mov-${m.tipo}`}>
              <TableCell>{fmtFecha(m.fecha)}</TableCell>
              <TableCell><Chip size="small" label={m.tipo} color={COLOR_TIPO[m.tipo] || 'default'} /></TableCell>
              <TableCell>{m.descripcion || '—'}</TableCell>
              <TableCell>{m.categoria || '—'}</TableCell>
              <TableCell>{m.metodo_etiqueta}</TableCell>
              <TableCell align="right">{m.tipo === 'ingreso' ? '+' : '−'}{fmtQ(m.monto)}</TableCell>
              <TableCell>
                <Tooltip title="Editar">
                  <IconButton size="small" onClick={() => onEditar(i)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Eliminar">
                  <IconButton size="small" onClick={() => onEliminar(i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
