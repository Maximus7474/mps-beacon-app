import { SEED_CHANNELS } from '@common/data/channels';
import { type ReactNode, useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageLayout from './components/PageLayout';
import Frame from './components/dev/Frame';
import ThemeToggler from './components/dev/Theming';
import { BeaconProvider } from './contexts/BeaconProvider';
import { useBeacon } from './hooks/useBeacon';
import { AnnouncementFeedPage, ChannelPage, ChannelsPage, CompanyPage, HomePage, ManagePage } from './pages';

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
            <Route path='channels/:channelId' element={<ChannelRoute />} />

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
  const navigate = useNavigate();
  // ToDo: selecting a channel opens the conversation page for that channel.
  return <ChannelsPage onOpenChannel={(channel) => navigate(`/channels/${channel.id}`)} />;
};

/**
 * Resolves the :channelId URL param to a channel and renders the
 * conversation. In dev the id resolves against SEED_CHANNELS or a channel
 * created through the Company page's Message button; in-game the fetched
 * channel set will be available from the provider instead.
 */
const ChannelRoute = () => {
  const { channelId } = useParams();
  const navigate = useNavigate();
  const { employeeMode, employeeCompanyId, companies } = useBeacon();

  if (!channelId) return <Navigate to='/channels' replace />;

  // ToDo: replace with provider-sourced channels once the backend supplies them.
  let channel = devMode ? SEED_CHANNELS.find((c) => c.id === channelId) : undefined;

  // Dev stub: channels fabricated by requestChannel() (`dev-<companyId>`) are
  // not in SEED_CHANNELS — rebuild them from the company branding snapshot.
  // ToDo: once the server creates real channel rows this falls away.
  if (!channel && devMode && channelId.startsWith('dev-')) {
    const company = companies.find((c) => c.id === channelId.slice(4));
    if (company) {
      channel = {
        id: `dev-${company.id}`,
        scope: 'personal',
        companyId: company.id,
        companyName: company.name,
        companyIcon: company.icon,
        companyIconBg: company.iconBg,
        companyImage: company.image,
        phoneNumber: company.phone,
        lastMessagePreview: 'No messages yet',
        lastMessageAt: Date.now(),
        unreadCount: 0,
      };
    }
  }

  if (!channel) return <Navigate to='/channels' replace />;

  // A company channel only makes sense while the employee is on the clock:
  // guard against direct URL access without employee mode.
  if (channel.scope === 'company' && (!employeeMode || channel.companyId !== employeeCompanyId)) {
    return <Navigate to='/channels' replace />;
  }

  return <ChannelPage channel={channel} onBack={() => navigate('/channels')} />;
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
