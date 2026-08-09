# Aperçu de migration du catalogue officiel — 4 août 2026

État : `PUBLIÉ-PROD — VALIDÉ-OWNER`

Source : `docs/Golden_Studio_Plus_Catalogue.docx`
SHA-256 : `002bd52c30c7e3fcef8aebc71f82111780320ba8c9500c4e55d746164cd54696`

L'OWNER a confirmé le 9 août 2026 que ce DOCX remplace officiellement le catalogue historique des 22 formules. Les 35 offres françaises ont été publiées le même jour par le workflow versionné, sans modification des réservations historiques.

## Structure cible

Le document contient 34 packs et trois promotions. La cible comporte 35 enregistrements commerciaux : les 34 packs, plus Happy Hours conservé comme offre promotionnelle réservable liée à Flash Social. L'avantage étudiant et le parrainage deviennent des règles promotionnelles séparées.

- 17 formules actuelles correspondent directement à un pack source.
- Quatre formules agrégées actuelles deviennent douze packs distincts : Enfant, Anniversaire, Maternité et Bébé.
- Cinq packs sont entièrement nouveaux : Identité Standard, Pack Fratrie et trois abonnements.
- Happy Hours reste un enregistrement distinct pour porter son créneau et son prix, mais dépend commercialement de Flash Social.
- Les anciennes versions et les snapshots des 13 réservations restent immuables.

## Correspondance des 22 formules existantes

| Slug conservé | Nom cible | Prix | Durée source | Livraison source | Action |
|---|---|---:|---:|---|---|
| `flash-social` | Flash Social | 5 000 | 15 min | échange WhatsApp | version 2; durée 30→15 |
| `happy-hours` | Happy Hours — Flash Social | 4 000 | 15 min | échange WhatsApp | version 2 promotionnelle; durée 30→15 |
| `pack-decouverte` | Portrait Découverte | 10 000 | 30 min | échange WhatsApp | version 2; renommage; durée 45→30 |
| `classic-propre` | Classic Propre | 18 000 | 60 min | échange WhatsApp | version 2 |
| `pack-signature` | Signature | 32 000 | 90 min | échange WhatsApp | version 2; renommage |
| `corporate-linkedin` | Corporate LinkedIn | 25 000 | 45 min | échange WhatsApp | version 2 |
| `duo-couple` | Duo & Couple | 22 000 | 60 min | échange WhatsApp | version 2 |
| `famille` | Famille — jusqu'à 5 personnes | 28 000 | 60 min | échange WhatsApp | version 2 |
| `groupe-fun` | Groupe Fun — 6 à 8 personnes | 35 000 | 90 min | échange WhatsApp | version 2 |
| `enfant` | Enfant Découverte | 8 000 | 30 min | échange WhatsApp | version 2; fin du tarif agrégé |
| `anniversaire` | Anniversaire Enfant Découverte | 8 000 | 30 min | échange WhatsApp | version 2; fin du tarif agrégé |
| `maternite` | Maternité Découverte | 10 000 | 30 min | échange WhatsApp | version 2; fin du tarif agrégé |
| `bebe-naissance` | Bébé Découverte | 12 000 | 30 min max. | échange WhatsApp | version 2; fin du tarif agrégé |
| `fiancailles-decouverte` | Fiançailles Découverte | 25 000 | 60 min | 10 jours ouvrés après sélection | version 2; durée 90→60 |
| `fiancailles-classic` | Fiançailles Classic | 35 000 | 90 min | 10 jours ouvrés après sélection | version 2; durée 120→90 |
| `fiancailles-premium` | Fiançailles Premium | 50 000 | 120 min | 15 jours ouvrés après sélection | version 2; durée 180→120 |
| `pre-mariage-decouverte` | Pré-mariage Découverte | 40 000 | 90 min | 15 jours ouvrés après sélection | version 2; durée 120→90 |
| `pre-mariage-classic` | Pré-mariage Classic | 60 000 | 120 min | 15 jours ouvrés après sélection | version 2; durée 180→120 |
| `pre-mariage-premium` | Pré-mariage Premium | 100 000 | 180 min | 20 jours ouvrés | version 2; durée 480→180 |
| `event-lite` | Événement Lite | 80 000 | 120 min | échange WhatsApp | version 2; durée 240→120 |
| `event-standard` | Événement Standard | 140 000 | 240 min | échange WhatsApp | version 2; durée 360→240 |
| `event-premium` | Événement Premium | 220 000 | 480 min | échange WhatsApp | version 2 |

