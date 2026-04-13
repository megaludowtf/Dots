import { usePublicClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { CONTRACT_ADDRESS, hasContract } from '../config/contract';
import type { MintRecord, MergeRecord, NormalisedEvent } from '../lib/tokenUtils';

const EVENT_KIND: Record<string, string> = {
  Minted: 'mint',
  Merged: 'merge',
  Burned: 'burn',
  Infinity: 'infinity',
};

// Inline event ABI specs matching contract.ts definitions.
const MINTED_EVENT = {
  type: 'event' as const,
  name: 'Minted' as const,
  inputs: [
    { name: 'to', type: 'address' as const, indexed: true },
    { name: 'tokenId', type: 'uint256' as const, indexed: true },
    { name: 'seed', type: 'uint32' as const, indexed: false },
  ],
};

const MERGED_EVENT = {
  type: 'event' as const,
  name: 'Merged' as const,
  inputs: [
    { name: 'survivorId', type: 'uint256' as const, indexed: true },
    { name: 'burnedId', type: 'uint256' as const, indexed: true },
    { name: 'newDivisorIndex', type: 'uint16' as const, indexed: false },
  ],
};

const BURNED_EVENT = {
  type: 'event' as const,
  name: 'Burned' as const,
  inputs: [
    { name: 'tokenId', type: 'uint256' as const, indexed: true },
  ],
};

const INFINITY_EVENT = {
  type: 'event' as const,
  name: 'Infinity' as const,
  inputs: [
    { name: 'megaDotId', type: 'uint256' as const, indexed: true },
    { name: 'burnedIds', type: 'uint256[]' as const, indexed: false },
  ],
};

export interface EventCacheData {
  mintedBy: Map<string, MintRecord>;
  mergedBy: Map<string, MergeRecord[]>;
  infinityBy: Map<string, string[]>;
  events: NormalisedEvent[];
  blockTs: Map<bigint, number>;
}

export interface UseEventCacheResult extends EventCacheData {
  isLoading: boolean;
  error: Error | null;
}

const EMPTY: EventCacheData = {
  mintedBy: new Map(),
  mergedBy: new Map(),
  infinityBy: new Map(),
  events: [],
  blockTs: new Map(),
};

export function useEventCache(): UseEventCacheResult {
  const publicClient = usePublicClient();

  const { data, isLoading, error } = useQuery<EventCacheData>({
    queryKey: ['dots', 'eventCache'],
    enabled: hasContract && !!publicClient,
    staleTime: Infinity,
    queryFn: async (): Promise<EventCacheData> => {
      if (!publicClient) throw new Error('No public client');

      const common = { address: CONTRACT_ADDRESS, fromBlock: 0n, toBlock: 'latest' as const };

      // 1. Fetch all 4 event types in parallel.
      const [minted, merged, burned, infinityEvts] = await Promise.all([
        publicClient.getLogs({ ...common, event: MINTED_EVENT }),
        publicClient.getLogs({ ...common, event: MERGED_EVENT }),
        publicClient.getLogs({ ...common, event: BURNED_EVENT }),
        publicClient.getLogs({ ...common, event: INFINITY_EVENT }),
      ]);

      // 2. Build mintedBy Map<tokenId, MintRecord>
      const mintedBy = new Map<string, MintRecord>();
      for (const l of minted) {
        const args = l.args as any;
        mintedBy.set(args.tokenId.toString(), {
          seed: Number(args.seed),
          to: args.to,
          block: l.blockNumber,
          tx: l.transactionHash,
        });
      }

      // 3. Build mergedBy Map<survivorId, MergeRecord[]> sorted by block/logIndex
      const mergedBy = new Map<string, MergeRecord[]>();
      for (const l of merged) {
        const args = l.args as any;
        const sid = args.survivorId.toString();
        if (!mergedBy.has(sid)) mergedBy.set(sid, []);
        mergedBy.get(sid)!.push({
          burnedId: args.burnedId.toString(),
          newDivisorIndex: Number(args.newDivisorIndex),
          block: l.blockNumber,
          logIndex: l.logIndex,
          tx: l.transactionHash,
        });
      }
      for (const list of mergedBy.values()) {
        list.sort((a, b) => {
          if (a.block === b.block) return Number(a.logIndex - b.logIndex);
          return Number(a.block - b.block);
        });
      }

      // 4. Build infinityBy Map<megaDotId, tokenIdStr[]>
      const infinityBy = new Map<string, string[]>();
      for (const l of infinityEvts) {
        const args = l.args as any;
        infinityBy.set(
          args.megaDotId.toString(),
          (args.burnedIds as bigint[]).map((b: bigint) => b.toString()),
        );
      }

      // 5. Build flat events array (newest-first)
      const normalise = (rawList: readonly any[], name: string): NormalisedEvent[] =>
        rawList.map(l => ({
          kind: EVENT_KIND[name],
          name,
          block: l.blockNumber,
          logIndex: l.logIndex,
          tx: l.transactionHash,
          args: l.args,
        }));

      const all: NormalisedEvent[] = [
        ...normalise(minted, 'Minted'),
        ...normalise(merged, 'Merged'),
        ...normalise(burned, 'Burned'),
        ...normalise(infinityEvts, 'Infinity'),
      ];
      all.sort((a, b) => {
        if (a.block === b.block) return Number(b.logIndex - a.logIndex);
        return Number(b.block - a.block);
      });

      // 6. Resolve block timestamps in parallel
      const uniqBlocks = [...new Set(all.map(e => e.block))];
      const blocks = await Promise.all(
        uniqBlocks.map(bn => publicClient.getBlock({ blockNumber: bn })),
      );
      const blockTs = new Map<bigint, number>(
        blocks.map(b => [b.number, Number(b.timestamp)]),
      );

      return { mintedBy, mergedBy, infinityBy, events: all, blockTs };
    },
  });

  return {
    ...(data ?? EMPTY),
    isLoading,
    error: error as Error | null,
  };
}
