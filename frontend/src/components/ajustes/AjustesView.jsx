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
  { label: 'Recurrentes', slug: 'recurrentes', render: () => <FormRecurrente /> },
  { label: 'Pagos frecuentes', slug: 'pagos-frecuentes', render: () => <FormGastoRecurrente /> },
  { label: 'Categorías', slug: 'categorias', render: () => <CategoriaManager /> },
  { label: 'Notion', slug: 'notion', render: () => <NotionPanel /> },
  { label: 'Respaldo', slug: 'respaldo', render: () => <RespaldoPanel /> },
];

export default function AjustesView() {
  const [tab, setTab] = useState(0);

  return (
    <div id="vista-ajustes" className="vista">
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
          {PESTANAS.map((p, i) => (
            <Tab key={p.label} label={p.label} value={i} id={`tab-${p.slug}`} aria-controls={`panel-${p.slug}`} />
          ))}
        </Tabs>
      </Box>
      <div role="tabpanel" id={`panel-${PESTANAS[tab].slug}`} aria-labelledby={`tab-${PESTANAS[tab].slug}`}>
        {PESTANAS[tab].render()}
      </div>
    </div>
  );
}
