import { CONTRACT_ADDRESS, hasContract } from '../../config/contract';

export function Footer() {
  return (
    <footer>
      <div className="inner">
        <div>
          <div>Dots &mdash; MegaETH testnet</div>
          <div className="contract">
            {hasContract
              ? `Contract: ${CONTRACT_ADDRESS}`
              : 'Contract: not deployed'}
          </div>
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
      </div>
    </footer>
  );
}
