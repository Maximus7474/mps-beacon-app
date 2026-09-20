import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { devMode } from './utils/utils';
import App from './App';

import './index.scss';

const root = createRoot(document.getElementById('root')!);

if (window.name === '' || devMode) {
  const renderApp = () => {
    root.render(
      <HashRouter>
        <App />
      </HashRouter>,
    );
  };

  if (devMode) {
    // Mock implementation for web dev, provided by LB-Phone resource
    globalThis.formatPhoneNumber = (val: string) => {
      const cleaned = val.replace(/\D/g, '').padEnd(10, '0');
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    };

    renderApp();
  } else {
    window.addEventListener('message', (event) => {
      if (event.data === 'componentsLoaded') renderApp();
    });
  }
}
