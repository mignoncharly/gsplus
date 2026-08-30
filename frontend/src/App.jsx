import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import Footer from './components/Footer';
import LocaleProvider from './components/LocaleProvider.jsx';
import SiteSettingsProvider from './components/SiteSettingsProvider';
import ScrollManager from './components/ScrollManager';
import RouteMetadata from './components/RouteMetadata';
import WhatsAppFab from './components/WhatsAppFab';
import './index.css';
import { SUPPORTED_LOCALES, useLocale } from './lib/i18n';
import { localizedPath } from './lib/locale-routes.js';

const Header = lazy(() => import('./components/Header'));
const Home = lazy(() => import('./pages/Home'));
const Services = lazy(() => import('./pages/Services'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const Reservation = lazy(() => import('./pages/Reservation'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const CreativeServices = lazy(() => import('./pages/CreativeServices'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Corporate = lazy(() => import('./pages/Corporate'));
const Legal = lazy(() => import('./pages/Legal'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const NotFound = lazy(() => import('./pages/NotFound'));

const publicRoutes = [
  ['/', Home], ['/services', Services], ['/portfolio', Portfolio], ['/reservation', Reservation],
  ['/services-creatifs', CreativeServices], ['/a-propos', About], ['/contact', Contact],
  ['/corporate', Corporate], ['/mentions-legales', Legal], ['/confidentialite', Privacy], ['/cgv', Terms],
];

const RouteLoading = () => {
  const { t } = useLocale();
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading__indicator" aria-hidden="true" />
      <span>{t('loadingPage')}</span>
    </div>
  );
};

const AppLayout = () => {
  const { t } = useLocale();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <>
      <ScrollManager />
      <RouteMetadata />
      {!isAdmin && <a className="skip-link" href="#main-content">{t('skipToContent')}</a>}
      {!isAdmin && <Suspense fallback={null}><Header /></Suspense>}
      <main id="main-content" tabIndex="-1" style={{ minHeight: '80vh' }}>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/admin/*" element={<AdminDashboard />} />
            {SUPPORTED_LOCALES.flatMap((locale) => publicRoutes.map(([basePath, Component]) => (
              <Route key={`${locale}:${basePath}`} path={localizedPath(locale, basePath)} element={<Component />} />
            )))}
            {publicRoutes.map(([basePath, Component]) => <Route key={`legacy:${basePath}`} path={basePath} element={<Component />} />)}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {!isAdmin && <Footer />}
      {!isAdmin && <WhatsAppFab />}
    </>
  );
};

function App() {
  return (
    <Router>
      <LocaleProvider>
        <SiteSettingsProvider>
          <MotionConfig reducedMotion="user">
            <AppLayout />
          </MotionConfig>
        </SiteSettingsProvider>
      </LocaleProvider>
    </Router>
  );
}

export default App;
