import { Link } from 'react-router-dom';
import { useLocale } from '../lib/i18n.js';
import { localizedPath } from '../lib/locale-routes.js';

const LocalizedLink = ({ to, ...props }) => {
  const { locale } = useLocale();
  return <Link to={typeof to === 'string' ? localizedPath(locale, to) : to} {...props} />;
};

export default LocalizedLink;
