import { lazy, Suspense } from 'react';
import { MessageCircle } from 'lucide-react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import Header from './components/Header';
import Footer from './components/Footer';
import ScrollManager from './components/ScrollManager';
import RouteMetadata from './components/RouteMetadata';
import './index.css';

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

const RouteLoading = () => (
  <div className="route-loading" role="status" aria-live="polite">
    <span className="route-loading__indicator" aria-hidden="true" />
    <span>Chargement de la page…</span>
  </div>
);

const AppLayout = () => {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <>
      <ScrollManager />
      <RouteMetadata />
      {!isAdmin && <a className="skip-link" href="#main-content">Aller au contenu principal</a>}
      {!isAdmin && <Header />}
      <main id="main-content" tabIndex="-1" style={{ minHeight: '80vh' }}>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/services" element={<Services />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/reservation" element={<Reservation />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/login" element={<AdminDashboard />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/services-creatifs" element={<CreativeServices />} />
            <Route path="/a-propos" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/corporate" element={<Corporate />} />
            <Route path="/mentions-legales" element={<Legal />} />
            <Route path="/confidentialite" element={<Privacy />} />
            <Route path="/cgv" element={<Terms />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {!isAdmin && <Footer />}

      {!isAdmin && (
        <a
          href="https://wa.me/237673026654"
          target="_blank"
          rel="noopener noreferrer"
          className="whatsapp-fab"
          aria-label="Contacter Golden Studio Plus sur WhatsApp"
        >
          <MessageCircle size={32} aria-hidden="true" />
        </a>
      )}
    </>
  );
};

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Router>
        <AppLayout />
      </Router>
    </MotionConfig>
  );
}

export default App;
