import { Link } from 'react-router-dom';
import { Scale } from 'lucide-react';
import LegalPageLayout from '../components/LegalPageLayout';

const Terms = () => (
  <LegalPageLayout icon={Scale} title="Conditions générales de vente">
    <div className="legal-notice">Les présentes conditions s’appliquent aux prestations réservées auprès de Golden Studio Plus. Le récapitulatif de la formule et le tarif affichés avant l’envoi de la demande complètent ces conditions.</div>

    <section className="legal-section">
      <h2>1. Réservation et paiement</h2>
      <p>Toute prestation nécessite une réservation préalable. Le paiement intégral, soit 100 % du montant indiqué, est exigé avant la confirmation définitive. L’envoi du formulaire crée une demande : le créneau est définitivement confirmé après contrôle manuel du paiement, décision du Studio et envoi d’une confirmation au client.</p>
      <p>Une référence de transaction ou un numéro de paiement aide au contrôle mais ne valide jamais automatiquement le paiement ni la réservation. Le Studio peut demander les éléments nécessaires à cette vérification manuelle.</p>
    </section>

    <section className="legal-section">
      <h2>2. Retards, annulations et report</h2>
      <p><strong>Retards :</strong> tout retard de plus de cinq minutes imputable au client réduit le temps restant de la séance afin de ne pas affecter les créneaux suivants. La séance n’est pas prolongée et aucune compensation n’est accordée au titre du temps ainsi perdu.</p>
      <p><strong>Annulations :</strong> toute annulation communiquée plus de 48 heures avant l’heure prévue donne lieu au remboursement de 50 % du montant versé. Les 50 % restants sont conservés au titre des frais de dossier et de l’immobilisation du créneau. Lorsqu’une annulation est communiquée 48 heures ou moins avant la séance, ou en cas d’absence non signalée, aucun remboursement n’est effectué.</p>
      <p><strong>Report :</strong> un seul changement de date peut être demandé sans frais supplémentaires, à condition que la demande soit communiquée au moins 48 heures avant la date initialement prévue. Le nouveau créneau reste soumis aux disponibilités.</p>
    </section>

    <section className="legal-section">
      <h2>3. Droit à l’image et droits d’auteur</h2>
      <p>Le Studio détient les droits d’auteur sur les œuvres créées. Sauf accord écrit contraire, le client bénéficie d’un droit d’utilisation personnel et non commercial des photographies livrées. Toute utilisation de l’image du client à des fins promotionnelles nécessite son autorisation préalable.</p>
      <p>Dans le cadre d’une offre expressément présentée comme promotionnelle, cette autorisation peut constituer une condition d’accès à la formule concernée. Le client en est informé avant la confirmation.</p>
    </section>

    <section className="legal-section">
      <h2>4. Traitement numérique de l’image</h2>
      <p>Dans le cadre de sa démarche qualité, le Studio peut recourir à des logiciels professionnels de retouche ainsi qu’à des services de traitement numérique en ligne afin d’optimiser le rendu final. Les conditions dans lesquelles les fichiers sont traités ou transmis à des prestataires techniques sont décrites dans la <Link to="/confidentialite">politique de confidentialité</Link>, que le client est invité à consulter avant de confirmer sa réservation.</p>
    </section>

    <section className="legal-section">
      <h2>5. Réclamations et litiges</h2>
      <p>Toute réclamation peut être envoyée à <a href="mailto:info@gsplus.vip">info@gsplus.vip</a>. Les présentes conditions sont régies par le droit camerounais. En cas de différend, les parties recherchent en priorité une solution amiable. À défaut d’accord, le litige relève des tribunaux matériellement compétents du ressort de Douala, sous réserve des dispositions impératives de la loi.</p>
    </section>

    <section className="legal-section">
      <h2>6. Documents associés</h2>
      <p>Consultez également les <Link to="/mentions-legales">mentions légales</Link> et la{' '}<Link to="/confidentialite">politique de confidentialité</Link>.</p>
    </section>
  </LegalPageLayout>
);

export default Terms;
