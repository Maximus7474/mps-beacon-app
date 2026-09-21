import { Link, useLocation } from 'react-router-dom';
import type { NavItem } from '../types';
import { useBeacon } from '../hooks/useBeacon';

import './Footer.scss';
import { BellIcon, ChatDotsIcon, HouseSimpleIcon, WrenchIcon } from '@phosphor-icons/react/dist/ssr';

const baseRoutes: NavItem[] = [
  { id: 'home', icon: <HouseSimpleIcon size='1.75em' />, path: '/', tooltip: 'Home' },
  { id: 'feed', icon: <BellIcon size='1.75em' />, path: '/feed', tooltip: 'Announcements' },
  { id: 'channels', icon: <ChatDotsIcon size='1.75em' />, path: '/channels', tooltip: 'Messages' },
];

const employeeRoutes: NavItem[] = [
  { id: 'manage', icon: <WrenchIcon size='1.75em' />, path: '/manage', tooltip: 'Manage' },
];

const Footer: React.FC = () => {
  const { pathname } = useLocation();
  const { employeeMode } = useBeacon();

  const routes = employeeMode ? [...baseRoutes, ...employeeRoutes] : baseRoutes;

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
