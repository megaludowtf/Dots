import { NavLink } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

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

export function Nav() {
  const { isConnected } = useAccount();

  return (
    <nav className="top">
      <a href="/" className="brand">
        <div className="dot-cluster">
          <span className="accent-dot pink" />
          <span className="accent-dot blue" />
          <span className="accent-dot green" />
        </div>
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
        {isConnected &&
          WALLET_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              {label}
            </NavLink>
          ))}
        <ConnectButton
          showBalance={false}
          chainStatus="icon"
          accountStatus="address"
        />
      </div>
    </nav>
  );
}
