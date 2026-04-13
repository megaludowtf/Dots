import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { ACTIVE_CHAIN } from './chains';

// MetaMask-only via the injected connector (window.ethereum).
export const wagmiConfig = createConfig({
  connectors: [injected()],
  chains: [ACTIVE_CHAIN],
  transports: {
    [ACTIVE_CHAIN.id]: http(ACTIVE_CHAIN.rpcUrls.default.http[0]),
  },
});
