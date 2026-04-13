import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';

import { wagmiConfig } from './config/wagmi';
import { App } from './App';

import '@rainbow-me/rainbowkit/styles.css';
import './styles/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Server state from onchain is generally stable — manual invalidation
      // via usePostTxRefresh handles freshness after writes.
      staleTime: 60_000,
      retry: 2,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#fff',
            accentColorForeground: '#000',
            borderRadius: 'small',
            fontStack: 'system',
          })}
        >
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
