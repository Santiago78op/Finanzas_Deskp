import { useCallback, useEffect, useState } from 'react';

// Tema claro/oscuro por atributo data-theme en <html> + localStorage('tema').
// El script inline en index.html ya lo aplica antes del primer paint (evita
// el destello); este hook solo sincroniza el estado de React con eso y
// expone toggle().
export function useTheme() {
  const [tema, setTema] = useState(() => document.documentElement.dataset.theme || 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    localStorage.setItem('tema', tema);
  }, [tema]);

  const toggle = useCallback(() => {
    setTema(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { tema, toggle };
}
