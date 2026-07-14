import FormRecurrente from './FormRecurrente.jsx';
import FormGastoRecurrente from './FormGastoRecurrente.jsx';
import CategoriaManager from './CategoriaManager.jsx';
import NotionPanel from './NotionPanel.jsx';
import RespaldoPanel from './RespaldoPanel.jsx';

export default function AjustesView() {
  return (
    <div id="vista-ajustes" className="vista">
      <FormRecurrente />
      <FormGastoRecurrente />
      <CategoriaManager />
      <NotionPanel />
      <RespaldoPanel />
    </div>
  );
}
