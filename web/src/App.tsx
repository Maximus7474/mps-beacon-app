import { SEED_CHANNELS } from '@common/data/channels';
import type { Channel } from '@common/types';
import { type ReactNode, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageLayout from './components/PageLayout';
import Frame from './components/dev/Frame';
import ThemeToggler from './components/dev/Theming';
import { BeaconProvider } from './contexts/BeaconProvider';
import { useBeacon } from './hooks/useBeacon';
import { AnnouncementFeedPage, ChannelPage, ChannelsPage, CompanyPage, HomePage, ManagePage } from './pages';
import { fetchNui } from './utils/fetchNui';

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
 * Resolves the :channelId URL param to a conversation and renders it. Ids are
 * the compound conversation key (`<companyId>:<phone>`); real ones resolve
 * through the client runtime (`beaconapp:getchannel`), which revalidates the
 * cached slices the conversation appears in. In dev, seed ids resolve locally.
 */
const ChannelRoute = () => {
  const { channelId } = useParams();
  const navigate = useNavigate();
  const { employeeMode, employeeCompanyId } = useBeacon();
  const [resolved, setResolved] = useState<Channel | null>(null);
  const [missing, setMissing] = useState(false);

  // Seed ids resolve below from local data, so the round-trip is skipped.
  const isDevId = Boolean(devMode && channelId && SEED_CHANNELS.some((c) => c.id === channelId));

  useEffect(() => {
    if (!channelId || isDevId) return;
    let cancelled = false;

    setResolved(null);
    setMissing(false);

    fetchNui<Channel | null>('beaconapp:getchannel', { id: channelId })
      .then((channel) => {
        if (cancelled) return;
        if (channel) setResolved(channel);
        else setMissing(true);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });

    return () => {
      cancelled = true;
    };
  }, [channelId, isDevId]);

  if (!channelId) return <Navigate to='/channels' replace />;

  // Dev: the conversation is one of the seeded ones.
  const channel: Channel | undefined = devMode ? SEED_CHANNELS.find((c) => c.id === channelId) : undefined;

  // In-game the id is resolved asynchronously; hold the page while pending.
  const active = channel ?? resolved ?? undefined;
  if (!active) {
    if (devMode || missing) return <Navigate to='/channels' replace />;
    return <div className='app-loading'>Loading…</div>;
  }

  // A company channel only makes sense while the employee is on the clock:
  // guard against direct URL access without employee mode.
  if (active.scope === 'company' && (!employeeMode || active.companyId !== employeeCompanyId)) {
    return <Navigate to='/channels' replace />;
  }

  return <ChannelPage channel={active} onBack={() => navigate('/channels')} />;
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

/**
 * In dev the app renders inside a phone frame; in-game the NUI frame *is* the
 * phone screen. Both are sized by the viewport-relative root font size in
 * index.scss, so no JS resizing is needed here.
 */
const AppProvider = ({ children }: { children: ReactNode }) =>
  devMode ? (
    <div className='dev-wrapper'>
      <Frame>{children}</Frame>
    </div>
  ) : (
    children
  );

export default App;
