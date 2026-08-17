import React from 'react';
import { Outlet } from 'react-router-dom';
import Footer from './Footer';

const PageLayout: React.FC = () => {
  return (
    <div className='app-wrapper'>
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default PageLayout;
