import { useAccount, usePublicClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { CONTRACT_ADDRESS, hasContract } from '../config/contract';
import { useEventCache } from './useEventCache';
import { deriveTraits } from '../art/art';
import type { HydratedToken } from '../lib/tokenUtils';

const TRANSFER_EVENT = {
  type: 'event' as const,
  name: 'Transfer' as const,
  inputs: [
    { name: 'from', type: 'address' as const, indexed: true },
    { name: 'to', type: 'address' as const, indexed: true },
    { name: 'tokenId', type: 'uint256' as const, indexed: true },
  ],
};

export function useOwnedTokens() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { mintedBy, mergedBy, infinityBy } = useEventCache();

  const { data: tokens, isLoading, error } = useQuery<HydratedToken[]>({
    queryKey: ['dots', 'ownedTokens', address],
    enabled: hasContract && !!publicClient && !!address && mintedBy.size > 0,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<HydratedToken[]> => {
      if (!publicClient || !address) return [];

      // 1. Fetch Transfer logs to/from this address.
      const common = { address: CONTRACT_ADDRESS, fromBlock: 0n, toBlock: 'latest' as const };
      const [inLogs, outLogs] = await Promise.all([
        publicClient.getLogs({ ...common, event: TRANSFER_EVENT, args: { to: address } }),
        publicClient.getLogs({ ...common, event: TRANSFER_EVENT, args: { from: address } }),
      ]);

      // 2. Walk events in block order to compute net held set.
      const events: { block: bigint; logIndex: number; id: string; dir: number }[] = [];
      for (const l of inLogs) events.push({ block: l.blockNumber, logIndex: l.logIndex, id: (l.args as any).tokenId.toString(), dir: 1 });
      for (const l of outLogs) events.push({ block: l.blockNumber, logIndex: l.logIndex, id: (l.args as any).tokenId.toString(), dir: -1 });
      events.sort((a, b) => a.block === b.block ? Number(a.logIndex - b.logIndex) : Number(a.block - b.block));

      const held = new Map<string, number>();
      for (const e of events) {
        held.set(e.id, (held.get(e.id) ?? 0) + e.dir);
      }

      // 3. Build token list from event cache — zero RPC calls per token.
      const tokens: HydratedToken[] = [];
      for (const [idStr, count] of held) {
        if (count <= 0) continue;

        const mint = mintedBy.get(idStr);
        if (!mint) continue;

        // Derive divisorIndex from merge history (same logic as computeLiveTokens).
        const mergeList = mergedBy.get(idStr) || [];
        let divisorIndex = mergeList.length;
        let isMega = 0;
        if (infinityBy.has(idStr)) {
          divisorIndex = 7;
          isMega = 1;
        }

        const traits = deriveTraits(mint.seed);
        tokens.push({
          id: Number(idStr),
          seed: mint.seed,
          divisorIndex,
          isMega,
          svg: null,
          colorBandIdx: traits.colorBandIdx,
          gradientIdx: traits.gradientIdx,
          direction: traits.direction,
          speed: traits.speed,
          fetchStatus: 'ok',
        });
      }

      return tokens.sort((a, b) => a.id - b.id);
    },
  });

  return { tokens: tokens ?? [], isLoading, error };
}
