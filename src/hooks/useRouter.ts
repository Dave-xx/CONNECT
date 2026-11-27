import { useCallback, useEffect, useState } from 'react';

export function useRouter() {
  const [path, setPath] = useState<string>(() => window.location.pathname + window.location.search);

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to === window.location.pathname + window.location.search) return;
    window.history.pushState({}, '', to);
    setPath(to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const [pathname, search = ''] = path.split('?');
  const searchParams = new URLSearchParams(search);

  return { pathname, search, searchParams, navigate };
}
