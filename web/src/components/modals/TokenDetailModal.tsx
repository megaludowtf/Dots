import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePublicClient } from 'wagmi';
import { useLineage } from '@/contexts/LineageContext';
import { CONTRACT_ADDRESS, ABI, hasContract } from '@/config/contract';
import { glyphCount } from '@/art/art';

const COLOR_BAND_LABELS = ['Eighty', 'Sixty', 'Forty', 'Twenty', 'Ten', 'Five', 'One'];
const GRADIENT_LABELS = ['None', 'Linear', 'Double Linear', 'Reflected', 'Double Angled', 'Angled', 'Linear Z'];

interface TokenDetailModalProps {
  token: any | null;
  onClose: () => void;
}

export function TokenDetailModal({ token, onClose }: TokenDetailModalProps) {
  const { open: openLineage } = useLineage();
  const publicClient = usePublicClient();
  const [onchainSvg, setOnchainSvg] = useState<string | null>(null);
  const [onchainTraits, setOnchainTraits] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Fetch canonical tokenURI + getDot when modal opens for a token.
  useEffect(() => {
    if (!token || !publicClient || !hasContract) {
      setOnchainSvg(null);
      setOnchainTraits(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setOnchainSvg(null);
    setOnchainTraits(null);

    (async () => {
      try {
        const [uri, dot] = await Promise.all([
          publicClient.readContract({
            address: CONTRACT_ADDRESS, abi: ABI,
            functionName: 'tokenURI', args: [BigInt(token.id)],
          }) as Promise<string>,
          publicClient.readContract({
            address: CONTRACT_ADDRESS, abi: ABI,
            functionName: 'getDot', args: [BigInt(token.id)],
          }),
        ]);
        if (cancelled) return;

        // Decode SVG from tokenURI
        if (uri.startsWith('data:application/json;base64,')) {
          const json = JSON.parse(atob(uri.slice('data:application/json;base64,'.length)));
          const imgUri: string = json.image ?? '';
          if (imgUri.startsWith('data:image/svg+xml;base64,')) {
            setOnchainSvg(atob(imgUri.slice('data:image/svg+xml;base64,'.length)));
          }
        }

        // Use getDot for canonical traits
        const d = dot as any;
        setOnchainTraits({
          seed: Number(d.seed),
          divisorIndex: Number(d.divisorIndex),
          merged: Number(d.merged),
          colorBandIdx: Number(d.colorBandIdx),
          gradientIdx: Number(d.gradientIdx),
          direction: Number(d.direction),
          speed: Number(d.speed),
          isMega: Number(d.isMega),
        });
      } catch (e) {
        console.debug('TokenDetail fetch failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token?.id, publicClient]);

  useEffect(() => {
    if (!token) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [token, onClose]);

  if (!token) return null;

  // Use onchain traits when available, fall back to token props
  const t = onchainTraits ?? token;
  const gc = glyphCount(t.divisorIndex);

  const speedLabel = (s: number) => s === 1 ? '2x' : s === 2 ? '1x' : '0.5x';
  const traits = [
    { label: 'Token ID', value: `#${token.id}` },
    { label: 'Level', value: `${t.divisorIndex}` },
    { label: 'Dots', value: `${gc}` },
    { label: 'Band', value: COLOR_BAND_LABELS[t.colorBandIdx ?? 0] },
    { label: 'Gradient', value: GRADIENT_LABELS[t.gradientIdx ?? 0] },
    { label: 'Shift', value: t.direction === 1 ? 'UV' : 'IR' },
    { label: 'Speed', value: speedLabel(t.speed ?? 1) },
    { label: 'Seed', value: `0x${((t.seed ?? token.seed) >>> 0).toString(16).padStart(8, '0')}` },
  ];

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
      }} />

      <div style={{
        position: 'relative',
        background: 'var(--bg, #0a0a14)',
        border: '1px solid var(--border-strong, #333)',
        borderRadius: 8,
        width: 'calc(100vw - 48px)',
        maxWidth: 900,
        maxHeight: 'calc(100vh - 48px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 8, right: 8, zIndex: 2,
          width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', border: '1px solid var(--border, #222)',
          color: 'var(--text-muted, #888)', fontSize: 16, cursor: 'pointer', borderRadius: 4,
        }}>&times;</button>

        {/* NFT art — canonical onchain SVG when loaded, placeholder while fetching */}
        <div style={{
          flex: '0 0 auto',
          background: '#08080f',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
          overflow: 'hidden',
        }}>
          <div
            style={{
              height: 'calc(100vh - 300px)',
              maxHeight: 650,
              aspectRatio: '680 / 840',
              maxWidth: '100%',
              position: 'relative',
            }}
          >
            {onchainSvg ? (
              <div
                style={{ width: '100%', height: '100%' }}
                dangerouslySetInnerHTML={{ __html: onchainSvg.replace(/width="680"\s*height="840"/, 'width="100%" height="100%"') }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#0a0a14', borderRadius: 4,
                color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11,
              }}>
                {loading ? 'Loading onchain art…' : 'Art unavailable'}
              </div>
            )}
          </div>
        </div>

        {/* Traits + buttons */}
        <div style={{
          flex: '0 0 auto',
          padding: '12px 14px 14px',
          borderTop: '1px solid var(--border, #222)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            <span style={{
              fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 18, color: '#fff',
            }}>Dot #{token.id}</span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>{gc} {gc === 1 ? 'dot' : 'dots'} &middot; Lv {t.divisorIndex}</span>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1px', background: 'var(--border, #222)', borderRadius: 3,
            overflow: 'hidden', marginBottom: 10,
          }}>
            {traits.map((tr) => (
              <div key={tr.label} style={{ padding: '6px 6px', background: 'var(--bg, #0a0a14)' }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 7,
                  color: 'var(--text-muted)', textTransform: 'uppercase',
                  letterSpacing: '0.1em', marginBottom: 2,
                }}>{tr.label}</div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, color: '#fff',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{tr.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { onClose(); openLineage(token.id); }} style={{
              flex: 1, padding: '10px', background: 'var(--text, #fff)', color: 'var(--bg, #000)',
              border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)',
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em',
            }}>View Tree</button>
            <button onClick={onClose} style={{
              flex: 1, padding: '10px', background: 'transparent', color: 'var(--text-muted)',
              border: '1px solid var(--border, #333)', cursor: 'pointer', fontFamily: 'var(--font-mono)',
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em',
            }}>Close</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
