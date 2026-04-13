import { NavLink } from 'react-router-dom';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useEffect } from 'react';

const NAV_LINKS = [
  { to: '/', label: 'Intro' },
  { to: '/stats', label: 'Stats' },
  { to: '/mint', label: 'Mint' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/faq', label: 'FAQ' },
  { to: '/explore', label: 'Explore' },
];

const WALLET_LINKS = [
  { to: '/profile', label: 'Profile' },
  { to: '/merge', label: 'Merge' },
  { to: '/infinity', label: 'Mega Dot' },
];

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function ConnectBtn() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        className="connect-btn connected"
        onClick={() => disconnect()}
        title="Click to disconnect"
      >
        {shortAddr(address)}
      </button>
    );
  }

  return (
    <button
      className="connect-btn"
      onClick={() => connect({ connector: connectors[0] })}
    >
      Connect
    </button>
  );
}

export function Nav() {
  const { isConnected } = useAccount();

  // The existing CSS uses `body.wallet-connected` to show/hide
  // `.connected-only` nav links. Toggle the class on body.
  useEffect(() => {
    document.body.classList.toggle('wallet-connected', isConnected);
    return () => document.body.classList.remove('wallet-connected');
  }, [isConnected]);

  return (
    <nav className="top">
      <div className="inner">
        <a href="/" className="brand" title="Dots — 1 → 2 → 4 → 2 → 1">
          <span className="split" aria-hidden="true">
            <span className="dot d1" />
            <span className="dot d2" />
            <span className="dot d3" />
            <span className="dot d4" />
          </span>
        </a>
        <div className="pills">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => isActive ? 'active' : ''}
              end={to === '/'}
            >
              {label}
            </NavLink>
          ))}
          {WALLET_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `connected-only${isActive ? ' active' : ''}`
              }
            >
              {label}
            </NavLink>
          ))}
          <ConnectBtn />
        </div>
      </div>
    </nav>
  );
}
