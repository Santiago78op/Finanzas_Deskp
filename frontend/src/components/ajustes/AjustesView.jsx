import { useState } from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import FormRecurrente from './FormRecurrente.jsx';
import FormGastoRecurrente from './FormGastoRecurrente.jsx';
import CategoriaManager from './CategoriaManager.jsx';
import NotionPanel from './NotionPanel.jsx';
import RespaldoPanel from './RespaldoPanel.jsx';

const PESTANAS = [
  { label: 'Recurrentes', render: () => <FormRecurrente /> },
  { label: 'Pagos frecuentes', render: () => <FormGastoRecurrente /> },
  { label: 'Categorías', render: () => <CategoriaManager /> },
  { label: 'Notion', render: () => <NotionPanel /> },
  { label: 'Respaldo', render: () => <RespaldoPanel /> },
];

export default function AjustesView() {
  const [tab, setTab] = useState(0);

  return (
    <div id="vista-ajustes" className="vista">
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
          {PESTANAS.map((p, i) => <Tab key={p.label} label={p.label} value={i} />)}
        </Tabs>
      </Box>
      {PESTANAS[tab].render()}
    </div>
  );
}
