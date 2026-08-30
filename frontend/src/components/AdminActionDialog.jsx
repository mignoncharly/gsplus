import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { validationErrorsFromApi, validationSummaryForApiError } from '../lib/form-errors';
import './AdminActionDialog.css';

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const initialValues = (fields) => Object.fromEntries(
  fields.map((field) => [field.name, field.defaultValue ?? '']),
);

/**
 * A field may declare `visibleWhen(values)`; a hidden field is not shown and not
 * validated, so it can never block a form the operator cannot see. Its value stays in
 * state rather than being cleared, so switching a mode back finds what was typed still
 * there — which means the payload builder, not the dialog, decides what a hidden field
 * contributes.
 */
const isVisible = (field, values) => (typeof field.visibleWhen === 'function' ? Boolean(field.visibleWhen(values)) : true);

/** `required` may be a function of the other values, for a field that only matters in one mode. */
const isRequired = (field, values) => (typeof field.required === 'function' ? Boolean(field.required(values)) : Boolean(field.required));

const AdminActionDialog = ({ config, onClose }) => {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);
  const submittingRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const fields = useMemo(() => config?.fields || [], [config]);
  const [values, setValues] = useState(() => initialValues(fields));
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewFingerprint, setPreviewFingerprint] = useState('');

  useEffect(() => {
    if (!config) return undefined;
    returnFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      // Initial focus is a courtesy, not a claim. If someone has already moved into
      // the dialog by the time this frame runs, taking focus back would yank them out
      // of the field they chose.
      if (dialogRef.current?.contains(document.activeElement)) return;
      const initial = dialogRef.current?.querySelector('[data-dialog-initial-focus]');
      (initial || dialogRef.current)?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !submittingRef.current) {
        event.preventDefault();
        onCloseRef.current(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusableElements = Array.from(dialogRef.current?.querySelectorAll(focusableSelector) || []);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      returnFocusRef.current?.focus?.();
    };
  }, [config]);

  if (!config) return null;

  const previewRequired = Boolean(config.preview && (config.previewRequired?.(values) ?? true));

  const updateValue = (name, value) => {
    setValues((current) => {
      const next = { ...current, [name]: value };
      // A derived field follows its source until someone edits it by hand; after that it
      // is theirs. `deriveFrom` names the source, `derive` computes the value.
      for (const field of fields) {
        if (field.deriveFrom !== name || touched[field.name]) continue;
        next[field.name] = field.derive(value, next);
      }
      return next;
    });
    setTouched((current) => (current[name] ? current : { ...current, [name]: true }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
    setServerError('');
    setPreview(null);
    setPreviewFingerprint('');
  };

  const validate = () => {
    const next = {};
    for (const field of fields) {
      // A field the operator cannot see must not be able to block the form.
      if (!isVisible(field, values)) continue;
      const value = String(values[field.name] ?? '').trim();
      if (isRequired(field, values) && !value) next[field.name] = field.requiredMessage || 'Ce champ est obligatoire.';
      if (!next[field.name] && field.validate) {
        const issue = field.validate(values[field.name], values);
        if (issue) next[field.name] = issue;
      }
    }
    Object.assign(next, config.validate?.(values) || {});
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const loadPreview = async () => {
    if (!previewRequired || !validate()) return;
    setPreviewing(true);
    setServerError('');
    try {
      const result = await config.preview(values);
      setPreview(result);
      setPreviewFingerprint(JSON.stringify(values));
    } catch (error) {
      setServerError(validationSummaryForApiError(error) || 'L’aperçu n’a pas pu être généré.');
    } finally { setPreviewing(false); }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submittingRef.current || !validate()) return;
    if (previewRequired && (!preview || previewFingerprint !== JSON.stringify(values))) {
      setServerError('Générez et vérifiez l’aperçu client final avant de confirmer.');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setServerError('');
    try {
      await config.onConfirm(values);
      onClose(true);
    } catch (error) {
      const fieldMap = Object.fromEntries(fields.map((field) => [field.apiPath || field.name, field.name]));
      const apiFields = validationErrorsFromApi(error, fieldMap);
      if (Object.keys(apiFields).length > 0) {
        setErrors((current) => ({ ...current, ...apiFields }));
      }
      setServerError(validationSummaryForApiError(error) || 'L’action n’a pas pu être enregistrée.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-action-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onClose(false);
    }}>
      <section
        ref={dialogRef}
        className="admin-action-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={submitting}
        tabIndex="-1"
      >
        <button type="button" className="admin-modal-close" aria-label="Fermer la fenêtre" onClick={() => onClose(false)} disabled={submitting}>
          &times;
        </button>
        <h2 id={titleId}>{config.title}</h2>
        <div id={descriptionId} className="admin-action-dialog-context">
          {config.summary && <p><strong>Dossier :</strong> {config.summary}</p>}
          {config.consequence && <p><strong>Conséquence :</strong> {config.consequence}</p>}
        </div>
        <form onSubmit={submit} noValidate>
          <div className="admin-action-dialog-fields">
            {fields.filter((field) => isVisible(field, values)).map((field, index) => {
              const inputId = titleId + '-' + field.name;
              const errorId = inputId + '-error';
              const common = {
                id: inputId,
                name: field.name,
                value: values[field.name] ?? '',
                required: isRequired(field, values),
                disabled: submitting,
                className: 'form-input',
                'aria-invalid': Boolean(errors[field.name]),
                'aria-describedby': errors[field.name] ? errorId : undefined,
                'data-dialog-initial-focus': index === 0 ? '' : undefined,
                onChange: (event) => updateValue(field.name, event.target.value),
              };
              return (
                <div key={field.name} className={field.wide === false ? '' : 'admin-action-dialog-field-wide'}>
                  <label htmlFor={inputId}>{field.label}{isRequired(field, values) ? ' *' : ''}</label>
                  {field.type === 'select' ? (
                    <select {...common}>
                      {(field.options || []).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea {...common} rows={field.rows || 4} />
                  ) : (
                    <input {...common} type={field.type || 'text'} inputMode={field.inputMode} min={field.min} max={field.max} step={field.step} autoComplete={field.autoComplete || 'off'} />
                  )}
                  {field.help && <small className="admin-action-dialog-help">{field.help}</small>}
                  {errors[field.name] && <p id={errorId} className="form-field-error" role="alert">{errors[field.name]}</p>}
                </div>
              );
            })}
          </div>
          {previewRequired && (
            <section className="admin-action-dialog-preview" aria-live="polite">
              <div className="admin-action-dialog-preview__heading"><strong>Aperçu client final</strong><span>Seul cet aperçu quitte l’administration.</span></div>
              <button type="button" className="btn btn-secondary" onClick={loadPreview} disabled={submitting || previewing}>{previewing ? 'Génération…' : preview ? 'Actualiser l’aperçu' : 'Générer l’aperçu'}</button>
              {preview && <div className="admin-action-dialog-preview__content"><p><strong>Langue :</strong> {preview.locale.toUpperCase()} · <strong>Objet :</strong> {preview.subject}</p><p>{preview.preheader}</p><pre>{preview.text}</pre></div>}
            </section>
          )}
          {serverError && <p className="admin-action-dialog-error" role="alert">{serverError}</p>}
          <div className="admin-action-dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={() => onClose(false)} disabled={submitting}>Annuler</button>
            <button type="submit" className={config.destructive ? 'btn btn-secondary text-danger' : 'btn btn-primary'} disabled={submitting || previewing}>
              {submitting ? 'Enregistrement…' : config.confirmLabel || 'Confirmer'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default AdminActionDialog;
