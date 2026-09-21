import { type ReactNode, useEffect } from 'react';
import Frame from './components/dev/Frame';
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import ThemeToggler from './components/dev/Theming';
import PageLayout from './components/PageLayout';
import { AnnouncementFeedPage, CompanyPage, HomePage, ManagePage, ChannelsPage } from './pages';
import { BeaconProvider } from './contexts/BeaconProvider';
import { useBeacon } from './hooks/useBeacon';

import './App.scss';

const devMode = !window?.['invokeNative'];

const App = () => {
  useEffect(() => {
    if (devMode) {
      document.body.style.visibility = 'visible';
      document.body.setAttribute('devmode', 'true');
    }
  }, []);

  return (
    <BeaconProvider>
      <AppProvider>
        <AppShell />
      </AppProvider>
      {devMode && <ThemeToggler />}
    </BeaconProvider>
  );
};

const AppShell = () => {
  const { loading } = useBeacon();

  return (
    <div className='app'>
      {loading ? (
        <div className='app-loading'>Loading…</div>
      ) : (
        <Routes>
          <Route path='/' element={<PageLayout />}>
            <Route index element={<HomeRoute />} />
            <Route path='company' element={<CompanyRoute />} />
            <Route path='feed' element={<AnnouncementFeedRoute />} />
            <Route path='manage' element={<ManageRoute />} />
            <Route path='channels' element={<ChannelsRoute />} />

            {/* Redirect if accessing an unknown or unauthorised page */}
            <Route path='*' element={<Navigate to='/' replace />} />
          </Route>
        </Routes>
      )}
    </div>
  );
};

const HomeRoute = () => {
  const navigate = useNavigate();
  const { companies } = useBeacon();

  return <HomePage companies={companies} onSelectCompany={(company) => navigate(`/company?companyId=${company.id}`)} />;
};

const CompanyRoute = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { companies, announcements } = useBeacon();

  const companyId = params.get('companyId');
  const company = companies.find((c) => c.id === companyId);

  if (!company) return <Navigate to='/' replace />;

  return <CompanyPage company={company} announcements={announcements} onBack={() => navigate('/')} />;
};

const AnnouncementFeedRoute = () => {
  const { announcements } = useBeacon();
  return <AnnouncementFeedPage announcements={announcements} />;
};

const ChannelsRoute = () => {
  return <ChannelsPage />;
};

const ManageRoute = () => {
  const {
    companies,
    announcements,
    employeeMode,
    employeeCompanyId,
    addAnnouncement,
    deleteAnnouncement,
    addPost,
    deletePost,
    updateStatus,
  } = useBeacon();

  if (!employeeMode) return <Navigate to='/' replace />;

  const company = companies.find((c) => c.id === employeeCompanyId) ?? null;

  return (
    <ManagePage
      company={company}
      announcements={announcements}
      onAddAnnouncement={addAnnouncement}
      onDeleteAnnouncement={deleteAnnouncement}
      onAddPost={addPost}
      onDeletePost={deletePost}
      onUpdateStatus={updateStatus}
    />
  );
};

const AppProvider = ({ children }: { children: ReactNode }) => {
  if (devMode) {
    const handleResize = () => {
      const { innerWidth, innerHeight } = window;

      const aspectRatio = innerWidth / innerHeight;
      const phoneAspectRatio = 27.6 / 59;

      if (phoneAspectRatio < aspectRatio) {
        document.documentElement.style.fontSize = '1.66vh';
      } else {
        document.documentElement.style.fontSize = '3.4vw';
      }
    };

    useEffect(() => {
      window.addEventListener('resize', handleResize);

      if (devMode) {
        document.body.style.visibility = 'visible';
        return;
      }

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }, []);

    handleResize();

    return (
      <div className='dev-wrapper'>
        <Frame>{children}</Frame>
      </div>
    );
  } else return children;
};

export default App;
