import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';

export default function Modal({ titulo, onCerrar, onGuardar, children, labelGuardar = 'Guardar', labelCerrar = 'Cancelar', peligro = false }) {
  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="xs">
      <DialogTitle>{titulo}</DialogTitle>
      <DialogContent className="flex flex-col gap-3">{children}</DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>{labelCerrar}</Button>
        <Button onClick={onGuardar} variant="contained" color={peligro ? 'error' : 'primary'}>{labelGuardar}</Button>
      </DialogActions>
    </Dialog>
  );
}
