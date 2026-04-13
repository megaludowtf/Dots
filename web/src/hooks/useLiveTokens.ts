import { useMemo } from 'react';
import { useEventCache } from './useEventCache';
import { computeLiveTokens } from '../lib/tokenUtils';
import type { LiveToken } from '../lib/tokenUtils';

export interface UseLiveTokensResult {
  tokens: LiveToken[];
  isLoading: boolean;
  error: Error | null;
}

export function useLiveTokens(): UseLiveTokensResult {
  const { mintedBy, mergedBy, infinityBy, events, isLoading, error } = useEventCache();

  const tokens = useMemo(
    () => computeLiveTokens(mintedBy, mergedBy, infinityBy, events),
    [mintedBy, mergedBy, infinityBy, events],
  );

  return { tokens, isLoading, error };
}
