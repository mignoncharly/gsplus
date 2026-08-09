# Matrice de récupération des contenus tarifaires — POST-03

État : `DIFFÉRÉ-OWNER` — réponses catalogue attendues; phase ouverte, aucune validation implicite

Ce document remplace l'hypothèse initiale selon laquelle 88 nouveaux contenus devaient être rédigés. La base comporte bien 88 champs obligatoires absents, mais plusieurs informations existent déjà hors des versions tarifaires et doivent être récupérées, reliées ou approuvées — pas réinventées.

## Sources relues intégralement le 9 août 2026

- `docs/Bibliotheque_emails_Golden_Studio_Plus_2026-07-30_v2.docx` : 1 064 paragraphes/lignes extraits et relus.
- `docs/Rapport_unifie_audit_Golden_Studio_Plus_2026-07-29.docx` : 509 paragraphes/lignes extraits et relus.
- `docs/Textes_juridiques_Golden_Studio_Plus_2026-07-31.docx` : 125 paragraphes/lignes extraits et relus.
- Dépôt courant, historique Git complet, seed, frontend et production : contrôlés en complément.

Constats normatifs :

- Le rapport d'audit, P1-04, constate explicitement que l'aperçu Flash Social affichait « Aucune description » et aucun bloc de mentions ou conditions applicables. Il exige description, inclusions, livraison et « Mentions et conditions applicables » versionnées.
- La bibliothèque d'e-mails, section 10, définit E-18/E-19 mais précise que « le délai réel de production ou de livraison des photographies doit néanmoins être défini selon les prestations proposées ».
- Le DOCX juridique fournit déjà les CGV communes datées du 31 juillet 2026. Elles n'ont pas à être réécrites 22 fois : elles complètent le récapitulatif propre à chaque formule.
- Le frontend contient déjà une grille de délais calculés et trois listes commerciales d'inclusions, mais ces valeurs ne sont pas stockées dans `PackageVersion` et ne portent pas à elles seules une approbation OWNER versionnée.

## Contenus existants récupérables

### Grille de livraison actuellement affichée

Source : `frontend/src/lib/packages.js`. Cette grille reste le fallback des versions historiques; le frontend a été corrigé pour qu'un futur `deliveryLabel` OWNER publié prenne désormais priorité.

| # | Formule | Délai actuellement affiché | Inclusions commerciales retrouvées dans le frontend |
|---:|---|---|---|
| 1 | `flash-social` | 24 h | Aucune source formule trouvée |
| 2 | `happy-hours` | 24 h | Aucune source formule trouvée |
| 3 | `pack-decouverte` | 48 h | Aucune source formule trouvée |
| 4 | `classic-propre` | 48 h | Portrait individuel; Retouche incluse; Idéal pour un profil professionnel |
| 5 | `pack-signature` | 72 h | Direction éditoriale; Rendu premium; Plus de variations |
| 6 | `corporate-linkedin` | 48 h | Aucune source formule trouvée |
| 7 | `duo-couple` | 48 h | Séance à deux; Guidage des poses; Ambiance naturelle |
| 8 | `famille` | 48 h | Aucune source formule trouvée |
| 9 | `groupe-fun` | 72 h | Aucune source formule trouvée |
| 10 | `enfant` | 48 h | Aucune source formule trouvée |
| 11 | `anniversaire` | 48 h | Aucune source formule trouvée |
| 12 | `maternite` | 72 h | Aucune source formule trouvée |
| 13 | `bebe-naissance` | 48 h | Aucune source formule trouvée |
| 14 | `fiancailles-decouverte` | 72 h | Aucune source formule trouvée |
| 15 | `fiancailles-classic` | 72 h | Aucune source formule trouvée |
| 16 | `fiancailles-premium` | 5 jours | Aucune source formule trouvée |
| 17 | `pre-mariage-decouverte` | 72 h | Aucune source formule trouvée |
| 18 | `pre-mariage-classic` | 5 jours | Aucune source formule trouvée |
| 19 | `pre-mariage-premium` | 7 jours | Aucune source formule trouvée |
| 20 | `event-lite` | 5 jours | Aucune source formule trouvée |
| 21 | `event-standard` | 7 jours | Aucune source formule trouvée |
| 22 | `event-premium` | 7 jours | Aucune source formule trouvée |

### Conditions et mentions déjà disponibles

- CGV communes : version publiée du 31 juillet 2026, sections Réservation/prix/paiement, Retards/annulations/report, Droit à l'image, Traitement numérique, Exécution/livraison/responsabilité et Réclamations/litiges.
- Règle d'articulation déjà approuvée dans le DOCX : « Le récapitulatif de la formule et le tarif affichés avant l'envoi de la demande complètent ces conditions. »
- Flash Social : l'audit confirme que l'autorisation d'image constitue une condition obligatoire de cette offre promotionnelle. Aucune généralisation aux autres formules ne sera faite sans source.

La version tarifaire doit conserver uniquement les mentions particulières de la formule et la référence/version des CGV communes; elle ne doit pas recopier arbitrairement tout le document juridique dans chaque formule.

## Écarts réels après récupération

| Élément | Situation réelle | Attente OWNER minimale |
|---|---|---|
| Résumé public / contenu | Aucun texte formule par formule dans les trois DOCX, la base ou l'historique Git | Indiquer la source catalogue existante. Si un seul texte par formule suffit, approuver son emploi à la fois comme résumé et contenu plutôt que rédiger deux doublons. |
| Inclusions | Trois formules récupérées; dix-neuf sans source dans le dépôt ou les DOCX | Indiquer la source des dix-neuf listes ou fournir les listes manquantes; confirmer les trois listes récupérées. |
| Livraison | Les 22 délais sont déjà affichés via une grille technique, mais la bibliothèque d'e-mails demande une définition réelle par prestation | Approuver la grille existante en une décision globale, ou fournir les exceptions par formule. |
| Conditions communes | Déjà publiées dans les CGV du 31 juillet 2026 | Aucune nouvelle rédaction; confirmer que les CGV communes s'appliquent aux 22 formules. |
| Conditions particulières | Flash Social documenté; aucune autre condition particulière trouvée | Déclarer les éventuelles exceptions. « Aucune autre condition particulière » est une décision globale acceptable. |
| Mentions juridiques | Document juridique déjà publié et versionné séparément | Référencer la version juridique publiée; ne rédiger que les mentions particulières absentes, s'il en existe. |

## Réponse OWNER attendue

Une réponse courte peut suffire, par exemple :

1. source du catalogue détaillé des 22 formules : fichier, URL officielle ou document à joindre;
2. « grille de livraison actuelle approuvée » ou liste des exceptions;
3. « CGV du 31 juillet 2026 applicables aux 22 formules »;
4. « aucune condition particulière supplémentaire » ou liste des exceptions;
5. confirmation ou correction des trois listes récupérées.

Après cette réponse, l'inventaire définitif sera généré depuis les sources, soumis en aperçu, puis seulement transformé en versions 2 `DRAFT`. Aucune version ne sera validée ou publiée sans contrôle OWNER du rendu final.

## Baseline d'intégrité

Production avant toute écriture : 22 versions 1 `PUBLISHED`, zéro `DRAFT`, zéro `VALIDATED`, 13 réservations et 13 snapshots. Empreinte SHA-256 des liaisons et données tarifaires figées : `30c8b4efc31b89abe8081a1e1d7b33576bb5e4002afc025d4932bb824a968be1`.

Aucun UPDATE SQL direct, envoi fournisseur, réservation QA ou contenu commercial inventé n'est autorisé par ce document.
