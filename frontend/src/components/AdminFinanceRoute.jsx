import React from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';

import AdminFinancePanel from './AdminFinancePanel';
import AdminPaymentVerificationPanel from './AdminPaymentVerificationPanel';

const transition = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

// The report asks for one financial module with two files inside it: payments waiting
// to be verified, and refunds waiting to be executed. Each has its own address.
const SUBVIEWS = [
  { key: 'verification', label: 'Vérification', path: '/admin/paiements/verification' },
  { key: 'remboursements', label: 'Remboursements', path: '/admin/paiements/remboursements' },
];

const AdminFinanceRoute = ({ subview = 'verification', canManageRefunds = true, ...props }) => (
  <Motion.div variants={transition} initial="initial" animate="animate" exit="exit">
    <div className="admin-page-header"><h1>Paiements & <span>remboursements</span></h1></div>

    <nav className="admin-subview-nav" aria-label="Sous-vues du module financier">
      {SUBVIEWS.map((item) => (
        <Link
          key={item.key}
          to={item.path}
          className={`admin-subview-tab ${subview === item.key ? 'active' : ''}`}
          aria-current={subview === item.key ? 'page' : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>

    <React.Suspense fallback={<div className="admin-card">Chargement du module financier…</div>}>
      {subview === 'remboursements'
        ? (canManageRefunds
          ? <AdminFinancePanel {...props} />
          : <p className="admin-card admin-table-empty">Les remboursements sont réservés au rôle propriétaire.</p>)
        : <AdminPaymentVerificationPanel {...props} />}
    </React.Suspense>
  </Motion.div>
);

export default AdminFinanceRoute;
