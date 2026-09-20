import { Link, useLocation } from 'react-router-dom';
import { Bell, Home, Wrench } from 'lucide-react';
import type { NavItem } from '../types';
import { useBeacon } from '../hooks/useBeacon';

import './Footer.scss';

const baseRoutes: NavItem[] = [
  { id: 'home', icon: <Home />, path: '/', tooltip: 'Home' },
  { id: 'feed', icon: <Bell />, path: '/feed', tooltip: 'Announcements' },
];

const manageRoute: NavItem = { id: 'manage', icon: <Wrench />, path: '/manage', tooltip: 'Manage' };

const Footer: React.FC = () => {
  const { pathname } = useLocation();
  const { employeeMode } = useBeacon();

  const routes = employeeMode ? [...baseRoutes, manageRoute] : baseRoutes;

  return (
    <footer className='app-footer'>
      {routes.map(({ id, icon, path }, i) => (
        <Link to={path} key={id ?? i} className={pathname === path ? 'selected' : undefined}>
          {icon}
        </Link>
      ))}
    </footer>
  );
};

export default Footer;
