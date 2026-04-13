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
const NODE_W = 160;
const NODE_H = 200;
const NODE_GAP_Y = 240;

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
    const isLeaf = n.level === 0 && n.children.length === 0;
    const rootClass = isRoot ? ' lineage-node-root' : '';
    const fill = n.missing ? '#0d0d12' : '#0a0a0d';
    const strokeColor = isRoot ? '#fff' : '#242430';
    const cursor = isLeaf || isRoot ? 'default' : 'pointer';

    const pad = 6;
    const artW = NODE_W - pad * 2;
    const artH = NODE_H - 30;
    nodes.push(
      `<g class="lineage-node${rootClass}" data-id="${n.id}" style="cursor:${cursor}" transform="translate(${n.x - NODE_W / 2},${n.y})">
        <rect class="lineage-hit" ${isLeaf || isRoot ? '' : `data-node-id="${n.id}" data-node-level="${n.level}"`} width="${NODE_W}" height="${NODE_H}" fill="${fill}" stroke="${strokeColor}" stroke-width="${isRoot ? 2 : 1}" rx="4" />
        ${n.svg ? `<svg x="${pad}" y="${pad}" width="${artW}" height="${artH}" viewBox="0 0 680 840" preserveAspectRatio="xMidYMid meet" style="pointer-events:none">${n.svg.replace(/<\/?svg[^>]*>/g, '').replace(/<rect[^>]*fill="#0a0a14"[^>]*\/?>/, '')}</svg>` : `<rect x="${pad}" y="${pad}" width="${artW}" height="${artH}" fill="#1e1e2a" rx="2" style="pointer-events:none" />`}
        <text x="${NODE_W / 2}" y="${NODE_H - 6}" text-anchor="middle" fill="${isRoot ? '#fff' : '#8b8b93'}" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="0.08em" style="pointer-events:none">#${n.id}${n.missing ? ' ?' : ''}</text>
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
  const [breadcrumbs, setBreadcrumbs] = useState<{id: number, level: number}[]>([]);

  const isOpen = tokenId !== null;
  const active = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null;
  const activeId = active ? active.id : tokenId;
  const activeLevel = active ? active.level : null; // null = use token's current level

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
      // Use the explicit level from breadcrumbs if available,
      // otherwise determine from the token's current merge state.
      let level: number;
      if (activeLevel !== null) {
        level = activeLevel;
      } else {
        const mergeList = mergedBy.get(idStr);
        level = mergeList ? mergeList.length : 0;
        if (infinityBy.has(idStr)) level = 7;
      }

      const node = buildLineageNode(idStr, level, mintedBy, mergedBy, infinityBy);
      if (!node) return null;
      const treeWidth = Math.max(2000, Math.pow(2, level) * (NODE_W + 20));
      const laid = layoutTree(node, NODE_GAP_Y, 0, treeWidth, 0);
      return renderTreeSvg(laid);
    } catch {
      return null;
    }
  }, [activeId, activeLevel, mintedBy, mergedBy, infinityBy]);

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

  // Handle click on a tree node to drill down.
  // Each node's background <rect> carries data-node-id — we check the
  // clicked element and its ancestors for this attribute. This avoids
  // relying on .closest() which can fail across SVG namespace boundaries.
  useEffect(() => {
    if (!isOpen) return;
    const el = viewportRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      let target = e.target as Element | null;
      let id: string | null = null;
      let level: string | null = null;
      // Walk up from the click target looking for data-node-id.
      // Root and leaf nodes don't have data-node-id, so they're
      // naturally excluded (nothing to drill into).
      while (target && target !== el) {
        id = target.getAttribute('data-node-id');
        level = target.getAttribute('data-node-level');
        if (id) break;
        target = target.parentElement;
      }
      if (id) {
        setBreadcrumbs((bc) => [...bc, { id: Number(id!), level: Number(level ?? 0) }]);
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
            {breadcrumbs.map((crumb, idx) => (
              <span key={idx}>
                <span className="lineage-crumb-sep">&rsaquo;</span>
                <button
                  className={`lineage-crumb${idx === breadcrumbs.length - 1 ? ' active' : ''}`}
                  onClick={() => navigateTo(idx)}
                >
                  #{crumb.id}
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
