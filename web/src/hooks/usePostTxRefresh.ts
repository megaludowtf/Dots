import { useQueryClient } from '@tanstack/react-query';

/**
 * Returns a callback that invalidates all TanStack queries under the 'dots'
 * prefix. Call after any successful on-chain transaction so derived state
 * (event cache, live tokens, owned tokens, gallery hydration) refetches.
 */
export function usePostTxRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['dots'] });
  };
}
