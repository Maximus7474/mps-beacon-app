import React, { useState, useEffect } from 'react';
import { MoonIcon, SunIcon, WrenchIcon } from '@phosphor-icons/react/dist/ssr';
import { useBeacon } from '~/hooks/useBeacon';

import './Theming.scss';

const ThemeToggler: React.FC = () => {
  // Don't commit
  const [theme, setTheme] = useState('dark');
  const { employeeMode, setEmployeeMode } = useBeacon();

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
    </div>
  );
};

export default ThemeToggler;
