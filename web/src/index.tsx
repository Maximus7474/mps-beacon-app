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
    renderApp();
  } else {
    window.addEventListener('message', (event) => {
      if (event.data === 'componentsLoaded') renderApp();
    });
  }
}
