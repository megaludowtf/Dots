import { useState, useMemo, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useContractStats } from '@/hooks/useContractStats';
import { useMintAction } from '@/hooks/useMintAction';
import { DotArt } from '@/components/shared/DotArt';
import { StatusMessage } from '@/components/shared/StatusMessage';
import { fmtEth } from '@/lib/format';
import { hasContract } from '@/config/contract';
// @ts-ignore
import { randomSeed } from '@/art/art';

const MAX_MINT_PER_TX = 50;

function mintStatusLabel(mintStart: bigint | undefined, mintEnd: bigint | undefined): string {
  if (mintStart === undefined || mintEnd === undefined) return '...';
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (mintStart > 0n && now < mintStart) return 'Not open';
  if (mintEnd > 0n && now > mintEnd) return 'Closed';
  return 'Open';
}

export function MintPage() {
  const { isConnected } = useAccount();
  const { mintPrice, nextTokenId, mintStart, mintEnd, isLoading } = useContractStats();
  const { mint, status, error, txHash } = useMintAction();

  const [amount, setAmount] = useState(1);
  const [inputValue, setInputValue] = useState('1');
  const [seed] = useState(() => randomSeed());

  const clamp = useCallback(
    (n: number) => Math.max(1, Math.min(MAX_MINT_PER_TX, Math.round(n) || 1)),
    [],
  );

  const price = mintPrice ?? 0n;
  const totalCost = price * BigInt(amount);

  const check = useMemo(
    () => ({ seed, divisorIndex: 0, merges: [] as number[], isMega: 0 }),
    [seed],
  );

  const handleMint = () => {
    if (!isConnected || !hasContract) return;
    mint(amount, totalCost);
  };

  const statusText = (() => {
    if (status === 'confirming') return 'Confirm in wallet...';
    if (status === 'pending') return 'Waiting for confirmation...';
    if (status === 'success') return `Minted! tx: ${txHash}`;
    if (status === 'error') return error?.message ?? 'Transaction failed';
    return '';
  })();

  const statusTone = status === 'success' ? 'ok' : status === 'error' ? 'err' : '';

  return (
    <section id="mint" className="is-page">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">03 &mdash; Mint</span>
          <h2>Mint a Dot.</h2>
        </div>

        <div className="panel">
          <div className="preview">
            <DotArt check={check} />
          </div>

          <div className="details">
            <div className="row">
              <label>Price</label>
              <span className="value">
                {isLoading ? '...' : `${fmtEth(price)} ETH`}
              </span>
            </div>

            <div className="row">
              <label>Total Minted</label>
              <span className="value">
                {isLoading || nextTokenId === undefined
                  ? '...'
                  : String(Number(nextTokenId) - 1)}
              </span>
            </div>

            <div className="row">
              <label>Status</label>
              <span className="value">{mintStatusLabel(mintStart, mintEnd)}</span>
            </div>

            <div className="amount-row">
              <label>Amount</label>
              <div className="amount-group">
                <button onClick={() => { const v = clamp(amount - 1); setAmount(v); setInputValue(String(v)); }}>
                  &minus;
                </button>
                <input
                  className="count"
                  type="number"
                  min={1}
                  max={MAX_MINT_PER_TX}
                  value={inputValue}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setInputValue(raw);
                    const n = parseInt(raw, 10);
                    if (!isNaN(n)) setAmount(clamp(n));
                  }}
                  onBlur={() => {
                    const v = clamp(amount);
                    setAmount(v);
                    setInputValue(String(v));
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                />
                <button onClick={() => { const v = clamp(amount + 1); setAmount(v); setInputValue(String(v)); }}>+</button>
              </div>
            </div>

            <div className="row">
              <label>Total</label>
              <span className="value">{fmtEth(totalCost)} ETH</span>
            </div>

            <button
              className="mint-btn"
              disabled={!isConnected || !hasContract || status === 'confirming' || status === 'pending'}
              onClick={handleMint}
            >
              MINT
            </button>

            <StatusMessage text={statusText} tone={statusTone as 'ok' | 'err' | ''} />
          </div>
        </div>
      </div>
    </section>
  );
}