Les prix des 22 enregistrements correspondent au DOCX. Quinze durées actuelles ne peuvent en revanche pas être conservées si la source officielle est appliquée.

## Treize nouveaux packs

| Slug proposé | Pack | Prix | Durée source | Mode cible | Livraison |
|---|---|---:|---:|---|---|
| `identite-standard` | Identité Standard | 3 000 | absente | prise de contact | échange WhatsApp |
| `pack-fratrie` | Pack Fratrie — 2 à 4 enfants | 28 000 | 60 min | réservation directe | échange WhatsApp |
| `maternite-douce` | Maternité Douce | 18 000 | 60 min | réservation directe | échange WhatsApp |
| `maternite-elegance` | Maternité Élégance | 35 000 | 90 min | réservation directe | échange WhatsApp |
| `bebe-premiere-magie` | Bébé Première Magie | 16 000 | 40 min max. | réservation directe | échange WhatsApp |
| `enfant-star` | Enfant Star | 12 000 | 45 min | réservation directe | échange WhatsApp |
| `ado-swag` | Ado Swag | 18 000 | 60 min | réservation directe | échange WhatsApp |
| `anniversaire-enfant-star` | Anniversaire Enfant Star | 12 000 | 45 min | réservation directe | échange WhatsApp |
| `anniversaire-adulte-classic` | Anniversaire Adulte Classic | 15 000 | 60 min | réservation directe | échange WhatsApp |
| `anniversaire-adulte-premium` | Anniversaire Adulte Premium | 32 000 | 90 min | réservation directe | échange WhatsApp |
| `abonnement-createur-starter` | Abonnement Créateur Starter | 15 000/mois | 1 × 30 min/mois | abonnement/contact | échange WhatsApp |
| `abonnement-createur-pro` | Abonnement Créateur Pro | 35 000/mois | 2 séances Classic/mois | abonnement/contact | échange WhatsApp |
| `abonnement-influenceur-vip` | Abonnement Influenceur VIP | 50 000/mois | 3 séances Classic Propre/mois | abonnement/contact | échange WhatsApp |

## Traitement des promotions

| Règle | Décision intégrée | État local |
|---|---|---|
| Happy Hours | mercredi/jeudi 10 h–14 h; 15 min; maximum six dossiers actifs par jour; paiement intégral; non cumulable | restrictions serveur, disponibilité et quota implémentés |
| Avantage étudiant | conditions FR du DOCX affichées; justificatif et application confirmés avec l'équipe pendant l'échange | traitement manuel explicite; aucune fausse remise automatique |
| Parrainage Golden | conditions FR du DOCX affichées; éligibilité et crédit confirmés avec l'équipe pendant l'échange | traitement manuel explicite; aucun faux ledger automatique |

## Politique de reprise du contenu

- `description` : texte FR exact du DOCX.
- `content` : même texte source tant qu'aucun texte long distinct n'est fourni; aucune amplification marketing automatique.
- `inclusions` : éléments factuels séparés depuis la description FR.
- `conditions` : conditions particulières exactes du DOCX et référence aux CGV communes du 31 juillet 2026.
- `legalText` : référence versionnée aux CGV publiées; aucune réécriture arbitraire des CGV dans chaque pack.
- Texte EN : ignoré pour cette version. Le schéma canonique et l'affichage préparés ici sont uniquement en français.

## Arbitrages OWNER intégrés le 9 août 2026

1. Les 29 délais non précisés par le DOCX affichent « Délai communiqué lors de l'échange WhatsApp ».
2. Les six délais Fiançailles et Pré-mariage reprennent exactement les 10, 15 ou 20 jours ouvrés du nouveau DOCX.
3. Identité Standard reste visible mais passe en prise de contact, sans durée inventée et sans réservation directe.
4. Les trois abonnements restent visibles au prix mensuel mais passent en prise de contact; aucune facturation récurrente fictive n'est annoncée.
5. La version anglaise est différée et n'est pas reprise dans la source applicative française.
6. Happy Hours reçoit des règles automatiques de calendrier, quota et paiement; Avantage étudiant et Parrainage Golden sont explicitement traités avec l'équipe.

## Résultat de publication

La source canonique contient 35 enregistrements français dans `backend/src/catalogue/golden-studio-plus-2026-08-04.ts`. La production contient 35 versions `PUBLISHED`, 22 versions historiques `ARCHIVED`, zéro DRAFT/VALIDATED, 31 offres directes et quatre offres contact.

Les 13 réservations, snapshots et paiements historiques sont inchangés. La commande de préparation est idempotente et reconnaît les 35 offres déjà courantes sans recréer de brouillon.
