import { useAccount, usePublicClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { CONTRACT_ADDRESS, ABI, hasContract } from '../config/contract';
import type { HydratedToken } from '../lib/tokenUtils';

// ERC-721 Transfer event for scanning ownership.
const TRANSFER_EVENT = {
  type: 'event' as const,
  name: 'Transfer' as const,
  inputs: [
    { name: 'from', type: 'address' as const, indexed: true },
    { name: 'to', type: 'address' as const, indexed: true },
    { name: 'tokenId', type: 'uint256' as const, indexed: true },
  ],
};

const COLOR_BAND_LABELS = ['Eighty', 'Sixty', 'Forty', 'Twenty', 'Ten', 'Five', 'One'];
const GRADIENT_LABELS = ['None', 'Linear', 'Reflected', 'Angled', 'Double Angled', 'Linear Double', 'Linear Z'];

export interface UseOwnedTokensResult {
  tokens: HydratedToken[];
  isLoading: boolean;
  error: Error | null;
}

export function useOwnedTokens(): UseOwnedTokensResult {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const { data, isLoading, error } = useQuery<HydratedToken[]>({
    queryKey: ['dots', 'ownedTokens', address],
    enabled: hasContract && !!address && !!publicClient,
    queryFn: async (): Promise<HydratedToken[]> => {
      if (!publicClient || !address) return [];

      const common = { address: CONTRACT_ADDRESS, fromBlock: 0n, toBlock: 'latest' as const };

      // Fetch Transfer logs where account is sender or receiver.
      const [incoming, outgoing] = await Promise.all([
        publicClient.getLogs({ ...common, event: TRANSFER_EVENT, args: { to: address } }),
        publicClient.getLogs({ ...common, event: TRANSFER_EVENT, args: { from: address } }),
      ]);

      // Compute net held set.
      const held = new Map<string, number>(); // tokenId -> net balance (always 0 or 1 for ERC-721)
      for (const l of incoming) {
        const id = (l.args as any).tokenId.toString();
        held.set(id, (held.get(id) ?? 0) + 1);
      }
      for (const l of outgoing) {
        const id = (l.args as any).tokenId.toString();
        held.set(id, (held.get(id) ?? 0) - 1);
      }

      const ownedIds: string[] = [];
      for (const [id, count] of held) {
        if (count > 0) ownedIds.push(id);
      }

      if (ownedIds.length === 0) return [];

      // Fetch getDot + tokenURI for each owned token in parallel.
      const results = await Promise.all(
        ownedIds.map(async (idStr): Promise<HydratedToken> => {
          const tokenId = BigInt(idStr);
          try {
            const [dotResult, uriResult] = await Promise.all([
              publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: ABI,
                functionName: 'getDot',
                args: [tokenId],
              }),
              publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: ABI,
                functionName: 'tokenURI',
                args: [tokenId],
              }),
            ]);

            const dot = dotResult as any;
            const uri = uriResult as string;

            // Parse base64 JSON tokenURI.
            let svg: string | null = null;
            let colorBandIdx: number | undefined;
            let gradientIdx: number | undefined;
            let direction: number | undefined;
            let speed: number | undefined;

            if (uri.startsWith('data:application/json;base64,')) {
              try {
                const json = JSON.parse(atob(uri.slice('data:application/json;base64,'.length)));
                svg = json.image ?? null;
                if (json.attributes) {
                  for (const attr of json.attributes) {
                    const idx = COLOR_BAND_LABELS.indexOf(attr.value);
                    if (attr.trait_type === 'Color Band' && idx !== -1) colorBandIdx = idx;
                    const gIdx = GRADIENT_LABELS.indexOf(attr.value);
                    if (attr.trait_type === 'Gradient' && gIdx !== -1) gradientIdx = gIdx;
                    if (attr.trait_type === 'Direction') direction = Number(attr.value);
                    if (attr.trait_type === 'Speed') speed = Number(attr.value);
                  }
                }
              } catch {
                // Parse failure — leave defaults.
              }
            }

            return {
              id: Number(idStr),
              seed: Number(dot.seed),
              divisorIndex: Number(dot.divisorIndex),
              isMega: Number(dot.isMega),
              svg,
              colorBandIdx,
              gradientIdx,
              direction,
              speed,
              fetchStatus: 'ok',
            };
          } catch {
            return {
              id: Number(idStr),
              seed: 0,
              divisorIndex: 0,
              isMega: 0,
              svg: null,
              fetchStatus: 'fail',
            };
          }
        }),
      );

      return results;
    },
  });

  return {
    tokens: data ?? [],
    isLoading,
    error: error as Error | null,
  };
}
