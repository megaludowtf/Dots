import { defineChain } from 'viem';

export const megaethTestnet = defineChain({
  id: 6343,
  name: 'MegaETH Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://carrot.megaeth.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://megaeth-testnet-v2.blockscout.com' },
  },
  testnet: true,
});

export const megaethMainnet = defineChain({
  id: 4326,
  name: 'MegaETH',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.megaeth.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'MegaETH Explorer', url: 'https://explorer.megaeth.com' },
  },
  testnet: false,
});

export const anvilLocal = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
  blockExplorers: {
    default: { name: 'Anvil', url: 'http://127.0.0.1:8545' },
  },
  testnet: true,
});

// Flip this single line when moving between environments.
export const ACTIVE_CHAIN = megaethTestnet;
