import { useQueries } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { CONTRACT_ADDRESS, ABI, hasContract } from '../config/contract';
import type { LiveToken, HydratedToken } from '../lib/tokenUtils';

const COLOR_BAND_LABELS = ['Eighty', 'Sixty', 'Forty', 'Twenty', 'Ten', 'Five', 'One'];
const GRADIENT_LABELS = ['None', 'Linear', 'Double Linear', 'Reflected', 'Double Angled', 'Angled', 'Linear Z'];

/**
 * For each LiveToken, lazily fetch its tokenURI and parse the base64 JSON
 * to extract the SVG and reverse-map attribute strings to numeric trait indices.
 *
 * Returns HydratedToken[] in the same order as the input, with svg/traits
 * populated as individual queries resolve.
 */
export function useGalleryHydration(tokens: LiveToken[]): HydratedToken[] {
  const publicClient = usePublicClient();

  const queries = useQueries({
    queries: tokens.map((token) => ({
      queryKey: ['dots', 'gallery', 'tokenURI', token.id],
      enabled: hasContract && !!publicClient,
      staleTime: Infinity,
      queryFn: async (): Promise<Pick<HydratedToken, 'svg' | 'fetchStatus'>> => {
        if (!publicClient) throw new Error('No public client');

        const uri = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: 'tokenURI',
          args: [BigInt(token.id)],
        }) as string;

        let svg: string | null = null;
        let colorBandIdx: number | undefined;
        let gradientIdx: number | undefined;
        let direction: number | undefined;
        let speed: number | undefined;

        if (uri.startsWith('data:application/json;base64,')) {
          const json = JSON.parse(atob(uri.slice('data:application/json;base64,'.length)));
          // json.image is "data:image/svg+xml;base64,<encoded>" — decode to raw SVG markup.
          const imgUri: string = json.image ?? '';
          if (imgUri.startsWith('data:image/svg+xml;base64,')) {
            svg = atob(imgUri.slice('data:image/svg+xml;base64,'.length));
          }
          if (json.attributes) {
            for (const attr of json.attributes) {
              const cbIdx = COLOR_BAND_LABELS.indexOf(attr.value);
              if (attr.trait_type === 'Color Band' && cbIdx !== -1) colorBandIdx = cbIdx;
              const gIdx = GRADIENT_LABELS.indexOf(attr.value);
              if (attr.trait_type === 'Gradient' && gIdx !== -1) gradientIdx = gIdx;
              if (attr.trait_type === 'Shift') direction = attr.value === 'UV' ? 1 : 0;
              if (attr.trait_type === 'Direction') direction = attr.value === 'Reverse' ? 1 : 0; // legacy
              if (attr.trait_type === 'Speed') {
                const sv = attr.value;
                speed = sv === '2x' ? 1 : sv === '1x' ? 2 : sv === '0.5x' ? 4 : Number(sv);
              }
            }
          }
        }

        return { svg, fetchStatus: 'ok' as const };
      },
    })),
  });

  return tokens.map((token, i) => {
    const q = queries[i];
    if (q.isSuccess && q.data) {
      return { ...token, ...q.data };
    }
    if (q.isError) {
      return { ...token, svg: null, fetchStatus: 'fail' as const };
    }
    if (q.isLoading || q.isFetching) {
      return { ...token, svg: null, fetchStatus: 'pending' as const };
    }
    return { ...token, svg: null, fetchStatus: null };
  });
}
