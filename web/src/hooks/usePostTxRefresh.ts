import { useQueryClient } from '@tanstack/react-query';

/**
 * Returns a callback that forces all 'dots' queries to refetch.
 * Uses a 1.5s delay to give the chain time to index the new event
 * before the getLogs sweep runs — without this, the refetch often
 * returns stale data because the RPC hasn't indexed the block yet.
 */
export function usePostTxRefresh() {
  const qc = useQueryClient();
  return () => {
    // Immediate invalidation marks queries as stale.
    qc.invalidateQueries({ queryKey: ['dots'] });
    // Delayed refetch ensures the chain has indexed the new events.
    setTimeout(() => {
      qc.refetchQueries({ queryKey: ['dots'] });
    }, 1500);
  };
}
