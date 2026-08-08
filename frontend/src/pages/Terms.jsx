import { Link } from 'react-router-dom';
import { Scale } from 'lucide-react';
import LegalPageLayout from '../components/LegalPageLayout';
import { TERMS_LAST_UPDATED } from '../content/legal';

const Terms = () => (
  <LegalPageLayout icon={Scale} title="Conditions générales de vente" lastUpdated={TERMS_LAST_UPDATED}>
    <div className="legal-notice">Les présentes conditions s’appliquent aux prestations réservées auprès de Golden Studio Plus. Le récapitulatif de la formule et le tarif affichés avant l’envoi de la demande complètent ces conditions.</div>

    <section className="legal-section">
      <h2>1. Réservation, prix et paiement</h2>
      <p>Toute prestation nécessite une réservation préalable. Le paiement intégral, soit 100 % du montant indiqué, est exigé avant la confirmation définitive. L’envoi du formulaire crée une demande : le créneau est définitivement confirmé après contrôle manuel du paiement, décision du Studio et envoi d’une confirmation au client.</p>
      <p>Une référence de transaction, un numéro de paiement ou un justificatif aide au contrôle mais ne valide jamais automatiquement le paiement ni la réservation. Le Studio peut demander les éléments nécessaires à cette vérification manuelle. La vérification du paiement et la décision relative à la réservation demeurent deux décisions distinctes, même lorsqu’elles sont réalisées successivement ou au cours d’une même opération administrative.</p>
      <p>Le client doit fournir des informations exactes et surveiller l’adresse e-mail et le numéro de téléphone communiqués. Le Studio ne répond pas des conséquences d’une erreur de saisie, d’un paiement envoyé à un destinataire non autorisé ou d’une défaillance d’un opérateur qui ne lui est pas imputable.</p>
      <p>Les services, disponibilités et tarifs peuvent évoluer pour les demandes futures. Le prix applicable à une réservation est celui figurant dans le récapitulatif ou la confirmation acceptée, sous réserve de la correction d’une erreur manifeste avant la confirmation définitive.</p>
      <p>Si le Studio refuse définitivement une demande après avoir vérifié un paiement, il propose soit le remboursement intégral des sommes effectivement reçues pour la prestation non fournie, soit une autre solution que le client reste libre d’accepter. Un remboursement n’est réputé effectué qu’après exécution et confirmation effectives de l’opération financière.</p>
    </section>

    <section className="legal-section">
      <h2>2. Retards, annulations et report</h2>
      <p>Les règles commerciales ci-dessous s’appliquent sous réserve de tout droit impératif de rétractation ou de remboursement reconnu au client.</p>
      <p><strong>Retards :</strong> tout retard de plus de cinq minutes imputable au client réduit le temps restant de la séance afin de ne pas affecter les créneaux suivants. La séance n’est pas prolongée et aucune compensation n’est accordée au titre du temps ainsi perdu.</p>
      <p><strong>Annulations :</strong> toute annulation communiquée plus de 48 heures avant l’heure prévue de la séance donne lieu au remboursement de 50 % du montant versé. Les 50 % restants sont conservés au titre des frais de dossier et de l’immobilisation du créneau.</p>
      <p>Lorsqu’une annulation est communiquée 48 heures ou moins avant la séance, ou en cas d’absence non signalée, aucun remboursement n’est effectué, sous réserve des dispositions impératives de la loi.</p>
      <p><strong>Report :</strong> un seul changement de date peut être demandé sans frais supplémentaires, à condition que la demande soit communiquée au moins 48 heures avant la date initialement prévue. Le nouveau créneau reste soumis aux disponibilités. Un nouveau changement est traité comme une annulation, sauf accord écrit contraire du Studio.</p>
      <p>Les délais sont calculés selon l’heure locale de Douala et à compter de la réception effective de la demande par un canal professionnel publié par le Studio.</p>
    </section>

    <section className="legal-section">
      <h2>3. Droit de rétractation applicable aux réservations en ligne</h2>
      <p>Lorsqu’un droit de rétractation s’applique impérativement à un contrat conclu à distance, le client consommateur peut l’exercer dans le délai prévu par la réglementation en vigueur. À la date de la présente version, la loi camerounaise n° 2010/021 du 21 décembre 2010 régissant le commerce électronique prévoit, pour les services, un délai de quinze (15) jours à compter de la conclusion du contrat, sous réserve de ses conditions et exceptions.</p>
      <p>La rétractation doit être adressée sans ambiguïté à <a href="mailto:info@gsplus.vip">info@gsplus.vip</a> en indiquant la référence de la réservation. Lorsque le client demande que le service soit fourni avant l’expiration du délai légal et que le Studio l’a fourni, le droit de rétractation ne peut plus être exercé pour cette prestation dans les conditions prévues par la loi.</p>
    </section>

    <section className="legal-section">
      <h2>4. Droit à l’image et droits d’auteur</h2>
      <p>Le Studio détient les droits d’auteur sur les œuvres créées. Sauf accord écrit contraire, le client bénéficie d’un droit d’utilisation personnel et non commercial des photographies livrées. Toute utilisation commerciale, publicitaire, éditoriale, revente, sous-licence ou cession à un tiers nécessite une autorisation écrite distincte.</p>
      <p>Toute utilisation de l’image du client à des fins promotionnelles nécessite son autorisation préalable. Dans le cadre d’une offre expressément présentée comme promotionnelle, cette autorisation peut constituer une condition stricte d’accès à la formule concernée. Le client en est informé avant la confirmation.</p>
      <p>Le retrait d’une autorisation relative au droit à l’image produit effet pour l’avenir et ne remet pas en cause les utilisations antérieurement réalisées conformément à l’autorisation initiale. Il n’impose pas le rappel ou la destruction des supports déjà produits ou diffusés et n’empêche pas la conservation de copies nécessaires à la preuve, sous réserve des dispositions impératives de la loi.</p>
    </section>

    <section className="legal-section">
      <h2>5. Traitement numérique de l’image</h2>
      <p>Dans le cadre de sa démarche qualité, le Studio peut recourir à des logiciels professionnels de retouche ainsi qu’à des services de traitement numérique en ligne afin d’optimiser le rendu final de son travail. Les conditions dans lesquelles les fichiers sont traités ou transmis à des prestataires techniques sont décrites dans la <Link to="/confidentialite">politique de confidentialité</Link>. Le client est invité à en prendre connaissance avant de confirmer sa réservation.</p>
    </section>

    <section className="legal-section">
      <h2>6. Exécution, livraison et responsabilité</h2>
      <p>Le Studio conserve, dans le périmètre de la formule choisie, la maîtrise de ses choix artistiques et techniques, de la sélection et du traitement des images. Sauf accord écrit contraire, les fichiers bruts, essais, réglages et autres éléments de travail intermédiaires ne sont pas inclus dans la livraison.</p>
      <p>Les délais et canaux de livraison annoncés constituent des modalités de référence et peuvent être adaptés pour des raisons techniques, de sécurité ou d’organisation, sous réserve des engagements expressément qualifiés de fermes. Le client doit télécharger les fichiers dans le délai d’accès indiqué et conserver ses propres sauvegardes. Le Studio ne garantit pas leur conservation ou restauration permanente, sauf engagement écrit contraire.</p>
      <p>Le Studio peut reporter ou interrompre une prestation en cas d’indisponibilité imprévue, de risque de sécurité, de panne significative, de défaillance d’un service tiers, de force majeure ou de nécessité opérationnelle. Lorsque l’impossibilité définitive n’est pas imputable au client, le Studio applique le remboursement ou la solution de remplacement prévue à l’article 1, sous réserve des règles impératives.</p>
      <p>Dans toute la mesure permise par la loi, la responsabilité du Studio est limitée aux dommages directs, prévisibles et établis résultant d’une faute qui lui est imputable et ne peut excéder les sommes effectivement payées pour la prestation directement concernée. Aucune stipulation n’exclut un droit ou une responsabilité qui ne peut légalement être limité.</p>
    </section>

    <section className="legal-section">
      <h2>7. Réclamations et litiges</h2>
      <p>Toute réclamation peut être envoyée à <a href="mailto:info@gsplus.vip"><strong>info@gsplus.vip</strong></a>. Les présentes conditions sont régies par le droit camerounais. En cas de différend, les parties recherchent en priorité une solution amiable. À défaut d’accord, tout litige relève des tribunaux matériellement compétents du ressort de Douala, sous réserve des dispositions impératives de la loi.</p>
    </section>

    <section className="legal-section">
      <h2>8. Documents associés et mise à jour</h2>
      <p>Consultez également les <Link to="/mentions-legales">mentions légales</Link> et la{' '}<Link to="/confidentialite">politique de confidentialité</Link>.</p>
      <p>La version applicable à une réservation est celle mise à la disposition du client et acceptée lors de la conclusion du contrat. Golden Studio Plus peut modifier les présentes conditions pour les demandes futures afin de tenir compte d’une évolution légale, technique, organisationnelle, commerciale ou tarifaire.</p>
    </section>
  </LegalPageLayout>
);

export default Terms;
