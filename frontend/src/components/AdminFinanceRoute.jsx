import React from 'react';
import { motion as Motion } from 'framer-motion';
import AdminFinancePanel from './AdminFinancePanel';

const transition = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

const AdminFinanceRoute = (props) => (
  <Motion.div variants={transition} initial="initial" animate="animate" exit="exit">
    <React.Suspense fallback={<div className="admin-card">Chargement des obligations financières...</div>}>
      <AdminFinancePanel {...props} />
    </React.Suspense>
  </Motion.div>
);

export default AdminFinanceRoute;
