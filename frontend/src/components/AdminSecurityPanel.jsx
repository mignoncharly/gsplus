import { useCallback, useEffect, useState } from 'react';
import { Download, KeyRound, ShieldCheck, UserPlus } from 'lucide-react';

import './AdminSecurityPanel.css';
import './AdminFinancePanel.css';

import {
  adminAuditExportUrl,
  beginAdminTotp,
  changeAdminPassword,
  confirmAdminTotp,
  disableAdminTotp,
  getAdminAudit,
  getAdminSecurityAccounts,
  getAdminSecuritySessions,
  getAdminSignInActivity,
  getAdminTotpStatus,
  inviteAdminSecurityAccount,
  revokeAdminSecuritySession,
  setAdminSecurityAccountActive,
  setAdminSecurityAccountRole,
  setAdminSecurityPermissions,
} from '../lib/api';

const when = (value) => value ? new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Douala',
}).format(new Date(value)) : '—';

const PERMISSION_LABELS = {
  PAYMENT_VIEW: 'Voir les paiements', PAYMENT_DECIDE: 'Décider un paiement', PAYMENT_ADD: 'Ajouter un paiement',
  REFUND_MANAGE: 'Gérer les remboursements', RESERVATION_CONFIRM: 'Confirmer une réservation',
  RESERVATION_REJECT: 'Refuser une réservation', RESERVATION_CANCEL: 'Annuler une réservation',
  RESERVATION_RESCHEDULE: 'Gérer le planning', WITHDRAWAL_MANAGE: 'Gérer les retraits',
  IMAGE_CONSENT_MANAGE: 'Gérer les consentements image', DATA_GOVERNANCE_MANAGE: 'Gérer les droits sur les données',
  VERIFY_AND_CONFIRM: 'Vérifier et confirmer', RESERVATION_CLOSE: 'Clôturer une séance',
  RESERVATION_EARLY_CLOSE_OVERRIDE: 'Clôture anticipée', DELIVERY_PUBLISH: 'Publier les livraisons',
  MEDIA_RIGHTS_MANAGE: 'Gérer les droits médias', PACKAGE_PUBLISH: 'Publier offres et contenus',
  QA_NOTIFICATION_OVERRIDE: 'Dérogation notifications QA',
};

const emptyAudit = { items: [], meta: { total: 0, commands: [], commandTotal: 0, facets: [] } };

