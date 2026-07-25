import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import LegalPageLayout from '../components/LegalPageLayout';
import { HOSTING_PROVIDER, PENDING_LEGAL_PARTICULARS } from '../content/legal';

const Legal = () => (
  <LegalPageLayout icon={FileText} title="Mentions légales">
    <section className="legal-section">
      <h2>1. Éditeur du site</h2>
      <dl className="legal-details">
        <div><dt>Nom commercial</dt><dd>Golden Studio Plus</dd></div>
        <div><dt>Activité</dt><dd>Studio photographique et services visuels</dd></div>
        <div><dt>Adresse publiée</dt><dd>Cité des Palmiers, Douala, Cameroun</dd></div>
        <div><dt>Téléphone</dt><dd><a href="tel:+237673026654">+237 673 026 654</a></dd></div>
        <div><dt>Adresse e-mail</dt><dd><a href="mailto:info@gsplus.vip">info@gsplus.vip</a></dd></div>
      </dl>
      <div className="legal-notice legal-notice--pending">
        <strong>Informations officielles en attente de validation par l’éditeur :</strong>
        <ul>{PENDING_LEGAL_PARTICULARS.map((item) => <li key={item}>{item}</li>)}</ul>
        Ces informations seront ajoutées dès réception des justificatifs. Aucun numéro, nom ou renseignement juridique non vérifié n’est publié.
      </div>
    </section>

    <section className="legal-section">
      <h2>2. Hébergement</h2>
      <dl className="legal-details">
        <div><dt>Hébergeur</dt><dd>{HOSTING_PROVIDER.name}</dd></div>
        <div><dt>Adresse</dt><dd>{HOSTING_PROVIDER.address}</dd></div>
        <div><dt>Registre</dt><dd>{HOSTING_PROVIDER.registry}</dd></div>
        <div><dt>Téléphone</dt><dd><a href="tel:+4998315050">{HOSTING_PROVIDER.phone}</a></dd></div>
        <div><dt>Adresse e-mail</dt><dd><a href={`mailto:${HOSTING_PROVIDER.email}`}>{HOSTING_PROVIDER.email}</a></dd></div>
        <div><dt>Site</dt><dd><a href={HOSTING_PROVIDER.website} target="_blank" rel="noopener noreferrer">www.hetzner.com</a></dd></div>
      </dl>
    </section>

    <section className="legal-section">
      <h2>3. Propriété intellectuelle</h2>
      <p>Sauf mention contraire, les photographies, vidéos, textes, logos, éléments graphiques et autres contenus présents sur le site sont protégés par les règles applicables en matière de propriété intellectuelle. Toute reproduction ou réutilisation nécessite l’autorisation préalable du titulaire des droits, sous réserve des exceptions prévues par la loi et des éventuels droits de tiers.</p>
    </section>

    <section className="legal-section">
      <h2>4. Responsabilité</h2>
      <p>Golden Studio Plus veille à maintenir les informations publiées aussi exactes et accessibles que possible. Une indisponibilité temporaire, une erreur ou une omission peut toutefois survenir. Les informations, services et tarifs figurant sur le site sont fournis à titre indicatif et peuvent être modifiés à tout moment, sans préavis.</p>
      <p>Golden Studio Plus ne contrôle pas les services tiers ouverts par les liens externes. Leur utilisation relève des conditions et politiques publiées par leurs éditeurs respectifs.</p>
    </section>

    <section className="legal-section">
      <h2>5. Droit applicable et différends</h2>
      <p>Le présent site est soumis au droit camerounais. En cas de différend, les parties recherchent en priorité une solution amiable. À défaut d’accord amiable, le litige relève des tribunaux matériellement compétents du ressort de Douala, sous réserve des dispositions impératives de la loi applicable.</p>
    </section>

    <section className="legal-section">
      <h2>6. Documents associés</h2>
      <p>Consultez les <Link to="/cgv">conditions générales de vente</Link> et la{' '}<Link to="/confidentialite">politique de confidentialité</Link>.</p>
    </section>
  </LegalPageLayout>
);

export default Legal;
