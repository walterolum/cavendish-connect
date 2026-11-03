import { FiCompass } from 'react-icons/fi';
import { useDocumentTitle } from '../../lib/hooks';
import { ButtonLink } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/loading';
import { useBrand } from '../../lib/settings';

export default function NotFoundPage() {
  const brand = useBrand();
  useDocumentTitle('Page not found');
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={<FiCompass />}
        title="We couldn't find that page"
        message="The link may be broken, or the page may have moved."
      >
        <ButtonLink to="/">Go to home</ButtonLink>
        <ButtonLink to="/explore" variant="outline">
          Search {brand.appName}
        </ButtonLink>
      </EmptyState>
    </div>
  );
}
