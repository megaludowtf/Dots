import { CONTRACT_ADDRESS, hasContract } from '../../config/contract';

export function Footer() {
  return (
    <footer>
      <div>Dots &mdash; MegaETH testnet</div>
      <div className="contract-addr">
        {hasContract ? CONTRACT_ADDRESS : 'Contract not deployed'}
      </div>
      <div className="links">
        <a href="https://testnet.megaeth.com/" target="_blank" rel="noopener">
          Faucet
        </a>
        <a
          href="https://megaeth-testnet-v2.blockscout.com/"
          target="_blank"
          rel="noopener"
        >
          Explorer
        </a>
        <a href="https://docs.megaeth.com/" target="_blank" rel="noopener">
          Docs
        </a>
      </div>
    </footer>
  );
}
