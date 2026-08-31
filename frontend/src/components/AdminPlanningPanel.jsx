import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, CalendarDays, Clock, Plus, Trash2 } from 'lucide-react';

import {
  deleteAdminScheduleException,
  getAdminBookingRules,
  getAdminBusinessHours,
  getAdminCalendarHealth,
  getAdminCalendarSyncLogs,
  getAdminPlanning,
  getAdminScheduleExceptions,
  saveAdminBookingRule,
  testAdminCalendarScheduleSync,
  saveAdminBusinessHour,
  saveAdminScheduleException,
} from '../lib/api';
import { addBusinessDays, businessDateKey, formatBusinessDateTime } from '../lib/business-time';
import { statusLabel } from '../lib/status-labels';
import './AdminPlanningPanel.css';

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const RANGES = [
  { key: 'day', label: 'Jour', days: 1 },
  { key: 'week', label: 'Semaine', days: 7 },
  { key: 'month', label: 'Mois', days: 31 },
];

const breaksLabel = (breaks) => (Array.isArray(breaks) && breaks.length
  ? breaks.map((pause) => `${pause.start}–${pause.end}`).join(', ')
  : 'Aucune');

const AdminPlanningPanel = ({ openActionDialog, runAction, blocks, onCreateBlock, onEditBlock, onDeleteBlock }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = RANGES.find((item) => item.key === searchParams.get('vue')) ?? RANGES[1];
  const anchor = searchParams.get('debut') || businessDateKey(new Date());
  const calendarStatuses = searchParams.getAll('calendarStatus');
  const calendarStatusKey = calendarStatuses.join(',');

  const [hours, setHours] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [rules, setRules] = useState(null);
  const [planning, setPlanning] = useState(null);
  const [health, setHealth] = useState(null);
  const [calendarLogs, setCalendarLogs] = useState([]);
  const [calendarLogsMeta, setCalendarLogsMeta] = useState({ total: 0 });
  const [error, setError] = useState('');

  const window_ = useMemo(() => ({ from: anchor, to: addBusinessDays(anchor, range.days - 1) }), [anchor, range.days]);

  // A single fetch, re-run by bumping a token, rather than the same block written twice.
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getAdminBusinessHours(),
      getAdminScheduleExceptions({ from: window_.from }),
      getAdminBookingRules(),
      getAdminPlanning(window_.from, window_.to),
      getAdminCalendarHealth(),
      calendarStatuses.length ? getAdminCalendarSyncLogs({ status: calendarStatuses, limit: 50 }) : Promise.resolve({ items: [], meta: { total: 0 } }),
    ])
      .then(([hourRows, exceptionRows, ruleData, planningData, healthData, logsResult]) => {
        if (cancelled) return;
        setHours(hourRows);
        setExceptions(exceptionRows);
        setRules(ruleData);
        setPlanning(planningData);
        setHealth(healthData);
        setCalendarLogs(logsResult.items);
        setCalendarLogsMeta(logsResult.meta);
        setError('');
      })
      .catch((loadError) => { if (!cancelled) setError(loadError.message || 'Impossible de charger le planning.'); });
    return () => { cancelled = true; };
  }, [window_.from, window_.to, calendarStatusKey, reloadToken]);

  const move = (direction) => {
    const params = new URLSearchParams(searchParams);
    params.set('debut', addBusinessDays(anchor, direction * range.days));
    setSearchParams(params);
  };

  const setRange = (key) => {
    const params = new URLSearchParams(searchParams);
    params.set('vue', key);
    setSearchParams(params);
  };

  const editHours = (day) => openActionDialog({
    title: `Horaires — ${DAY_NAMES[day.dayOfWeek]}`,
    summary: day.isClosed ? 'Actuellement fermé' : `Actuellement ${day.opensAt} – ${day.closesAt}`,
    consequence: 'La disponibilité publique reflétera la nouvelle règle immédiatement.',
    confirmLabel: 'Enregistrer les horaires',
    fields: [
      { name: 'isClosed', label: 'Jour d’ouverture', type: 'select', required: true, defaultValue: day.isClosed ? 'true' : 'false',
        options: [{ value: 'false', label: 'Ouvert' }, { value: 'true', label: 'Fermé' }] },
      { name: 'opensAt', label: 'Ouverture (HH:MM)', defaultValue: day.opensAt || '09:00' },
      { name: 'closesAt', label: 'Fermeture (HH:MM)', defaultValue: day.closesAt || '18:00' },
      { name: 'breaks', label: 'Pauses, une par ligne au format 12:30-13:30', type: 'textarea', rows: 3,
        defaultValue: (day.breaks || []).map((pause) => `${pause.start}-${pause.end}`).join('\n') },
    ],
    onConfirm: async (values) => {
      const parsed = String(values.breaks || '').split('\n').map((line) => line.trim()).filter(Boolean)
        .map((line) => {
          const [start, end] = line.split('-').map((part) => part.trim());
          return { start, end };
        });
      const success = await runAction('Horaires du studio', () => saveAdminBusinessHour(day.dayOfWeek, {
        dayOfWeek: day.dayOfWeek,
        opensAt: values.opensAt.trim(),
        closesAt: values.closesAt.trim(),
        isClosed: values.isClosed === 'true',
        breaks: parsed,
      }), true);
      if (success) reload();
    },
  });

  const addException = (date = anchor) => openActionDialog({
    title: 'Ajouter une exception datée',
    summary: 'Jour férié, fermeture exceptionnelle ou horaires particuliers',
    consequence: 'Cette date remplacera immédiatement le rythme hebdomadaire de disponibilité publique.',
    confirmLabel: 'Enregistrer l’exception',
    fields: [
      { name: 'date', label: 'Date (AAAA-MM-JJ)', type: 'date', required: true, defaultValue: date },
      { name: 'isClosed', label: 'Type', type: 'select', required: true, defaultValue: 'true',
        options: [{ value: 'true', label: 'Fermé toute la journée' }, { value: 'false', label: 'Horaires particuliers' }] },
      { name: 'opensAt', label: 'Ouverture si horaires particuliers', defaultValue: '' },
      { name: 'closesAt', label: 'Fermeture si horaires particuliers', defaultValue: '' },
      { name: 'reason', label: 'Motif', type: 'textarea', required: true },
    ],
    onConfirm: async (values) => {
      const closed = values.isClosed === 'true';
      const success = await runAction('Exception de calendrier', () => saveAdminScheduleException({
        date: values.date,
        isClosed: closed,
        opensAt: closed ? null : values.opensAt.trim() || null,
        closesAt: closed ? null : values.closesAt.trim() || null,
        reason: values.reason.trim(),
      }), true);
      if (success) reload();
    },
  });

  const removeException = (exception) => openActionDialog({
    title: 'Supprimer l’exception',
    summary: `${exception.date} · ${exception.reason}`,
    consequence: 'Le rythme hebdomadaire reprendra pour cette date.',
    confirmLabel: 'Supprimer', destructive: true, fields: [],
    onConfirm: async () => {
      const success = await runAction('Suppression d’exception', () => deleteAdminScheduleException(exception.date), true);
      if (success) reload();
    },
  });

  const editRules = (packageRule = null, package_ = null) => {
    const current = packageRule ?? rules?.global ?? {};
    const packageName = package_?.name ?? packageRule?.package?.name;
    const isOverride = Boolean(package_ || packageRule);
    openActionDialog({
      title: isOverride ? `Règles — ${packageName}` : 'Règles de réservation',
      summary: isOverride ? 'Dérogation pour cette formule uniquement' : 'Valeurs par défaut appliquées à toutes les formules',
      consequence: isOverride
        ? 'Un champ laissé vide reprend la valeur générale. La disponibilité publique est recalculée immédiatement.'
        : 'Un champ laissé vide signifie « aucune limite », comme avant la mise en place de ces règles.',
      confirmLabel: 'Enregistrer les règles',
      fields: [
        { name: 'minNoticeMinutes', label: 'Délai minimum avant une séance, en minutes', type: 'number', min: '0', defaultValue: current.minNoticeMinutes ?? '' },
        { name: 'horizonDays', label: 'Horizon de réservation, en jours', type: 'number', min: '1', defaultValue: current.horizonDays ?? '' },
        { name: 'dailyCapacity', label: 'Séances maximum par jour', type: 'number', min: '1', defaultValue: current.dailyCapacity ?? '' },
        { name: 'bufferMinutes', label: 'Battement entre deux séances, en minutes', type: 'number', min: '0', defaultValue: current.bufferMinutes ?? '' },
      ],
      onConfirm: async (values) => {
        const number = (value) => (String(value).trim() === '' ? null : Number(value));
        const success = await runAction('Règles de réservation', () => saveAdminBookingRule({
          packageId: package_?.id ?? packageRule?.packageId ?? null,
          minNoticeMinutes: number(values.minNoticeMinutes),
          horizonDays: number(values.horizonDays),
          dailyCapacity: number(values.dailyCapacity),
          bufferMinutes: number(values.bufferMinutes),
        }), true);
        if (success) reload();
      },
    });
  };

  const effectivePackageRule = (package_) => {
    const override = rules?.perPackage?.find((item) => item.packageId === package_.id);
    return {
      ...rules?.effectiveGlobal,
      ...Object.fromEntries(Object.entries(override ?? {}).filter(([key, value]) => (
        ['minNoticeMinutes', 'horizonDays', 'dailyCapacity', 'bufferMinutes'].includes(key) && value !== null
      ))),
    };
  };

  const testCalendarSchedule = async () => {
    const success = await runAction('Test de synchronisation Cal.com', testAdminCalendarScheduleSync, true);
    if (success) reload();
  };

  const entriesFor = (date) => {
    if (!planning) return { reservations: [], blocks: [], intents: [] };
    const onDate = (value) => businessDateKey(new Date(value)) === date;
    return {
      reservations: planning.reservations.filter((item) => onDate(item.startAt)),
      blocks: planning.blocks.filter((item) => onDate(item.startAt)),
      intents: planning.intents.filter((item) => onDate(item.startAt)),
    };
  };

  return (
    <>
      {error && <div className="admin-feedback error" role="alert">{error}</div>}

      <section className="admin-card admin-health" aria-labelledby="calcom-health">
        <div className="admin-agenda-head"><h2 id="calcom-health"><Activity size={18} aria-hidden="true" /> Santé Cal.com</h2><button type="button" className="btn btn-secondary admin-sm-btn" onClick={testCalendarSchedule}>Tester la synchronisation</button></div>
        {health ? (
          <dl className="admin-health-grid">
            <div><dt>État</dt><dd className={health.healthy ? 'admin-health-ok' : 'admin-health-warn'}>{health.healthy ? 'Opérationnel' : 'Anomalies à traiter'}</dd></div>
            <div><dt>Dernier succès</dt><dd>{health.lastSuccessAt ? formatBusinessDateTime(health.lastSuccessAt) : 'Aucun'}</dd></div>
            <div><dt>Dernier échec</dt><dd>{health.lastFailureAt ? formatBusinessDateTime(health.lastFailureAt) : 'Aucun'}</dd></div>
            <div><dt>En attente</dt><dd>{health.pendingCount}</dd></div>
            <div><dt>En échec</dt><dd>{health.failingCount}</dd></div>
          </dl>
        ) : <p className="admin-table-empty">Chargement…</p>}
      </section>

      {calendarStatuses.length > 0 && (
        <section className="admin-card" aria-labelledby="calendar-log-list">
          <h2 id="calendar-log-list"><Activity size={18} aria-hidden="true" /> Opérations Cal.com ciblées</h2>
          <p><strong>{calendarLogsMeta.total}</strong> opération(s) correspondent aux statuts demandés.</p>
          {calendarLogs.length === 0 ? <p className="admin-table-empty">Aucune opération ne correspond à ces statuts.</p> : (
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Date</th><th>Réservation</th><th>Action</th><th>Statut</th><th>Tentatives</th><th>Erreur</th></tr></thead><tbody>{calendarLogs.map((log) => <tr key={log.id}><td>{formatBusinessDateTime(log.createdAt)}</td><td><code>{log.reservation?.reference || '—'}</code></td><td>{log.action}</td><td>{statusLabel(log.status)}</td><td>{log.attemptCount}/{log.maxAttempts}</td><td>{log.error || '—'}</td></tr>)}</tbody></table></div>
          )}
        </section>
      )}


      <section className="admin-card" aria-labelledby="agenda">
        <div className="admin-agenda-head">
          <h2 id="agenda"><CalendarDays size={18} aria-hidden="true" /> Agenda</h2>
          <div className="admin-agenda-controls">
            {RANGES.map((item) => (
              <button key={item.key} type="button"
                className={`btn admin-sm-btn ${range.key === item.key ? 'btn-primary' : 'btn-secondary'}`}
                aria-pressed={range.key === item.key}
                onClick={() => setRange(item.key)}>{item.label}</button>
            ))}
            <button type="button" className="btn btn-secondary admin-sm-btn" onClick={() => move(-1)}>Précédent</button>
            <button type="button" className="btn btn-secondary admin-sm-btn" onClick={() => move(1)}>Suivant</button>
          </div>
        </div>

        {!planning ? <p className="admin-table-empty">Chargement de l’agenda…</p> : (
          <ol className="admin-agenda">
            {planning.days.map((day) => {
              const entries = entriesFor(day.date);
              const empty = entries.reservations.length + entries.blocks.length + entries.intents.length === 0;
              return (
                <li key={day.date} className={`admin-agenda-day ${day.isClosed ? 'is-closed' : ''} ${day.date === planning.today ? 'is-today' : ''}`}>
                  <div className="admin-agenda-day__head">
                    <strong>{DAY_NAMES[day.dayOfWeek]} {day.date}</strong>
                    <span>{day.isClosed ? `Fermé${day.reason ? ` — ${day.reason}` : ''}` : `${day.opensAt} – ${day.closesAt}`}</span>
                  </div>
                  <div className="admin-agenda-day-actions">
                    <button type="button" className="btn btn-secondary admin-sm-btn"
                      onClick={() => onCreateBlock({ date: day.date, startAt: day.opensAt || '09:00', endAt: day.closesAt || '18:00' })}>
                      Bloquer ce jour
                    </button>
                    <button type="button" className="btn btn-secondary admin-sm-btn" onClick={() => addException(day.date)}>
                      Exception
                    </button>
                  </div>
                  {empty ? <p className="admin-agenda-empty">Aucune séance.</p> : (
                    <ul className="admin-agenda-entries">
                      {entries.reservations.map((item) => (
                        <li key={item.id} className="admin-agenda-entry admin-agenda-entry--reservation">
                          <span>{formatBusinessDateTime(item.startAt)}</span>
                          <strong>{item.reference}</strong>
                          <span>{(item.snapshot ?? item.customer)?.firstName} {(item.snapshot ?? item.customer)?.lastName} · {item.package?.name}</span>
                          <span className={`admin-pill pill-${String(item.status).toLowerCase()}`}>{statusLabel(item.status)}</span>
                        </li>
                      ))}
                      {entries.intents.map((item) => (
                        <li key={item.id} className="admin-agenda-entry admin-agenda-entry--hold">
                          <span>{formatBusinessDateTime(item.startAt)}</span>
                          <strong>Maintien temporaire</strong>
                          <span>{item.package?.name} · expire {formatBusinessDateTime(item.expiresAt)}</span>
                        </li>
                      ))}
                      {entries.blocks.map((item) => (
                        <li key={item.id} className="admin-agenda-entry admin-agenda-entry--block">
                          <span>{formatBusinessDateTime(item.startAt)}</span>
                          <strong>Blocage</strong>
                          <span>{item.reason || 'Sans motif'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="admin-card" aria-labelledby="weekly-hours">
        <h2 id="weekly-hours"><Clock size={18} aria-hidden="true" /> Horaires hebdomadaires</h2>
        <p className="admin-record-hint">Modifiables sans développement. Le public suit la règle enregistrée immédiatement.</p>
        <ul className="admin-hours-list">
          {Array.from({ length: 7 }, (_item, dayOfWeek) => hours.find((hour) => hour.dayOfWeek === dayOfWeek) ?? { dayOfWeek, isClosed: true, opensAt: null, closesAt: null, breaks: null }).map((day) => (
            <li key={day.dayOfWeek}>
              <div><strong>{DAY_NAMES[day.dayOfWeek]}</strong><small>{day.isClosed ? 'Fermé' : `${day.opensAt} – ${day.closesAt} · pauses : ${breaksLabel(day.breaks)}`}</small></div>
              <button type="button" className="btn btn-secondary admin-sm-btn" aria-label={`Modifier les horaires du ${DAY_NAMES[day.dayOfWeek].toLowerCase()}`} onClick={() => editHours(day)}>Modifier</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-card" aria-labelledby="exceptions">
        <div className="admin-agenda-head">
          <h2 id="exceptions">Exceptions datées</h2>
          <button type="button" className="btn btn-primary admin-sm-btn" onClick={() => addException()}><Plus size={14} /> Ajouter</button>
        </div>
        {exceptions.length === 0 ? <p className="admin-table-empty">Aucune exception enregistrée.</p> : (
          <ul className="admin-hours-list">
            {exceptions.map((exception) => (
              <li key={exception.id}>
                <div><strong>{exception.date}</strong><small>{exception.isClosed ? 'Fermé' : `${exception.opensAt} – ${exception.closesAt}`} · {exception.reason}</small></div>
                <button type="button" className="btn btn-secondary admin-sm-btn text-danger" onClick={() => removeException(exception)}><Trash2 size={14} /> Supprimer</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-card" aria-labelledby="booking-rules">
        <div className="admin-agenda-head">
          <div><h2 id="booking-rules">Règles de réservation</h2><p className="admin-record-hint">La règle générale s’applique par défaut ; une dérogation ne modifie qu’une formule.</p></div>
          <button type="button" className="btn btn-secondary admin-sm-btn" aria-label="Modifier les règles générales de réservation" onClick={() => editRules()}>Modifier le défaut</button>
        </div>
        {rules ? <>
          <dl className="admin-health-grid">
            <div><dt>Délai minimum</dt><dd>{rules.effectiveGlobal.minNoticeMinutes ? `${rules.effectiveGlobal.minNoticeMinutes} min` : 'Aucun'}</dd></div>
            <div><dt>Horizon</dt><dd>{rules.effectiveGlobal.horizonDays ? `${rules.effectiveGlobal.horizonDays} jours` : 'Illimité'}</dd></div>
            <div><dt>Capacité quotidienne</dt><dd>{rules.effectiveGlobal.dailyCapacity ?? 'Illimitée'}</dd></div>
            <div><dt>Battement</dt><dd>{rules.effectiveGlobal.bufferMinutes ? `${rules.effectiveGlobal.bufferMinutes} min` : 'Aucun'}</dd></div>
          </dl>
          <ul className="admin-hours-list admin-package-rules">
            {rules.packages.map((package_) => {
              const override = rules.perPackage.find((item) => item.packageId === package_.id) ?? null;
              const effective = effectivePackageRule(package_);
              return <li key={package_.id}>
                <div><strong>{package_.name}</strong><small>{override
                  ? `Dérogation : ${effective.minNoticeMinutes ? `${effective.minNoticeMinutes} min de délai` : 'sans délai'} · ${effective.horizonDays ? `${effective.horizonDays} j` : 'horizon illimité'} · ${effective.dailyCapacity ?? 'capacité illimitée'}`
                  : 'Utilise les règles générales'}</small></div>
                <button type="button" className="btn btn-secondary admin-sm-btn" onClick={() => editRules(override, package_)}>{override ? 'Modifier la dérogation' : 'Créer une dérogation'}</button>
              </li>;
            })}
          </ul>
        </> : <p className="admin-table-empty">Chargement…</p>}
      </section>
      <section className="admin-card" aria-labelledby="blocks">
        <div className="admin-agenda-head">
          <h2 id="blocks">Blocages ponctuels</h2>
          <button type="button" className="btn btn-primary admin-sm-btn" onClick={onCreateBlock}><Plus size={14} /> Bloquer un créneau</button>
        </div>
        {blocks.length === 0 ? <p className="admin-table-empty">Aucun blocage de calendrier configuré.</p> : (
          <ul className="admin-hours-list">
            {blocks.map((block) => (
              <li key={block.id}>
                <div>
                  <strong>{formatBusinessDateTime(block.startAt)} — {formatBusinessDateTime(block.endAt)}</strong>
                  <small>Motif : {block.reason || 'Non spécifié'}</small>
                </div>
                <div className="admin-action-row">
                  <button type="button" className="btn btn-secondary admin-sm-btn"
                    aria-label={`Modifier le blocage du ${formatBusinessDateTime(block.startAt)}`}
                    onClick={() => onEditBlock(block)}>Modifier</button>
                  <button type="button" className="btn btn-secondary admin-sm-btn text-danger" onClick={() => onDeleteBlock(block)}>
                    <Trash2 size={14} /> Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
};

export default AdminPlanningPanel;
