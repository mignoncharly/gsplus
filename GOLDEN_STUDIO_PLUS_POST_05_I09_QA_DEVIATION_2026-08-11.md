# Déviation QA POST-04 — hard bounces et I-09

Date d'observation : 11 août 2026.

## Statuts de preuve

- `I-09 TECHNICALLY OBSERVED`
- `I-09 CONTROLLED TEST DEFERRED`

## Cause et périmètre

L'ancienne adresse client QA utilisée par les deux réservations POST-04 n'était pas distribuable. Les envois réels E-01, E-05 et E-16 de QA-A et QA-B ont donc produit six hard bounces en production : deux E-01, deux E-05 et deux E-16.

Cette adresse était configurée comme destinataire client QA. Elle n'était pas et ne devient pas la boîte opérationnelle GSPLUS. Les destinataires internes I-* restent résolus depuis la configuration opérationnelle du business.

## Signal fournisseur et traitement

- Nombre de hard bounces : 6.
- Statut fournisseur normalisé : `PERMANENT_FAILURE`.
- Réponse SMTP conservée : `550_5_1`.
- Message sûr conservé : `Rejet permanent signalé par le serveur destinataire.`
- Nombre de I-09 générés : 6.
- État actuel des six I-09 : `SENT`.

Le poller Zoho SMTP Logs a rapproché les six retours avec les six notifications client correspondantes. Il a créé un `EmailDeliveryReport` permanent par événement puis un I-09 idempotent par événement défaillant. Les échecs génériques sans code terminal fiable restent soumis à la classification conservatrice existante.

## Préservation des preuves

Aucun hard bounce, I-09, rapport fournisseur, événement source ou tentative n'a été supprimé, masqué, reclassé ou réécrit. Aucun nouvel hard bounce volontaire n'est provoqué dans cette phase.

Ces six événements démontrent techniquement le traitement d'un rejet permanent, mais ne sont pas requalifiés comme le scénario supervisé « exactement un hard bounce contrôlé ». Ce scénario reste volontairement différé par décision OWNER.
