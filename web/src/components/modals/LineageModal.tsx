import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLineage } from '@/contexts/LineageContext';
import { useEventCache } from '@/hooks/useEventCache';
import { buildLineageNode, layoutTree, type TreeNode } from '@/lib/tokenUtils';
// @ts-ignore
import { glyphCount } from '@/art/art';

const ZOOM_STEP = 0.15;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;

// SVG node dimensions for tree rendering
const NODE_W = 80;
const NODE_H = 100;
const NODE_GAP_Y = 120;

function renderTreeSvg(root: TreeNode): string {
  const lines: string[] = [];
  const nodes: string[] = [];

  function walk(n: TreeNode) {
    // Draw connector lines to children
    for (const c of n.children) {
      lines.push(
        `<line x1="${n.x}" y1="${n.y + NODE_H}" x2="${c.x}" y2="${c.y}" stroke="#242430" stroke-width="1" />`
      );
      walk(c);
    }

    // Draw the node itself
    const isRoot = n.y === 0;
    const rootClass = isRoot ? ' lineage-node-root' : '';
    const fill = n.missing ? '#0d0d12' : '#0a0a0d';
    const strokeColor = isRoot ? '#fff' : '#242430';

    nodes.push(
      `<g class="lineage-node${rootClass}" data-id="${n.id}" transform="translate(${n.x - NODE_W / 2},${n.y})">
        <rect width="${NODE_W}" height="${NODE_H}" fill="${fill}" stroke="${strokeColor}" stroke-width="1" rx="0" />
        ${n.svg ? `<g transform="scale(${NODE_W / 680}, ${(NODE_H - 20) / 840}) translate(0,0)">${n.svg.replace(/<\/?svg[^>]*>/g, '')}</g>` : ''}
        <text x="${NODE_W / 2}" y="${NODE_H + 14}" text-anchor="middle" fill="#8b8b93" font-family="monospace" font-size="9" letter-spacing="0.1em">#${n.id}${n.missing ? ' ?' : ''}</text>
      </g>`
    );
  }

  walk(root);

  // Compute viewBox
  let minX = Infinity, maxX = -Infinity, maxY = 0;
  function bounds(n: TreeNode) {
    minX = Math.min(minX, n.x - NODE_W / 2 - 10);
    maxX = Math.max(maxX, n.x + NODE_W / 2 + 10);
    maxY = Math.max(maxY, n.y + NODE_H + 24);
    for (const c of n.children) bounds(c);
  }
  bounds(root);

  const w = maxX - minX;
  const h = maxY;

  return `<svg class="lineage-svg" viewBox="${minX} -10 ${w} ${h + 20}" width="${w}" height="${h + 20}" xmlns="http://www.w3.org/2000/svg">${lines.join('')}${nodes.join('')}</svg>`;
}

export function LineageModal() {
  const { tokenId, close } = useLineage();
  const { mintedBy, mergedBy, infinityBy } = useEventCache();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [breadcrumbs, setBreadcrumbs] = useState<number[]>([]);

  const isOpen = tokenId !== null;
  const activeId = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : tokenId;

  // Lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setBreadcrumbs([]);
    }
  }, [isOpen, tokenId]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  // Ctrl+wheel zoom
  useEffect(() => {
    if (!isOpen) return;
    const el = viewportRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((z) => {
          const next = z + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
          return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
        });
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [isOpen]);

  // Build tree
  const treeSvg = useMemo(() => {
    if (activeId === null || !mintedBy || !mergedBy || !infinityBy) return null;
    try {
      const idStr = String(activeId);
      // Determine the level of this token
      const mergeList = mergedBy.get(idStr);
      let level = mergeList ? mergeList.length : 0;
      if (infinityBy.has(idStr)) level = 7;

      const node = buildLineageNode(idStr, level, mintedBy, mergedBy, infinityBy);
      if (!node) return null;
      const laid = layoutTree(node);
      return renderTreeSvg(laid);
    } catch {
      return null;
    }
  }, [activeId, mintedBy, mergedBy, infinityBy]);

  const navigateTo = useCallback(
    (idx: number) => {
      if (idx < 0) {
        setBreadcrumbs([]);
      } else {
        setBreadcrumbs((bc) => bc.slice(0, idx + 1));
      }
    },
    [],
  );

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  const resetZoom = () => setZoom(1);

  // Handle click on a tree node to drill down
  useEffect(() => {
    if (!isOpen) return;
    const el = viewportRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const target = (e.target as Element).closest('.lineage-node');
      if (!target) return;
      const id = target.getAttribute('data-id');
      if (id && Number(id) !== activeId) {
        setBreadcrumbs((bc) => [...bc, Number(id)]);
      }
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [isOpen, activeId]);

  if (!isOpen) return null;

  return createPortal(
    <div className="lineage-modal">
      <div className="lineage-backdrop" onClick={close} />
      <div className="lineage-dialog">
        <div className="lineage-head">
          <div>
            <div className="lineage-eyebrow">Lineage</div>
            <div className="lineage-title">Token #{tokenId}</div>
          </div>
          <div className="lineage-head-actions">
            <div className="lineage-zoom">
              <button className="lineage-zoom-btn" onClick={zoomOut}>
                &minus;
              </button>
              <span className="lineage-zoom-level">
                {Math.round(zoom * 100)}%
              </span>
              <button className="lineage-zoom-btn" onClick={zoomIn}>
                +
              </button>
              <button className="lineage-zoom-reset" onClick={resetZoom}>
                Reset
              </button>
            </div>
            <button className="lineage-close" onClick={close}>
              &times;
            </button>
          </div>
        </div>

        <div className="lineage-toolbar">
          <div className="lineage-breadcrumb">
            <button
              className={`lineage-crumb${breadcrumbs.length === 0 ? ' active' : ''}`}
              onClick={() => navigateTo(-1)}
            >
              #{tokenId}
            </button>
            {breadcrumbs.map((id, idx) => (
              <span key={idx}>
                <span className="lineage-crumb-sep">&rsaquo;</span>
                <button
                  className={`lineage-crumb${idx === breadcrumbs.length - 1 ? ' active' : ''}`}
                  onClick={() => navigateTo(idx)}
                >
                  #{id}
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="lineage-viewport" ref={viewportRef}>
          {treeSvg ? (
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                transition: 'transform 0.15s ease',
              }}
              dangerouslySetInnerHTML={{ __html: treeSvg }}
            />
          ) : (
            <div className="lineage-empty">
              No lineage data available for this token.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