export default function AdminSecurityPanel({ adminUser, onAdminUserChange, onFeedback }) {
  const owner = adminUser?.role === 'OWNER';
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [accounts, setAccounts] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [sessions, setSessions] = useState({ items: [], meta: { total: 0, limit: 25, offset: 0 } });
  const [sessionFilters, setSessionFilters] = useState({ q: '', status: 'active', limit: 25, offset: 0 });
  const [totp, setTotp] = useState({ enabled: Boolean(adminUser?.twoFactorEnabled), recoveryCodesRemaining: 0 });
  const [enrolment, setEnrolment] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [signIns, setSignIns] = useState(null);
  const [audit, setAudit] = useState(emptyAudit);
  const [auditFilters, setAuditFilters] = useState({ q: '', action: '', from: '', to: '', limit: 50, offset: 0 });
  const [invitationLink, setInvitationLink] = useState('');
  const [busy, setBusy] = useState('');

  const report = useCallback((type, message) => onFeedback?.({ tab: 'account', type, message }), [onFeedback]);
  const reload = useCallback(async () => {
    const totpState = await getAdminTotpStatus();
    const sessionRows = totpState.enabled ? await getAdminSecuritySessions(owner, sessionFilters) : { items: [], meta: { total: 0, limit: 25, offset: 0 } };
    setSessions(sessionRows);
    setTotp(totpState);
    if (owner && totpState.enabled) {
      const [accountResult, activity, auditResult] = await Promise.all([
        getAdminSecurityAccounts(), getAdminSignInActivity(), getAdminAudit(auditFilters),
      ]);
      setAccounts(accountResult.items);
      setPermissions(accountResult.permissions);
      setSignIns(activity);
      setAudit(auditResult);
    }
  }, [auditFilters, owner, sessionFilters]);

  useEffect(() => { reload().catch((error) => report('error', error.message)); }, [reload, report]);

  const perform = async (label, action) => {
    setBusy(label);
    try {
      await action();
      await reload();
      report('success', `${label} terminé avec succès.`);
    } catch (error) {
      report('error', error.message || `Échec : ${label}`);
    } finally {
      setBusy('');
    }
  };

  const submitPassword = (event) => {
    event.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) return report('error', 'La confirmation du mot de passe ne correspond pas.');
    return perform('Modification du mot de passe', async () => {
      const updated = await changeAdminPassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      onAdminUserChange?.(updated);
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    });
  };

  const submitInvite = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    return perform('Invitation du compte', async () => {
      const result = await inviteAdminSecurityAccount({ email: data.get('email'), name: data.get('name'), role: data.get('role') });
      setInvitationLink(`${window.location.origin}${result.invitationPath}`);
      form.reset();
    });
  };

  const togglePermission = (account, permission) => {
    const current = new Set(account.grantedPermissions);
    if (current.has(permission)) current.delete(permission); else current.add(permission);
    return perform('Mise à jour des droits', () => setAdminSecurityPermissions(account.id, [...current]));
  };

  const confirmTotp = () => perform('Activation de la double authentification', async () => {
    const result = await confirmAdminTotp(totpCode);
    setRecoveryCodes(result.recoveryCodes);
    setEnrolment(null);
    setTotpCode('');
    onAdminUserChange?.({ ...adminUser, twoFactorEnabled: true });
  });

  const applyAuditFilters = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setAuditFilters({ q: form.get('q'), action: form.get('action'), from: form.get('from'), to: form.get('to'), limit: 50, offset: 0 });
  };

  return (
    <div className="admin-security-panel">
      <div className="admin-page-header"><h1>Gouvernance & <span>sécurité</span></h1></div>

      <div className="admin-security-grid">
        <section className="admin-card">
          <h2><KeyRound size={20} /> Mot de passe</h2>
          <p className="admin-security-muted">Compte : <strong>{adminUser?.email}</strong>. La modification retire toutes les autres sessions.</p>
          <form className="admin-security-form" onSubmit={submitPassword}>
            <label>Mot de passe actuel<input className="form-input" type="password" autoComplete="current-password" minLength="8" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} required /></label>
            <label>Nouveau mot de passe<input className="form-input" type="password" autoComplete="new-password" minLength="12" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} required /></label>
            <label>Confirmation<input className="form-input" type="password" autoComplete="new-password" minLength="12" value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} required /></label>
            <button className="btn btn-primary" disabled={Boolean(busy)}>Modifier le mot de passe</button>
          </form>
        </section>

        <section className="admin-card">
          <h2><ShieldCheck size={20} /> Double authentification</h2>
          <p className="admin-security-muted">État : <span className={`admin-pill ${totp.enabled ? 'pill-active' : 'pill-pending'}`}>{totp.enabled ? 'Activée' : 'Non activée'}</span></p>
          {totp.enabled ? (
            <>
              <p>{totp.recoveryCodesRemaining} code(s) de récupération disponible(s).</p>
              <div className="admin-security-inline"><input className="form-input" inputMode="numeric" placeholder="Code à 6 chiffres" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} /><button className="btn btn-secondary" disabled={Boolean(busy) || !/^\d{6}$/.test(totpCode)} onClick={() => perform('Désactivation de la double authentification', async () => { await disableAdminTotp(totpCode); setTotpCode(''); onAdminUserChange?.({ ...adminUser, twoFactorEnabled: false }); })}>Désactiver</button></div>
            </>
          ) : enrolment ? (
            <div className="admin-security-enrolment">
              <p>Ajoutez ce secret dans votre application d’authentification, puis saisissez le code affiché.</p>
              <code>{enrolment.secret}</code>
              <details><summary>URI de configuration</summary><code>{enrolment.uri}</code></details>
              <div className="admin-security-inline"><input className="form-input" inputMode="numeric" maxLength="6" placeholder="123456" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} /><button className="btn btn-primary" disabled={Boolean(busy) || !/^\d{6}$/.test(totpCode)} onClick={confirmTotp}>Confirmer</button></div>
            </div>
          ) : <button className="btn btn-primary" disabled={Boolean(busy)} onClick={() => perform('Préparation de la double authentification', async () => setEnrolment(await beginAdminTotp()))}>Configurer</button>}
          {recoveryCodes.length > 0 && <div className="admin-recovery-codes" role="alert"><strong>Copiez ces codes maintenant : ils ne seront plus affichés.</strong><code>{recoveryCodes.join('\n')}</code></div>}
        </section>
      </div>

      <section className="admin-card">
        <h2>Sessions actives</h2>
        <div className="admin-table-wrap admin-security-sessions"><table className="admin-table"><thead><tr><th>Compte / appareil</th><th>Adresse IP</th><th>Dernière activité</th><th>Expiration</th><th>État</th><th>Action</th></tr></thead><tbody>
          {sessions.items.map((session) => <tr key={session.id}><td><strong>{session.admin?.name}</strong><small>{session.userAgent || 'Appareil non identifié'}</small></td><td>{session.ipAddress || '—'}</td><td>{when(session.lastSeenAt)}</td><td>{when(session.expiresAt)}</td><td><span className={`admin-pill ${session.isCurrentlyValid ? 'pill-active' : 'pill-archived'}`}>{session.isCurrentlyValid ? 'Active' : 'Retirée / expirée'}</span></td><td>{session.isCurrentlyValid && <button className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => perform('Révocation de la session', () => revokeAdminSecuritySession(session.id))}>Retirer</button>}</td></tr>)}
          {!sessions.items.length && <tr><td colSpan="6">Aucune session enregistrée.</td></tr>}
        </tbody></table></div>
        <div className="admin-action-row"><label>Filtrer <select className="form-input" value={sessionFilters.status} onChange={(event) => setSessionFilters({ ...sessionFilters, status: event.target.value, offset: 0 })}><option value="active">Actives</option><option value="revoked">Retirées</option><option value="expired">Expirées</option></select></label><label>Recherche<input className="form-input" value={sessionFilters.q} onChange={(event) => setSessionFilters({ ...sessionFilters, q: event.target.value, offset: 0 })} placeholder="Compte, IP, appareil" /></label><span>{sessions.meta.total} session(s)</span><button className="btn btn-secondary" disabled={sessionFilters.offset === 0} onClick={() => setSessionFilters({ ...sessionFilters, offset: Math.max(0, sessionFilters.offset - sessionFilters.limit) })}>Précédent</button><button className="btn btn-secondary" disabled={sessionFilters.offset + sessionFilters.limit >= sessions.meta.total} onClick={() => setSessionFilters({ ...sessionFilters, offset: sessionFilters.offset + sessionFilters.limit })}>Suivant</button></div>
      </section>

      {owner && <>
        <section className="admin-card">
          <h2><UserPlus size={20} /> Comptes nommés</h2>
          <form className="admin-form-grid" onSubmit={submitInvite}><label>Nom<input className="form-input" name="name" maxLength="120" required /></label><label>Adresse e-mail<input className="form-input" name="email" type="email" required /></label><label>Rôle<select className="form-input" name="role"><option value="STAFF">Équipe</option><option value="OWNER">Propriétaire</option></select></label><button className="btn btn-primary" disabled={Boolean(busy)}>Créer l’invitation</button></form>
          {invitationLink && <div className="admin-invitation-link" role="status"><strong>Lien à transmettre une seule fois :</strong><input className="form-input" readOnly value={invitationLink} onFocus={(e) => e.target.select()} /></div>}
          <div className="admin-account-list">{accounts.map((account) => <article className="admin-account-card" key={account.id}>
            <header><div><h3>{account.name}</h3><p>{account.email}</p></div><span className={`admin-pill ${account.isActive ? 'pill-active' : 'pill-archived'}`}>{account.invitationPending ? 'Invitation en attente' : account.isActive ? 'Actif' : 'Désactivé'}</span></header>
            <div className="admin-security-inline"><label>Rôle<select className="form-input" value={account.role} disabled={Boolean(busy) || account.id === adminUser.id} onChange={(e) => perform('Changement de rôle', () => setAdminSecurityAccountRole(account.id, e.target.value))}><option value="STAFF">Équipe</option><option value="OWNER">Propriétaire</option></select></label><button className="btn btn-secondary" disabled={Boolean(busy) || account.id === adminUser.id} onClick={() => perform(account.isActive ? 'Désactivation du compte' : 'Activation du compte', () => setAdminSecurityAccountActive(account.id, !account.isActive))}>{account.isActive ? 'Désactiver' : 'Réactiver'}</button></div>
            <p className="admin-security-muted">Dernière connexion : {when(account.lastSignInAt)} · {account.activeSessionCount} session(s)</p>
            {account.role === 'STAFF' && <fieldset className="admin-permission-grid"><legend>Droits supplémentaires</legend>{permissions.filter((permission) => !account.rolePermissions.includes(permission)).map((permission) => <label key={permission}><input type="checkbox" checked={account.grantedPermissions.includes(permission)} disabled={Boolean(busy)} onChange={() => togglePermission(account, permission)} /> {PERMISSION_LABELS[permission] || permission}</label>)}</fieldset>}
          </article>)}</div>
        </section>

        <section className="admin-card">
          <h2>Alertes de connexion</h2>
          <p>{signIns?.failed ?? 0} échec(s) sur {signIns?.total ?? 0} tentative(s) dans les dernières {signIns?.windowHours ?? 24} h.</p>
          {(signIns?.alerts ?? []).map((alert) => <div className="admin-security-alert" role="alert" key={`${alert.code}:${alert.detail}`}><strong>{alert.count} tentatives</strong> — {alert.detail}</div>)}
          {!signIns?.alerts?.length && <p className="admin-security-muted">Aucune répétition inhabituelle détectée.</p>}
        </section>

        <section className="admin-card">
          <h2>Journal d’audit</h2>
          <form className="admin-form-grid" onSubmit={applyAuditFilters}><label>Recherche<input className="form-input" name="q" defaultValue={auditFilters.q} /></label><label>Action<select className="form-input" name="action" defaultValue={auditFilters.action}><option value="">Toutes</option>{(audit.meta.facets ?? []).map((facet) => <option key={facet.action} value={facet.action}>{facet.action} ({facet.count})</option>)}</select></label><label>Du<input className="form-input" type="date" name="from" defaultValue={auditFilters.from} /></label><label>Au<input className="form-input" type="date" name="to" defaultValue={auditFilters.to} /></label><button className="btn btn-primary">Filtrer</button></form>
          <div className="admin-action-row"><a className="btn btn-secondary" href={adminAuditExportUrl(false, auditFilters)}><Download size={16} /> Exporter le journal</a><a className="btn btn-secondary" href={adminAuditExportUrl(true, auditFilters)}><Download size={16} /> Exporter les commandes</a></div>
          <h3>{audit.meta.total ?? 0} événement(s)</h3><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Date</th><th>Auteur</th><th>Action</th><th>Objet</th></tr></thead><tbody>{audit.items.map((item) => <tr key={item.id}><td>{when(item.createdAt)}</td><td>{item.adminUser?.name || 'Système'}<small>{item.adminUser?.email}</small></td><td><code>{item.action}</code></td><td>{item.entityType}<small>{item.entityId}</small></td></tr>)}</tbody></table></div>
          <div className="admin-action-row"><span>Page {Math.floor((auditFilters.offset || 0) / auditFilters.limit) + 1}</span><button className="btn btn-secondary" disabled={auditFilters.offset === 0} onClick={() => setAuditFilters({ ...auditFilters, offset: Math.max(0, auditFilters.offset - auditFilters.limit) })}>Précédent</button><button className="btn btn-secondary" disabled={auditFilters.offset + auditFilters.limit >= Math.max(audit.meta.total ?? 0, audit.meta.commandTotal ?? 0)} onClick={() => setAuditFilters({ ...auditFilters, offset: auditFilters.offset + auditFilters.limit })}>Suivant</button></div>
          <h3>Commandes versionnées ({audit.meta.commandTotal ?? 0})</h3><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Date</th><th>Auteur</th><th>Action</th><th>Objet</th><th>État</th></tr></thead><tbody>{(audit.meta.commands ?? []).map((item) => <tr key={item.id}><td>{when(item.createdAt)}</td><td>{item.adminUser?.name || 'Système'}</td><td><code>{item.action}</code></td><td>{item.entityType}<small>{item.entityId}</small></td><td><span className={`admin-pill pill-${item.status.toLowerCase()}`}>{item.status}</span></td></tr>)}</tbody></table></div>
        </section>
      </>}
    </div>
  );
}
