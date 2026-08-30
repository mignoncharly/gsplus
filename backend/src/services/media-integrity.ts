import { MEDIA_RIGHTS_BASES } from './media-rights.js';

/**
 * §10 — media integrity, computed rather than stored.
 *
 * The columns these alerts read have always been nullable, and nothing ever raised them.
 * A picture with no dimensions, no thumbnail or no rights basis looks exactly like a
 * healthy one in the list, which is why the report asks for an actionable view rather
 * than another column.
 *
 * Severity is about consequence, not about how odd the data looks: `blocking` means the
 * item must not be published as it stands, `warning` means it will render but badly.
 */
export type MediaAlert = {
  code: string;
  severity: 'blocking' | 'warning';
  label: string;
  detail: string;
};

type MediaLike = {
  id: string;
  title: string;
  url: string;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  thumbnailUrl: string | null;
  thumbnailFileSize: number | null;
  mimeType: string | null;
  altText: string | null;
  rightsBasis: string | null;
  reservationId: string | null;
  isPublished: boolean;
  consentUsages?: { status: string }[];
};

const KNOWN_RIGHTS = new Set<string>(Object.values(MEDIA_RIGHTS_BASES));

export const mediaAlerts = (media: MediaLike): MediaAlert[] => {
  const alerts: MediaAlert[] = [];

  if (!media.rightsBasis || !KNOWN_RIGHTS.has(media.rightsBasis)) {
    alerts.push({
      code: 'RIGHTS_UNVERIFIED', severity: 'blocking', label: 'Droits non établis',
      detail: 'Aucune base de droits reconnue. Le média ne doit pas être publié tant que son origine n’est pas établie.',
    });
  } else if (media.rightsBasis === MEDIA_RIGHTS_BASES.customer) {
    const active = (media.consentUsages ?? []).some((usage) => usage.status === 'ACTIVE');
    if (!active) {
      alerts.push({
        code: 'CONSENT_INACTIVE', severity: 'blocking', label: 'Autorisation client inactive',
        detail: 'L’image vient d’une séance client et aucune autorisation active ne la couvre.',
      });
    }
  }

  // A zero-byte derivative is the failure the report names: the record looks complete and
  // the file behind it is empty.
  if (media.fileSize === 0) {
    alerts.push({
      code: 'EMPTY_FILE', severity: 'blocking', label: 'Fichier vide',
      detail: 'Le fichier stocké fait zéro octet. Le média est référencé mais rien ne s’affichera.',
    });
  }
  if (media.thumbnailUrl && media.thumbnailFileSize === 0) {
    alerts.push({
      code: 'EMPTY_THUMBNAIL', severity: 'warning', label: 'Miniature vide',
      detail: 'La miniature générée fait zéro octet ; les listes afficheront un cadre vide.',
    });
  }
  if (!media.thumbnailUrl) {
    alerts.push({
      code: 'THUMBNAIL_MISSING', severity: 'warning', label: 'Miniature absente',
      detail: 'Aucune miniature : les listes chargeront l’image entière.',
    });
  }
  if (media.width === null || media.height === null) {
    alerts.push({
      code: 'DIMENSIONS_UNKNOWN', severity: 'warning', label: 'Dimensions inconnues',
      detail: 'Sans largeur ni hauteur, la page réserve la mauvaise place et la mise en page saute au chargement.',
    });
  }
  if (media.fileSize === null) {
    alerts.push({
      code: 'FILE_SIZE_UNKNOWN', severity: 'warning', label: 'Poids inconnu',
      detail: 'Le poids du fichier n’a pas été relevé ; impossible de repérer une image trop lourde.',
    });
  }
  if (!media.altText?.trim()) {
    alerts.push({
      code: 'ALT_TEXT_MISSING', severity: 'warning', label: 'Texte alternatif absent',
      detail: 'Sans texte alternatif l’image est muette pour un lecteur d’écran et pour les moteurs.',
    });
  }

  return alerts;
};

/** An item already public while carrying a blocking alert is the case to surface first. */
export const mediaIntegrity = (media: MediaLike) => {
  const alerts = mediaAlerts(media);
  const blocking = alerts.filter((alert) => alert.severity === 'blocking');
  return {
    alerts,
    blockingCount: blocking.length,
    warningCount: alerts.length - blocking.length,
    publishable: blocking.length === 0,
    // Published *and* blocking: live on the site and should not be.
    isLiveWithBlockingAlert: media.isPublished && blocking.length > 0,
  };
};

export const mediaIntegritySummary = (items: MediaLike[]) => {
  const counts = new Map<string, { code: string; label: string; severity: MediaAlert['severity']; count: number }>();
  let liveWithBlocking = 0;
  for (const item of items) {
    const integrity = mediaIntegrity(item);
    if (integrity.isLiveWithBlockingAlert) liveWithBlocking += 1;
    for (const alert of integrity.alerts) {
      const entry = counts.get(alert.code) ?? { code: alert.code, label: alert.label, severity: alert.severity, count: 0 };
      entry.count += 1;
      counts.set(alert.code, entry);
    }
  }
  return {
    total: items.length,
    liveWithBlocking,
    // Blocking first, then by how many items carry it.
    alerts: [...counts.values()].sort((a, b) =>
      (a.severity === b.severity ? b.count - a.count : a.severity === 'blocking' ? -1 : 1)),
  };
};
