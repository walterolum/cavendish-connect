import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Scroll to top on page change, but not when only the query string changes (filters, paging). */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return null;
}
