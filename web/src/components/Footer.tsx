import { Link, useLocation } from 'react-router-dom';
import { Home, X } from 'lucide-react';
import type { NavItem } from '../types';

import './Footer.scss';

const routes: NavItem[] = [
  { id: 'home', icon: <Home />, path: '/', tooltip: 'Home' },
  { id: 'not_home', icon: <X />, path: '/nothome', tooltip: 'Not Home' },
];

const Footer: React.FC = () => {
  const { pathname } = useLocation();

  return (
    <footer className='app-footer'>
      {routes.map(({ icon, path /* requiresAuth */ }, i) => (
        <Link to={path} key={i} className={pathname === path ? 'selected' : undefined}>
          {icon}
        </Link>
      ))}
    </footer>
  );
};

export default Footer;
