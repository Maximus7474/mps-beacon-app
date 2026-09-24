import React, { useState, useEffect } from 'react';
import { BugIcon, MoonIcon, SunIcon, WrenchIcon } from '@phosphor-icons/react/dist/ssr';
import { useBeacon } from '~/hooks/useBeacon';
import { fetchNui } from '~/utils/fetchNui';
import { devMode } from '~/utils/utils';
import { onDebugChange } from '~/utils/debug';

import './Theming.scss';

const ThemeToggler: React.FC = () => {
  const [theme, setTheme] = useState('light');
  const { employeeMode, setEmployeeMode } = useBeacon();
  const [debug, setDebug] = useState(false);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  useEffect(() => {
    const appElement = document.querySelector('.app');
    if (appElement) {
      appElement.setAttribute('data-theme', theme);
    }
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  // Mirror the client's convar state; the client-side toggle round-trips
  // through fetchNui so F8 and this button can never disagree.
  useEffect(() => onDebugChange(setDebug), []);

  return (
    <div className='theme-menu'>
      <button onClick={toggleTheme}>
        {theme === 'light' ? <SunIcon size='1.5em' /> : <MoonIcon size='1.5em' />}
        <span className='tooltip'>
          Switch to
          <br />
          {theme !== 'light' ? 'light' : 'dark'} theme
        </span>
      </button>

      <button
        className={employeeMode ? 'active' : undefined}
        onClick={() => setEmployeeMode(!employeeMode)}
        aria-pressed={employeeMode}
      >
        <WrenchIcon size='1.5em' />
        <span className='tooltip'>
          Employee mode
          <br />
          {employeeMode ? 'enabled' : 'disabled'}
        </span>
      </button>

      {!devMode && (
        <button
          className={debug ? 'active' : undefined}
          onClick={() => {
            void fetchNui('beaconapp:client:debugtoggle');
          }}
          aria-pressed={debug}
        >
          <BugIcon size='1.5em' />
          <span className='tooltip'>
            Debug logging
            <br />
            {debug ? 'enabled' : 'disabled'}
          </span>
        </button>
      )}
    </div>
  );
};

export default ThemeToggler;
