import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { ACTIVE_CHAIN } from './chains';

export const wagmiConfig = getDefaultConfig({
  appName: 'Dots',
  // WalletConnect project ID — get one at https://cloud.walletconnect.com
  // For local dev this can be any non-empty string.
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'dots-dev-local',
  chains: [ACTIVE_CHAIN],
  transports: {
    [ACTIVE_CHAIN.id]: http(ACTIVE_CHAIN.rpcUrls.default.http[0]),
  },
});
