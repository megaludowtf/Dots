// Dots — frontend app
// All static section rendering (hero, mint preview, stats placeholders, FAQ,
// merge UI) runs synchronously from local modules. viem is loaded lazily
// via dynamic import() so the visual part still works if the CDN is blocked.

import { CONTRACT_ADDRESS, ACTIVE_CHAIN, ABI } from "./config.js";
import { renderSVG, randomSeed, glyphCount, deriveTraits } from "./art.js";

const hasContract = CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

// ------------------------------------------------------------------
// Intro — hero auto-cycles through divisor levels
// ------------------------------------------------------------------
const heroArt = document.getElementById("hero-art");
let heroSeed = randomSeed();
let heroDivisor = 0;

function drawHero() {
  heroArt.innerHTML = renderSVG({
    seed: heroSeed,
    divisorIndex: heroDivisor,
    merges: [],
    isMega: heroDivisor === 7 ? 1 : 0,
  });
}
drawHero();
setInterval(() => {
  heroDivisor = (heroDivisor + 1) % 8;
  if (heroDivisor === 0) heroSeed = randomSeed();
  drawHero();
}, 2400);
heroArt.addEventListener("click", () => {
  heroSeed = randomSeed();
  heroDivisor = 0;
  drawHero();
});

// ------------------------------------------------------------------
// Mint preview
// ------------------------------------------------------------------
document.getElementById("mint-preview").innerHTML = renderSVG({
  seed: randomSeed(),
  divisorIndex: 0,
  merges: [],
  isMega: 0,
});

// ------------------------------------------------------------------
// FAQ — items are always expanded; no accordion behaviour.
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Amount selector — <input type="number"> backed by +/- buttons. Users
// can click the steppers or type a value directly; the value is clamped
// to [1, MAX_MINT_PER_TX] whenever it changes.
// ------------------------------------------------------------------
const MAX_MINT_PER_TX = 50;
const amountEl = document.getElementById("amount-count");
let amount = 1;

function setAmount(next, { repaintInput = true } = {}) {
  let n = Number(next);
  if (!Number.isFinite(n)) n = 1;
  n = Math.floor(n);
  if (n < 1) n = 1;
  if (n > MAX_MINT_PER_TX) n = MAX_MINT_PER_TX;
  amount = n;
  if (repaintInput) amountEl.value = String(amount);
  updateTotalCost();
}

document.getElementById("amount-dec").addEventListener("click", () => {
  setAmount(amount - 1);
});
document.getElementById("amount-inc").addEventListener("click", () => {
  setAmount(amount + 1);
});
// Keep `amount` in sync while the user is typing, but don't rewrite the
// input value on every keystroke (that would fight the caret). Re-paint on
// blur / Enter so "007" snaps back to "7".
amountEl.addEventListener("input", () => {
  setAmount(amountEl.value, { repaintInput: false });
});
amountEl.addEventListener("blur", () => {
  amountEl.value = String(amount);
});
amountEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    amountEl.blur();
  }
});

// ------------------------------------------------------------------
// Stats / mint placeholders
// ------------------------------------------------------------------
// The four headline stat cards (total supply / mints / price / mega) were
// removed from the stats section; circulation strip + mint panel carry the
// same info now. `stats` only tracks the mint panel elements that still exist.
const stats = {
  mintPrice: document.getElementById("mint-stat-price"),
  mintTotal: document.getElementById("mint-stat-total"),
  mintStatus: document.getElementById("mint-stat-status"),
  mintTotalCost: document.getElementById("mint-stat-total-cost"),
};
const circEls = Array.from({ length: 8 }, (_, i) => document.getElementById(`circ-${i}`));
const circTotal = document.getElementById("circulation-total");
const mintStatus = document.getElementById("mint-status");
const mintBtn = document.getElementById("mint-btn");
const connectBtn = document.getElementById("connect-btn");
const exploreGallery = document.getElementById("explore-gallery");
const exploreCount = document.getElementById("explore-count");
const feedList = document.getElementById("feed-list");

function setStatus(el, text, tone) {
  el.textContent = text;
  el.classList.remove("ok", "err");
  if (tone) el.classList.add(tone);
}

let mintPriceWei = 1_000_000_000_000_000n; // 0.001 ETH default

function fmtEth(wei) {
  const n = Number(wei);
  return `${(n / 1e18).toFixed(4)} ETH`;
}
function updateTotalCost() {
  stats.mintTotalCost.textContent = fmtEth(mintPriceWei * BigInt(amount));
}

// Initial placeholders — only the mint panel + circulation strip remain.
stats.mintPrice.textContent = "0.001 ETH";
stats.mintTotal.textContent = "—";
stats.mintStatus.textContent = hasContract ? "Loading…" : "Not deployed";
stats.mintTotalCost.textContent = "0.001 ETH";
circEls.forEach(el => el && (el.textContent = "—"));
circTotal.textContent = hasContract ? "loading…" : "awaiting deploy";
exploreCount.textContent = hasContract ? "loading…" : "awaiting deploy";

if (!hasContract) {
  exploreGallery.innerHTML = `<div class="empty">Gallery will populate once the contract is deployed and the first tokens are minted.</div>`;
  setStatus(mintStatus, "Paste the deployed contract address in web/config.js to enable minting.", "");
}

// ------------------------------------------------------------------
// Lazy viem loader — keeps the site visible if CDN fetch fails
// ------------------------------------------------------------------
let viem = null;
let publicClient = null;
let walletClient = null;
let account = null;

async function loadViem() {
  if (viem) return viem;
  try {
    viem = await import("https://esm.sh/viem@2.21.55");
    const chain = viem.defineChain(ACTIVE_CHAIN);
    publicClient = viem.createPublicClient({
      chain,
      transport: viem.http(ACTIVE_CHAIN.rpcUrls.default.http[0]),
    });
    return viem;
  } catch (e) {
    console.warn("viem failed to load — wallet/mint disabled:", e);
    setStatus(mintStatus, "Wallet features unavailable in this preview (no network).", "");
    return null;
  }
}

async function connect() {
  const v = await loadViem();
  if (!v) return;
  if (!window.ethereum) {
    setStatus(mintStatus, "No wallet found. Install MetaMask or a compatible wallet.", "err");
    return;
  }
  try {
    const chain = v.defineChain(ACTIVE_CHAIN);
    walletClient = v.createWalletClient({ chain, transport: v.custom(window.ethereum) });
    const [addr] = await walletClient.requestAddresses();
    account = addr;
    connectBtn.textContent = `${addr.slice(0, 6)}…${addr.slice(-4)}`;
    connectBtn.classList.add("connected");
    document.body.classList.add("wallet-connected");
    mintBtn.disabled = !hasContract;
    try { await walletClient.switchChain({ id: chain.id }); } catch (_) {
      try { await walletClient.addChain({ chain }); } catch (__) {}
    }
    await loadOwnedTokens();
    // Re-run the router so the Active class refreshes and any newly-visible
    // gated tab becomes reachable from the current hash.
    showPage(currentPageId());
  } catch (e) {
    setStatus(mintStatus, e.shortMessage ?? e.message ?? "Connect failed", "err");
  }
}
connectBtn.addEventListener("click", connect);

// ------------------------------------------------------------------
// Stats loader
// ------------------------------------------------------------------
async function loadStats() {
  if (!hasContract) return;
  const v = await loadViem();
  if (!v) {
    // Graceful fallback when viem can't load (CDN blocked / offline). Only
    // touch elements that actually exist — the headline stat cards were
    // removed earlier, so `stats` only tracks the mint panel elements.
    stats.mintStatus.textContent = "Offline";
    if (circTotal) circTotal.textContent = "offline";
    return;
  }
  try {
    const [price, total, nextId, startBn, endBn, circ] = await Promise.all([
      publicClient.readContract({ address: CONTRACT_ADDRESS, abi: ABI, functionName: "mintPrice" }),
      publicClient.readContract({ address: CONTRACT_ADDRESS, abi: ABI, functionName: "totalSupply" }),
      publicClient.readContract({ address: CONTRACT_ADDRESS, abi: ABI, functionName: "nextTokenId" }),
      publicClient.readContract({ address: CONTRACT_ADDRESS, abi: ABI, functionName: "mintStart" }),
      publicClient.readContract({ address: CONTRACT_ADDRESS, abi: ABI, functionName: "mintEnd" }),
      publicClient.readContract({ address: CONTRACT_ADDRESS, abi: ABI, functionName: "circulation" }),
    ]);
    mintPriceWei = price;
    const mints = Number(nextId) - 1;
    stats.mintPrice.textContent = v.formatEther(price) + " ETH";
    stats.mintTotal.textContent = mints.toString();

    // Circulation breakdown by divisorIndex (0 = 80 glyphs ... 7 = mega dot).
    let circSum = 0n;
    for (let i = 0; i < 8; ++i) {
      const n = circ[i];
      if (circEls[i]) circEls[i].textContent = n.toString();
      circSum += n;
    }
    circTotal.textContent = `${circSum.toString()} live`;

    const now = Math.floor(Date.now() / 1000);
    const start = Number(startBn);
    const end = Number(endBn);
    let status;
    if (now < start) status = "Not open";
    else if (now >= end) status = "Closed";
    else status = "Open";
    stats.mintStatus.textContent = status;
  } catch (e) {
    stats.mintStatus.textContent = "Error";
    console.error(e);
  }
  updateTotalCost();
}

// ------------------------------------------------------------------
// Mint button
// ------------------------------------------------------------------
mintBtn.addEventListener("click", async () => {
  const v = await loadViem();
  if (!v) return;
  if (!walletClient || !account) { setStatus(mintStatus, "Connect your wallet first", "err"); return; }
  if (!hasContract) { setStatus(mintStatus, "Contract address not set", "err"); return; }
  mintBtn.disabled = true;
  setStatus(mintStatus, "Confirm in wallet…", "");
  try {
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS, abi: ABI, functionName: "mint",
      args: [BigInt(amount)], value: mintPriceWei * BigInt(amount), account,
    });
    setStatus(mintStatus, `Submitted ${hash.slice(0, 10)}… waiting`, "");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "success") {
      setStatus(mintStatus, `Minted ${amount} token${amount > 1 ? "s" : ""}`, "ok");
      invalidateEventCache();
      // ensureEventCache is idempotent — parallel callers share one fetch.
      // loadOwnedTokens uses Transfer logs independently so it's safe to
      // fire in parallel with the event-cache consumers.
      await Promise.all([
        loadStats(),
        loadGallery(),
        loadOwnedTokens(),
        loadTimeline(),
      ]);
    } else {
      setStatus(mintStatus, "Transaction reverted", "err");
    }
  } catch (e) {
    setStatus(mintStatus, e.shortMessage ?? e.message ?? "Mint failed", "err");
  } finally {
    mintBtn.disabled = false;
  }
});

// ------------------------------------------------------------------
// Explore gallery — live from contract
// ------------------------------------------------------------------
// Three-way filter: Dots (glyph count) / Gradient (trait) / Color band (trait).
// Each holds the stringified dropdown value, with "all" meaning no filter.
const exploreFilters = {
  glyphs:   "all",
  gradient: "all",
  band:     "all",
  // Sort order — "latest" = newest id first, "number" = id ascending.
  sort:     "latest",
};

function bindExploreFilter(id, key) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("change", () => {
    exploreFilters[key] = el.value;
    // Reset pagination so the first page of the new slice renders. The
    // exhaustion flag is computed locally inside renderGallery from the
    // actual filtered length — no stale state to sync here.
    galleryRendered = GALLERY_PAGE_SIZE;
    renderGallery(cachedTokens);
  });
}
bindExploreFilter("filter-glyphs",   "glyphs");
bindExploreFilter("filter-gradient", "gradient");
bindExploreFilter("filter-band",     "band");
bindExploreFilter("filter-sort",     "sort");

let cachedTokens = [];
// Pagination state for the Explore gallery — `cachedTokens` is the full
// event-derived live set, produced in one pass from the cached logs.
// `galleryRendered` is how many filter-filtered tiles to paint; the
// IntersectionObserver sentinel bumps it by GALLERY_PAGE_SIZE on scroll.
// Exhaustion is derived from `galleryRendered >= filtered.length` at
// render time (no separate flag — filter changes would make it lie).
const GALLERY_PAGE_SIZE = 30;
let galleryRendered = 0;
let galleryTotal = 0;
let galleryLoading = false;

// Live (non-burned) token count — derived from events, used by the toolbar.
let galleryLive = 0;

// Single IntersectionObserver instance — re-bound to the fresh sentinel on
// every render. Stored in a module var so stale instances are disconnected
// before a new one is created (prevents observer leaks on fast filter toggles).
let gallerySentinelObserver = null;

// Reverse-lookup maps for the tokenURI `attributes` strings. The contract
// emits "Eighty"/"Sixty"/... and "Linear"/"Reflected"/... as trait values;
// we convert them back to the numeric indices used by the filter UI.
const COLOR_BAND_LABELS = ["Eighty", "Sixty", "Forty", "Twenty", "Ten", "Five", "One"];
const GRADIENT_LABELS   = ["None", "Linear", "Reflected", "Angled", "Double Angled", "Linear Double", "Linear Z"];

// Reconstruct the full set of live tokens from the cached event logs:
//   live = mintedBy keys  -  (merge burnedIds)
//                         -  (infinity non-keeper burnedIds)
//                         -  (explicit Burned events)
// Traits and SVG are NOT derived client-side — art.js's hash function is
// not byte-compatible with the contract's keccak256, so any client-side
// render would show wrong colors. Instead both are hydrated from tokenURI
// in the background; visible tiles show a placeholder until their row in
// the response stream arrives.
function computeLiveTokens() {
  const burned = new Set();
  for (const list of mergedBy.values()) {
    for (const m of list) burned.add(m.burnedId);
  }
  for (const arr of infinityBy.values()) {
    // index 0 is the surviving keeper (Mega Dot), 1..63 are burned.
    for (let i = 1; i < arr.length; ++i) burned.add(arr[i]);
  }
  for (const ev of cachedEvents) {
    if (ev.name === "Burned") burned.add(ev.args.tokenId.toString());
  }

  const live = [];
  for (const [idStr, mint] of mintedBy) {
    if (burned.has(idStr)) continue;
    const id = Number(idStr);
    const mergeList = mergedBy.get(idStr) || [];
    let divisorIndex = mergeList.length; // 0 for unmerged, 6 for single dot
    let isMega = 0;
    if (infinityBy.has(idStr)) {
      // Keeper of a Mega Dot terminal event. The contract's infinity()
      // does NOT touch k.merges, so we leave mergeList (the 0->6 ladder)
      // alone here — no infinity siblings appended.
      divisorIndex = 7;
      isMega = 1;
    }
    live.push({
      id,
      seed: mint.seed,
      divisorIndex,
      isMega,
      // Hydrated lazily from tokenURI below.
      svg: null,
      colorBandIdx: undefined,
      gradientIdx:  undefined,
      direction:    undefined,
      speed:        undefined,
      // fetchStatus: null | "pending" | "ok" | "fail"
      fetchStatus: null,
    });
  }
  return live;
}

// Lazy-fetch tokenURI SVGs + traits and paint them in place. Visible-first
// queue order: tiles already in the DOM are fetched before the rest of the
// live list so first-paint feels snappy. Concurrency is capped so we don't
// flood the RPC on cold loads. Dedupes via fetchStatus.
const GALLERY_FETCH_CONCURRENCY = 8;
let galleryHydratePromise = null;

async function hydrateGalleryTokens() {
  if (!cachedTokens.length || !publicClient) return;
  // Resume an in-flight hydration run instead of double-fetching.
  if (galleryHydratePromise) return galleryHydratePromise;

  galleryHydratePromise = (async () => {
    const pending = cachedTokens.filter(t => !t.svg && t.fetchStatus !== "pending");
    if (!pending.length) return;

    // Visible-first ordering — queue up tiles currently in the DOM before
    // any off-screen tokens. Pure priority hint, no correctness impact.
    const visibleIds = new Set();
    exploreGallery.querySelectorAll(".token").forEach(el =>
      visibleIds.add(parseInt(el.dataset.id, 10))
    );
    pending.sort((a, b) => (visibleIds.has(b.id) ? 1 : 0) - (visibleIds.has(a.id) ? 1 : 0));

    for (const t of pending) t.fetchStatus = "pending";
    const queue = pending.slice();

    const workers = Array.from({ length: GALLERY_FETCH_CONCURRENCY }, async () => {
      while (queue.length) {
        const t = queue.shift();
        if (!t) return;
        try {
          const uri = await publicClient.readContract({
            address: CONTRACT_ADDRESS, abi: ABI,
            functionName: "tokenURI", args: [BigInt(t.id)],
          });
          const json = JSON.parse(atob(uri.split(",")[1]));
          t.svg = atob(json.image.split(",")[1]);
          // Reverse-map the attribute strings to numeric trait indices.
          for (const a of (json.attributes || [])) {
            if      (a.trait_type === "Color Band") t.colorBandIdx = COLOR_BAND_LABELS.indexOf(a.value);
            else if (a.trait_type === "Gradient")   t.gradientIdx  = GRADIENT_LABELS.indexOf(a.value);
            else if (a.trait_type === "Direction")  t.direction    = a.value === "Reverse" ? 1 : 0;
            else if (a.trait_type === "Speed")      t.speed        = Number(a.value);
          }
          t.fetchStatus = "ok";
        } catch (e) {
          // Race: token could have been burned between the event scan and the read.
          console.debug("gallery hydrate failed for", t.id, e.shortMessage ?? e.message);
          t.fetchStatus = "fail";
        }
        // Swap the placeholder for the real SVG without tearing down the
        // grid. If the tile isn't currently visible (filter change, user
        // scrolled away), the next renderGallery call will pick it up from
        // t.svg automatically.
        const el = exploreGallery.querySelector(`.token[data-id="${t.id}"] .art`);
        if (el && t.svg) el.innerHTML = t.svg;
        else if (el && t.fetchStatus === "fail") el.innerHTML = `<div class="art-fail">—</div>`;
      }
    });
    await Promise.all(workers);
    // If a trait-based filter is active, some tiles were excluded while
    // their traits were undefined. Re-render once so they pop into the
    // grid now that hydration has landed.
    if (exploreFilters.gradient !== "all" || exploreFilters.band !== "all") {
      renderGallery(cachedTokens);
    }
  })();
  try { await galleryHydratePromise; }
  finally { /* keep the resolved promise so re-entrants short-circuit */ }
}

async function loadGallery() {
  if (!hasContract) return;
  const v = await loadViem();
  if (!v) return;
  try {
    galleryLoading = true;
    exploreCount.textContent = "syncing…";
    // A single getLogs sweep (Minted/Merged/Burned/Infinity) populates the
    // shared cache. No per-id RPC walk needed.
    await ensureEventCache();

    cachedTokens = computeLiveTokens();
    galleryLive = cachedTokens.length;
    galleryTotal = cachedTokens.length;
    // Reset hydration state — fresh cachedTokens need fresh fetches.
    galleryHydratePromise = null;
    exploreCount.textContent = `${galleryLive} tokens`;

    if (galleryLive === 0) {
      exploreGallery.innerHTML = `<div class="empty">No tokens minted yet. Be the first.</div>`;
      return;
    }

    // Render the placeholder grid immediately; the sentinel observer bumps
    // galleryRendered as the user scrolls. Hydration runs fire-and-forget
    // behind it.
    galleryRendered = GALLERY_PAGE_SIZE;
    renderGallery(cachedTokens);
    hydrateGalleryTokens();
  } catch (e) {
    console.error(e);
    exploreGallery.innerHTML = `<div class="empty">Failed to load gallery.</div>`;
  } finally {
    galleryLoading = false;
  }
}

// Reveal the next slice of the already-in-memory live list.
function loadGalleryBatch() {
  if (galleryLoading) return;
  galleryLoading = true;
  galleryRendered += GALLERY_PAGE_SIZE;
  renderGallery(cachedTokens);
  galleryLoading = false;
}

function renderGallery(tokens) {
  // Always disconnect the previous sentinel observer — a fresh one is
  // created below for the new sentinel element. Prevents observer leaks.
  if (gallerySentinelObserver) {
    gallerySentinelObserver.disconnect();
    gallerySentinelObserver = null;
  }

  const filtered = tokens.filter(t => {
    // Dots (glyph count) — always available, computed from divisorIndex.
    if (exploreFilters.glyphs !== "all") {
      if (glyphCount(t.divisorIndex) !== parseInt(exploreFilters.glyphs, 10)) return false;
    }
    // Gradient / Color band — hydrated lazily from tokenURI attributes.
    // An un-hydrated token has `undefined` here; we exclude it from the
    // filtered view until hydration lands and the filter re-applies
    // naturally on the next render (hydration runs fire-and-forget after
    // loadGallery and triggers no re-render itself, but on-screen tiles
    // get their art swapped in-place so it's fine).
    if (exploreFilters.gradient !== "all") {
      if (t.gradientIdx === undefined) return false;
      if (t.gradientIdx !== parseInt(exploreFilters.gradient, 10)) return false;
    }
    if (exploreFilters.band !== "all") {
      if (t.colorBandIdx === undefined) return false;
      if (t.colorBandIdx !== parseInt(exploreFilters.band, 10)) return false;
    }
    return true;
  });
  // Sort: "latest" = newest id first (descending), "number" = id ascending.
  if (exploreFilters.sort === "number") {
    filtered.sort((a, b) => a.id - b.id);
  } else {
    filtered.sort((a, b) => b.id - a.id);
  }
  // Pagination: cap visible tiles at galleryRendered and compute exhaustion
  // locally from the actual filtered length (no stale flag to sync).
  const visibleCount = Math.min(galleryRendered, filtered.length);
  const slice = filtered.slice(0, visibleCount);
  const exhausted = slice.length >= filtered.length;
  // Toolbar count — show total live supply when no active filter narrows
  // the set, otherwise "N of M tokens".
  const filterActive = exploreFilters.glyphs !== "all";
  if (filterActive) {
    exploreCount.textContent = `${filtered.length} of ${galleryLive} tokens`;
  } else {
    exploreCount.textContent = `${galleryLive} tokens`;
  }
  // Render tiles with either the cached canonical SVG or a placeholder
  // that hydrateGalleryTokens will swap in once tokenURI returns.
  const tilesHtml = slice.map(t => {
    const art = t.svg
      ? t.svg
      : `<div class="art-placeholder" aria-hidden="true"></div>`;
    return `
      <div class="token" data-id="${t.id}" data-d="${t.divisorIndex}">
        <div class="art">${art}</div>
        <div class="meta">
          <span class="id">#${t.id}</span>
          <span class="glyphs">${glyphCount(t.divisorIndex)} ${glyphCount(t.divisorIndex) === 1 ? "dot" : "dots"}</span>
        </div>
      </div>
    `;
  }).join("");
  // Empty-state notice: distinguish "nothing minted" from "filter matches none".
  const emptyNotice = filtered.length === 0
    ? `<div class="empty">${galleryLive === 0 ? "No tokens minted yet. Be the first." : "No tokens match this filter."}</div>`
    : "";
  const sentinel = !exhausted
    ? `<div class="gallery-sentinel" id="gallery-sentinel">Loading more…</div>`
    : (filtered.length > 0
        ? `<div class="gallery-end">End of feed — ${filtered.length} tokens</div>`
        : "");
  exploreGallery.innerHTML = emptyNotice + tilesHtml + sentinel;

  const sentinelEl = document.getElementById("gallery-sentinel");
  if (sentinelEl) {
    gallerySentinelObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          gallerySentinelObserver.disconnect();
          gallerySentinelObserver = null;
          loadGalleryBatch();
        }
      }
    }, { rootMargin: "200px" });
    gallerySentinelObserver.observe(sentinelEl);
  }

  // Kick off lazy tokenURI hydration for any tiles that still lack an
  // SVG. Fire-and-forget; hydrateGalleryTokens dedupes via fetchStatus
  // and mutates tile DOM in place as responses arrive.
  hydrateGalleryTokens();

  // Clicking a gallery token feeds it into the merge picker.
  exploreGallery.querySelectorAll(".token").forEach(el => {
    el.addEventListener("click", () => {
      const id = parseInt(el.dataset.id, 10);
      const token = cachedTokens.find(t => t.id === id);
      if (!token) return;
      if (!mergeState.survivor) {
        mergeState.survivor = token;
      } else if (!mergeState.burn && token.id !== mergeState.survivor.id) {
        mergeState.burn = token;
      } else {
        mergeState.survivor = token;
        mergeState.burn = null;
      }
      renderMergeSlots();
      document.getElementById("merge").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

// ------------------------------------------------------------------
// Merge workspace
// ------------------------------------------------------------------
const mergeState = { survivor: null, burn: null };
const slotSurvivor = document.getElementById("slot-survivor");
const slotBurn = document.getElementById("slot-burn");
const slotResult = document.getElementById("slot-result");
const mergeBtn = document.getElementById("merge-btn");
const mergeStatus = document.getElementById("merge-status");
const mergeSwap = document.getElementById("merge-swap");

slotSurvivor.addEventListener("click", () => pickSlot("survivor"));
slotBurn.addEventListener("click", () => pickSlot("burn"));

function pickSlot(which) {
  // Open the modal picker for this slot. The modal handles source-selection
  // (wallet vs. gallery), same-divisor filtering, and the click-to-select
  // interaction. See openPicker() below.
  openPicker(which);
}

// ------------------------------------------------------------------
// Modal token picker — used by merge slots
// ------------------------------------------------------------------
const pickerModalEl   = document.getElementById("picker-modal");
const pickerGridEl    = document.getElementById("picker-grid");
const pickerHintEl    = document.getElementById("picker-hint");
const pickerTitleEl   = document.getElementById("picker-title");
const pickerEyebrowEl = document.getElementById("picker-eyebrow");

let pickerFor = null;   // "survivor" | "burn" while modal is open

function openPicker(which) {
  pickerFor = which;

  // Decide which list of tokens to show. Wallet-connected users get their
  // own holdings; everyone else falls back to the Explore gallery cache.
  const source = account && ownedTokens.length > 0 ? ownedTokens : cachedTokens;

  // Same-divisor requirement: if the OTHER slot already has a token, this
  // slot must pick something at the same divisorIndex (contract enforces).
  const otherKey = which === "survivor" ? "burn" : "survivor";
  const other = mergeState[otherKey];
  const excludeId = other?.id;
  const requiredDivisor = other ? other.divisorIndex : null;

  const eligible = source.filter(t =>
    t.id !== excludeId &&
    (requiredDivisor === null || t.divisorIndex === requiredDivisor)
  );

  pickerEyebrowEl.textContent = which === "survivor" ? "Survivor slot" : "Burn slot";
  pickerTitleEl.textContent   = account && ownedTokens.length > 0 ? "Your wallet" : "Explore feed";

  let hint;
  if (!account && cachedTokens.length === 0) {
    hint = "Connect your wallet or load the Explore page first.";
  } else if (requiredDivisor !== null) {
    hint = `Must match the other slot — level ${requiredDivisor} only.`;
  } else {
    hint = "Pick any token; the next slot will lock to its level.";
  }
  pickerHintEl.textContent = hint;

  if (eligible.length === 0) {
    pickerGridEl.innerHTML = `<div class="picker-empty">
      ${account
        ? (ownedTokens.length === 0
            ? "No Dots in this wallet yet. Mint or buy one first."
            : `No matching tokens. You need a token at level ${requiredDivisor} to merge with the ${otherKey} slot.`)
        : "No tokens loaded. Connect your wallet or open the Explore page."}
    </div>`;
  } else {
    pickerGridEl.innerHTML = eligible.map(t => `
      <div class="picker-card" data-id="${t.id}">
        <div class="art">${t.svg}</div>
        <div class="meta">
          <span class="id">#${t.id}</span>
          <span class="glyphs">${glyphCount(t.divisorIndex)}</span>
        </div>
      </div>
    `).join("");

    // Click to select → assign to the slot + close.
    pickerGridEl.querySelectorAll(".picker-card").forEach(el => {
      el.addEventListener("click", () => {
        const id = parseInt(el.dataset.id, 10);
        const token = source.find(t => t.id === id);
        if (!token) return;
        mergeState[pickerFor] = token;
        closePicker();
        renderMergeSlots();
      });
    });
  }

  pickerModalEl.hidden = false;
  // Lock body scroll while modal is open.
  document.body.style.overflow = "hidden";
  // Trap Escape to close.
  document.addEventListener("keydown", onPickerKey);
}

function closePicker() {
  pickerModalEl.hidden = true;
  document.body.style.overflow = "";
  document.removeEventListener("keydown", onPickerKey);
  pickerFor = null;
}

function onPickerKey(e) {
  if (e.key === "Escape") closePicker();
}

// Backdrop / close-button click handler. `data-close="1"` marks any element
// that should dismiss the modal when clicked.
pickerModalEl?.addEventListener("click", (e) => {
  if (e.target.closest("[data-close='1']")) closePicker();
});

function renderMergeSlots() {
  [["survivor", slotSurvivor], ["burn", slotBurn]].forEach(([key, el]) => {
    const token = mergeState[key];
    if (token) {
      el.classList.add("filled");
      el.innerHTML = token.svg;
    } else {
      el.classList.remove("filled");
      el.innerHTML = `<div class="placeholder">Click to pick<br>${key}</div>`;
    }
  });

  // Result preview: simulate one merge step based on survivor
  const s = mergeState.survivor;
  const b = mergeState.burn;
  let canMerge = false;
  if (s && b) {
    if (s.id === b.id) {
      setStatus(mergeStatus, "Survivor and burn must be different tokens.", "err");
    } else if (s.divisorIndex !== b.divisorIndex) {
      setStatus(mergeStatus, "Both tokens must share the same level.", "err");
    } else if (s.divisorIndex >= 6) {
      setStatus(mergeStatus, "Cannot merge past level 5. Use infinity() for the Mega Dot.", "err");
    } else {
      canMerge = true;
      setStatus(mergeStatus, `Ready to merge. Survivor advances to ${glyphCount(s.divisorIndex + 1)} dots.`, "");
    }
  } else {
    setStatus(mergeStatus, "", "");
  }

  if (canMerge) {
    const nextD = s.divisorIndex + 1;
    slotResult.classList.add("filled");
    slotResult.innerHTML = renderSVG({
      seed: mergeSwap.checked ? b.seed ?? Number(b.id) : (s.seed ?? Number(s.id)),
      divisorIndex: nextD,
      merges: [],
      isMega: 0,
    });
  } else {
    slotResult.classList.remove("filled");
    slotResult.innerHTML = `<div class="placeholder">Merged<br>result preview</div>`;
  }

  mergeBtn.disabled = !canMerge || !hasContract || !walletClient;
}

mergeSwap.addEventListener("change", renderMergeSlots);

mergeBtn.addEventListener("click", async () => {
  const v = await loadViem();
  if (!v || !walletClient || !account) {
    setStatus(mergeStatus, "Connect your wallet first", "err");
    return;
  }
  const { survivor, burn } = mergeState;
  if (!survivor || !burn) return;
  mergeBtn.disabled = true;
  setStatus(mergeStatus, "Confirm in wallet…", "");
  try {
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS, abi: ABI, functionName: "merge",
      args: [BigInt(survivor.id), BigInt(burn.id), mergeSwap.checked], account,
    });
    setStatus(mergeStatus, `Submitted ${hash.slice(0, 10)}… waiting`, "");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "success") {
      setStatus(mergeStatus, `Merged #${survivor.id} ← #${burn.id}`, "ok");
      mergeState.survivor = null;
      mergeState.burn = null;
      renderMergeSlots();
      invalidateEventCache();
      await Promise.all([
        loadStats(),
        loadGallery(),
        loadOwnedTokens(),
        loadTimeline(),
      ]);
    } else {
      setStatus(mergeStatus, "Transaction reverted", "err");
    }
  } catch (e) {
    setStatus(mergeStatus, e.shortMessage ?? e.message ?? "Merge failed", "err");
  } finally {
    mergeBtn.disabled = false;
  }
});

// ------------------------------------------------------------------
// Owned tokens — live scan via ERC-721 Transfer events.
// ------------------------------------------------------------------
// viem's eth_getLogs wraps `Transfer(address indexed from, address indexed to,
// uint256 indexed tokenId)`. We fetch all `to === account` logs, subtract all
// `from === account` logs, and the remainder is the current holding set.
// Burned tokens end up with a corresponding `to == zero` log that correctly
// removes them. Works without ERC721Enumerable, which Dots deliberately omits.

const TRANSFER_EVENT = {
  type: "event",
  name: "Transfer",
  inputs: [
    { name: "from",    type: "address", indexed: true },
    { name: "to",      type: "address", indexed: true },
    { name: "tokenId", type: "uint256", indexed: true },
  ],
};

let ownedTokens = [];    // [{id, divisorIndex, svg}]

async function loadOwnedTokens() {
  if (!hasContract || !publicClient || !account) {
    ownedTokens = [];
    renderOwnedSection();
    return;
  }
  try {
    const [inLogs, outLogs] = await Promise.all([
      publicClient.getLogs({
        address: CONTRACT_ADDRESS,
        event: TRANSFER_EVENT,
        args: { to: account },
        fromBlock: 0n,
        toBlock: "latest",
      }),
      publicClient.getLogs({
        address: CONTRACT_ADDRESS,
        event: TRANSFER_EVENT,
        args: { from: account },
        fromBlock: 0n,
        toBlock: "latest",
      }),
    ]);

    // Net incoming - outgoing by walking both lists in block order. A token
    // can hop in/out/in repeatedly; only the final state matters.
    const events = [];
    for (const l of inLogs)  events.push({ block: l.blockNumber, logIndex: l.logIndex, id: l.args.tokenId, direction: +1 });
    for (const l of outLogs) events.push({ block: l.blockNumber, logIndex: l.logIndex, id: l.args.tokenId, direction: -1 });
    events.sort((a, b) =>
      a.block === b.block ? Number(a.logIndex - b.logIndex) : Number(a.block - b.block)
    );
    const held = new Set();
    for (const e of events) {
      const key = e.id.toString();
      if (e.direction > 0) held.add(key);
      else held.delete(key);
    }
    const ids = [...held].map(s => BigInt(s));

    // Fetch live struct + SVG for each held token in parallel.
    const rows = await Promise.all(ids.map(async (id) => {
      try {
        const [dot, uri] = await Promise.all([
          publicClient.readContract({ address: CONTRACT_ADDRESS, abi: ABI, functionName: "getDot",   args: [id] }),
          publicClient.readContract({ address: CONTRACT_ADDRESS, abi: ABI, functionName: "tokenURI", args: [id] }),
        ]);
        const json = JSON.parse(atob(uri.split(",")[1]));
        const svg  = atob(json.image.split(",")[1]);
        return {
          id: Number(id),
          divisorIndex: Number(dot.divisorIndex),
          colorBandIdx: Number(dot.colorBandIdx),
          gradientIdx:  Number(dot.gradientIdx),
          direction:    Number(dot.direction),
          speed:        Number(dot.speed),
          svg,
        };
      } catch (e) {
        // Token may have been burned between the log scan and the read.
        console.warn("owned token", id.toString(), "unreadable:", e);
        return null;
      }
    }));
    ownedTokens = rows.filter(Boolean).sort((a, b) => a.id - b.id);
    renderOwnedSection();
  } catch (e) {
    console.error("loadOwnedTokens failed:", e);
  }
}

// ------------------------------------------------------------------
// Infinity section — pick 64 single dots and submit infinity(tokenIds)
// ------------------------------------------------------------------
const infinityCount   = document.getElementById("infinity-count");
const infinityFill    = document.getElementById("infinity-fill");
const infinityHint    = document.getElementById("infinity-hint");
const infinityGrid    = document.getElementById("infinity-grid");
const infinityBtn     = document.getElementById("infinity-btn");
const infinityStatus  = document.getElementById("infinity-status");

const infinitySelection = new Set(); // Set<number> of tokenIds

// ------------------------------------------------------------------
// Profile page — wallet-scoped grid of every token you hold
// ------------------------------------------------------------------
const profileGridEl  = document.getElementById("profile-grid");
const profileAddrEl  = document.getElementById("profile-addr");
const profileStatsEl = document.getElementById("profile-stats");

// Profile filters mirror the Explore page's three-dropdown model and
// narrow `ownedTokens` on the client before rendering.
const profileFilters = {
  glyphs:   "all",
  gradient: "all",
  band:     "all",
};
function bindProfileFilter(id, key) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("change", () => {
    profileFilters[key] = el.value;
    renderProfile();
  });
}
bindProfileFilter("profile-filter-glyphs",   "glyphs");
bindProfileFilter("profile-filter-gradient", "gradient");
bindProfileFilter("profile-filter-band",     "band");

function renderProfile() {
  if (!profileGridEl) return;
  if (!account) {
    profileAddrEl.textContent = "Not connected";
    profileStatsEl.textContent = "—";
    profileGridEl.innerHTML = `<div class="profile-empty">Connect your wallet to load your tokens.</div>`;
    return;
  }
  profileAddrEl.innerHTML = `<span class="profile-label">Wallet</span><span class="profile-val">${shortAddr(account)}</span>`;
  if (!ownedTokens.length) {
    profileStatsEl.textContent = "0 tokens";
    profileGridEl.innerHTML = `<div class="profile-empty">No Dots in this wallet yet. Mint one to get started.</div>`;
    return;
  }
  // Stats bar always shows the full holdings (unfiltered) so the breakdown
  // is a stable overview of the wallet, not the current filter.
  const byDivisor = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const t of ownedTokens) byDivisor[t.divisorIndex] = (byDivisor[t.divisorIndex] || 0) + 1;
  const glyphLabels = ["80", "40", "20", "10", "5", "4", "1", "∞"];
  const breakdown = byDivisor
    .map((n, i) => n > 0 ? `<span class="profile-stat">${n}×<strong>${glyphLabels[i]}</strong></span>` : null)
    .filter(Boolean)
    .join("");
  profileStatsEl.innerHTML = `<span class="profile-stat"><strong>${ownedTokens.length}</strong> tokens</span>${breakdown}`;

  // Apply the three dropdown filters before rendering.
  const filtered = ownedTokens.filter(t => {
    if (profileFilters.glyphs !== "all"
        && glyphCount(t.divisorIndex) !== parseInt(profileFilters.glyphs, 10)) return false;
    if (profileFilters.gradient !== "all"
        && t.gradientIdx !== parseInt(profileFilters.gradient, 10)) return false;
    if (profileFilters.band !== "all"
        && t.colorBandIdx !== parseInt(profileFilters.band, 10)) return false;
    return true;
  });

  if (filtered.length === 0) {
    profileGridEl.innerHTML = `<div class="profile-empty">No tokens match the current filter.</div>`;
    return;
  }

  profileGridEl.innerHTML = filtered.map(t => `
    <div class="profile-card" data-id="${t.id}" data-d="${t.divisorIndex}">
      <div class="art">${t.svg}</div>
      <div class="meta">
        <span class="id">#${t.id}</span>
        <span class="glyphs">${glyphCount(t.divisorIndex)} dots</span>
      </div>
      <div class="actions">
        <a href="#" class="open-lineage" data-id="${t.id}">Tree</a>
        <a href="#" class="send-to-merge" data-id="${t.id}">Merge</a>
      </div>
    </div>
  `).join("");

  // Wire "Tree" action: open the lineage modal over the current page.
  profileGridEl.querySelectorAll(".open-lineage").forEach(el => {
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      openLineageModal(el.dataset.id);
    });
  });

  // Wire "Merge" action: send this token to the merge slot picker.
  profileGridEl.querySelectorAll(".send-to-merge").forEach(el => {
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      const id = parseInt(el.dataset.id, 10);
      const token = ownedTokens.find(t => t.id === id);
      if (!token) return;
      if (!mergeState.survivor) mergeState.survivor = token;
      else if (!mergeState.burn && token.id !== mergeState.survivor.id) mergeState.burn = token;
      else { mergeState.survivor = token; mergeState.burn = null; }
      renderMergeSlots();
      location.hash = "#merge";
    });
  });
}

function renderOwnedSection() {
  // Drives two pages: the Infinity picker (filtered to single dots) and
  // the Profile grid (full wallet holdings at every divisor).
  renderProfile();
  const singles = ownedTokens.filter(t => t.divisorIndex === 6);
  infinityCount.textContent = singles.length.toString();
  const pct = Math.min(100, (singles.length / 64) * 100);
  infinityFill.style.width = pct + "%";

  if (!account) {
    infinityHint.textContent = "Connect your wallet to see your tokens.";
    infinityGrid.innerHTML = "";
    infinityBtn.disabled = true;
    return;
  }
  if (singles.length === 0) {
    infinityHint.textContent = "You don't hold any single dots yet. Merge 64 → 1 to create your first.";
    infinityGrid.innerHTML = "";
    infinityBtn.disabled = true;
    return;
  }
  if (singles.length < 64) {
    infinityHint.textContent = `${singles.length} single dot${singles.length === 1 ? "" : "s"} in wallet — need ${64 - singles.length} more before infinity unlocks.`;
  } else {
    infinityHint.textContent = `${singles.length} single dots ready. Pick exactly 64; the first one becomes the keeper.`;
  }

  // Prune selection to tokens still owned.
  const ownedIds = new Set(singles.map(t => t.id));
  for (const id of infinitySelection) if (!ownedIds.has(id)) infinitySelection.delete(id);

  infinityGrid.innerHTML = singles.map(t => `
    <div class="tile ${infinitySelection.has(t.id) ? "selected" : ""}" data-id="${t.id}">
      ${t.svg}
      <span class="tid">#${t.id}</span>
    </div>
  `).join("");
  infinityGrid.querySelectorAll(".tile").forEach(el => {
    el.addEventListener("click", () => {
      const id = parseInt(el.dataset.id, 10);
      if (infinitySelection.has(id)) infinitySelection.delete(id);
      else infinitySelection.add(id);
      renderOwnedSection();
    });
  });
  infinityBtn.disabled = !(singles.length >= 64 && infinitySelection.size === 64 && hasContract && walletClient);
}

infinityBtn.addEventListener("click", async () => {
  const v = await loadViem();
  if (!v || !walletClient || !account) {
    setStatus(infinityStatus, "Connect your wallet first", "err");
    return;
  }
  if (infinitySelection.size !== 64) {
    setStatus(infinityStatus, "Select exactly 64 single dots", "err");
    return;
  }
  infinityBtn.disabled = true;
  setStatus(infinityStatus, "Confirm in wallet…", "");
  try {
    const ids = [...infinitySelection].map(n => BigInt(n));
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS, abi: ABI, functionName: "infinity",
      args: [ids], account,
    });
    setStatus(infinityStatus, `Submitted ${hash.slice(0, 10)}… waiting`, "");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "success") {
      setStatus(infinityStatus, "Mega Dot forged. Welcome to level 7.", "ok");
      infinitySelection.clear();
      invalidateEventCache();
      await Promise.all([
        loadStats(),
        loadGallery(),
        loadOwnedTokens(),
        loadTimeline(),
      ]);
    } else {
      setStatus(infinityStatus, "Transaction reverted", "err");
    }
  } catch (e) {
    setStatus(infinityStatus, e.shortMessage ?? e.message ?? "Infinity failed", "err");
  } finally {
    renderOwnedSection();
  }
});

// Initial paint (before wallet connects) so the meter reads "— / 64".
renderOwnedSection();

// ------------------------------------------------------------------
// Hash-based page router
// ------------------------------------------------------------------
// Each nav pill points at `#sectionId`. Rather than scroll, we hide every
// other section and show just the requested one. Native anchor clicks fire
// `hashchange`, so we listen for that and re-render. Deep links still work
// (reload on #stats stays on Stats).

const PAGE_IDS = ["intro", "stats", "mint", "timeline", "faq", "explore", "profile", "merge", "infinity", "feed"];
const pageSections = [...document.querySelectorAll("body > section")];
const navLinks = document.querySelectorAll("nav.top .pills a[href^='#']");
const brandEl = document.querySelector("nav.top .brand");

// Disable scroll restoration — pages are discrete now, each boots at top.
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

// Parse `#route` or `#route/param` from the URL. `currentPageParam()` returns
// the part after the slash (e.g. "42" from "#lineage/42") or null.
function currentPageId() {
  const raw = (location.hash || "").replace("#", "");
  const base = raw.split("/")[0];
  return PAGE_IDS.includes(base) ? base : "intro";
}
function currentPageParam() {
  const raw = (location.hash || "").replace("#", "");
  const parts = raw.split("/");
  return parts.length > 1 ? parts[1] : null;
}

// Routes that require a connected wallet. If the user lands on one without
// a wallet, we silently reroute them back to #intro.
const CONNECTED_ONLY_PAGES = new Set(["profile", "merge", "infinity"]);

function showPage(id) {
  if (CONNECTED_ONLY_PAGES.has(id) && !account) {
    id = "intro";
    if (location.hash !== "#intro") location.hash = "#intro";
  }
  pageSections.forEach(s => s.classList.toggle("is-page", s.id === id));
  navLinks.forEach(a => {
    // Active highlight: match both exact hash and route-prefix for parameterised routes.
    const href = a.getAttribute("href");
    a.classList.toggle("active", href === `#${id}` || href === `#${id}/`);
  });
  // Each page starts at the top.
  window.scrollTo(0, 0);
  // The direction-aware brand hide is retired — pages are short, the brand
  // stays visible throughout the whole experience.
  brandEl?.classList.remove("is-tucked");

  // Route-specific dispatch.
  if (id === "profile") {
    // Always repaint from the cached ownedTokens. If the wallet isn't
    // connected yet the empty state handles it.
    renderProfile();
  }
}

function onHashChange() {
  showPage(currentPageId());
}

window.addEventListener("hashchange", onHashChange);
// NOTE: initial `showPage(currentPageId())` is invoked at the bottom of this
// file so every later-declared `const` (lineageViewportEl, etc.) is already
// out of the temporal dead zone when the router dispatches.

// ------------------------------------------------------------------
// Timeline — live onchain event feed
// ------------------------------------------------------------------
// Pulls Minted / Merged / Burned / Infinity logs from the contract via
// eth_getLogs, decodes each with viem, merges them into a single chronological
// list, and renders the "vertical line + circular dot" feed that takes design
// cues from burn.checks.art/timeline. All data sourced from the contract —
// no off-chain indexer.

const timelineFeedEl   = document.getElementById("timeline-feed");
const timelineCountEl  = document.getElementById("timeline-count");
const timelineFilterBtns = document.querySelectorAll("#timeline .timeline-filter button");

let timelineEvents = [];        // Decorated view over cachedEvents.
let timelineFilter = "all";
// Timeline is rendered in pages — TIMELINE_PAGE_SIZE events per batch,
// with more loading as the user scrolls to the sentinel at the bottom.
const TIMELINE_PAGE_SIZE = 30;
let timelineVisibleLimit = TIMELINE_PAGE_SIZE;

function shortAddr(a) {
  return a && typeof a === "string" ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}
function shortHash(h) {
  return h && typeof h === "string" ? `${h.slice(0, 10)}…${h.slice(-4)}` : "—";
}

// Reconstruct a survivor's art at a specific historical divisor level by
// replaying mergedBy events from the shared cache.
function computeSurvivorArtAtLevel(survivorId, level) {
  const mint = mintedBy.get(String(survivorId));
  if (!mint) return null;
  const seed = mint.seed;
  const traits = deriveTraits(seed);
  const list = mergedBy.get(String(survivorId)) || [];
  const merges = [];
  for (const m of list) {
    if (m.newDivisorIndex <= level) merges.push(Number(m.burnedId));
    else break;
  }
  return renderSVG({
    seed,
    divisorIndex: level,
    merges,
    isMega: 0,
    colorBandIdx: traits.colorBandIdx,
    gradientIdx:  traits.gradientIdx,
    direction:    traits.direction,
    speed:        traits.speed,
  });
}

async function loadTimeline() {
  if (!hasContract) {
    renderTimeline();
    return;
  }
  const v = await loadViem();
  if (!v || !publicClient) {
    timelineCountEl.textContent = "offline";
    return;
  }
  timelineCountEl.textContent = "syncing…";
  try {
    // Single source of truth — the shared event cache populates Maps AND
    // the flat cachedEvents list used by the timeline renderer.
    await ensureEventCache();

    // Decorate each event with a reconstructed thumbnail + click target.
    // cachedEvents is shared state so we don't mutate it — copy, decorate,
    // render.
    timelineEvents = cachedEvents.map(base => {
      const ev = { ...base, ts: blockTs.get(base.block) || 0 };
      if (ev.name === "Minted") {
        ev.art = renderSVG({
          seed: Number(ev.args.seed),
          divisorIndex: 0,
          merges: [],
          isMega: 0,
        });
        ev.tokenIdRef = ev.args.tokenId.toString();
      } else if (ev.name === "Merged") {
        const sid = ev.args.survivorId.toString();
        const level = Number(ev.args.newDivisorIndex);
        const art = computeSurvivorArtAtLevel(sid, level);
        if (art) ev.art = art;
        ev.tokenIdRef = sid;
      } else if (ev.name === "Infinity") {
        // Mega Dot is always the same terminal grayscale render.
        ev.art = renderSVG({
          seed: 0,
          divisorIndex: 7,
          merges: [],
          isMega: 1,
        });
        ev.tokenIdRef = ev.args.megaDotId.toString();
      }
      // Burned events intentionally have no art and no tokenIdRef.
      return ev;
    });

    renderTimeline();
  } catch (e) {
    console.error("loadTimeline failed:", e);
    timelineCountEl.textContent = "error";
    timelineFeedEl.innerHTML = `<li class="tl-empty">Failed to load event feed.</li>`;
  }
}

function renderTimeline() {
  if (!hasContract) {
    timelineCountEl.textContent = "awaiting deploy";
    timelineFeedEl.innerHTML = `<li class="tl-empty">Paste a contract address in web/config.js to stream events.</li>`;
    return;
  }
  const filtered = timelineEvents.filter(e =>
    timelineFilter === "all" ? true : e.kind === timelineFilter
  );
  timelineCountEl.textContent = `${filtered.length} event${filtered.length === 1 ? "" : "s"}`;
  if (filtered.length === 0) {
    timelineFeedEl.innerHTML = `<li class="tl-empty">No ${timelineFilter === "all" ? "" : timelineFilter + " "}events yet.</li>`;
    return;
  }

  // Render only the visible slice. The sentinel at the bottom triggers the
  // next batch when scrolled into view.
  const visible = filtered.slice(0, timelineVisibleLimit);
  const exhausted = visible.length >= filtered.length;

  const now = Math.floor(Date.now() / 1000);
  const fmtWhen = (ts) => {
    if (!ts) return "—";
    const delta = now - ts;
    if (delta < 60)  return `${delta}s ago`;
    if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
    if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
    return `${Math.floor(delta / 86400)}d ago`;
  };

  const sentinelHtml = exhausted
    ? `<li class="tl-end">End of feed — ${filtered.length} events</li>`
    : `<li class="tl-sentinel" id="timeline-sentinel">Loading more events…</li>`;
  timelineFeedEl.innerHTML = visible.map(e => {
    let headline = "";
    let detail = "";
    switch (e.name) {
      case "Minted":
        headline = `Mint <span class="tl-id">#${e.args.tokenId}</span>`;
        detail = `<span class="tl-addr">${shortAddr(e.args.to)}</span> · seed <span class="tl-mono">0x${Number(e.args.seed).toString(16).padStart(8, "0")}</span>`;
        break;
      case "Merged":
        headline = `Merge <span class="tl-id">#${e.args.survivorId}</span> ← <span class="tl-id">#${e.args.burnedId}</span>`;
        detail = `Advanced to level <span class="tl-mono">${e.args.newDivisorIndex}</span>`;
        break;
      case "Burned":
        headline = `Burn <span class="tl-id">#${e.args.tokenId}</span>`;
        detail = `Token removed from circulation`;
        break;
      case "Infinity":
        headline = `Infinity <span class="tl-id">#${e.args.megaDotId}</span>`;
        detail = `64 single dots collapsed into one Mega Dot`;
        break;
    }

    // Thumbnail: show the associated token's current art, or a placeholder
    // if the token was burned (no art), or a dedicated "burn" motif for
    // Burned events themselves.
    let thumb;
    if (e.art) {
      thumb = `<div class="tl-thumb">${e.art}</div>`;
    } else if (e.name === "Burned") {
      thumb = `<div class="tl-thumb tl-thumb-burned"><span>burned</span></div>`;
    } else {
      thumb = `<div class="tl-thumb tl-thumb-missing"><span>gone</span></div>`;
    }

    // Entries with a referenced (still-alive) token become clickable and
    // open that token's lineage tree in the modal. Burned events don't
    // have a tokenIdRef set, so they stay non-interactive.
    const clickable = e.tokenIdRef ? `data-lineage-id="${e.tokenIdRef}"` : "";
    const clickableClass = e.tokenIdRef ? " tl-entry-clickable" : "";

    return `
      <li class="tl-entry tl-${e.kind}${clickableClass}" ${clickable}>
        <span class="tl-dot"></span>
        ${thumb}
        <div class="tl-row">
          <div class="tl-main">
            <div class="tl-head">${headline}</div>
            <div class="tl-sub">${detail}</div>
          </div>
          <div class="tl-meta">
            <span class="tl-when">${fmtWhen(e.ts)}</span>
            <span class="tl-tx tl-mono">${shortHash(e.tx)}</span>
            <span class="tl-block">block ${e.block.toString()}</span>
          </div>
        </div>
      </li>
    `;
  }).join("") + sentinelHtml;

  // Wire the next-batch sentinel via IntersectionObserver — bumping
  // timelineVisibleLimit by one page and re-rendering appends the next batch.
  if (!exhausted) {
    const sentinelEl = document.getElementById("timeline-sentinel");
    if (sentinelEl) {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            io.disconnect();
            timelineVisibleLimit += TIMELINE_PAGE_SIZE;
            renderTimeline();
          }
        }
      }, { rootMargin: "300px" });
      io.observe(sentinelEl);
    }
  }

  // Wire click-to-open-lineage on every entry that references a live token.
  timelineFeedEl.querySelectorAll(".tl-entry-clickable").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.dataset.lineageId;
      if (id) openLineageModal(id);
    });
  });
}

timelineFilterBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    timelineFilterBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    timelineFilter = btn.dataset.filter;
    timelineVisibleLimit = TIMELINE_PAGE_SIZE;    // reset paging on filter change
    renderTimeline();
  });
});

// ------------------------------------------------------------------
// Lineage — full merge-ancestry tree with interactive navigation
// ------------------------------------------------------------------
// Design cue: burn.checks.art/checks/<id>/tree. Every token's full ancestry
// is reconstructed from Minted + Merged event logs (burned ancestors are
// wiped from contract storage, so logs are the only surviving record of
// their seeds). Leaves render at the ancestor's mint-time state via the
// client-side art.js mirror of DotsArt.sol. Click any node to navigate
// to that node's own tree.

const lineageModalEl      = document.getElementById("lineage-modal");
const lineageDialogTitle  = document.getElementById("lineage-dialog-title");
const lineageViewportEl   = document.getElementById("lineage-viewport");
const lineageBreadcrumbEl = document.getElementById("lineage-breadcrumb");
const lineageStatsEl      = document.getElementById("lineage-stats");
const lineageZoomInBtn    = document.getElementById("lineage-zoom-in");
const lineageZoomOutBtn   = document.getElementById("lineage-zoom-out");
const lineageZoomResetBtn = document.getElementById("lineage-zoom-reset");
const lineageZoomLabel    = document.getElementById("lineage-zoom-level");

// Zoom state for the current tree. Resets to 1 every time loadLineage runs.
let lineageZoom = 1;
const LINEAGE_ZOOM_MIN = 0.4;
const LINEAGE_ZOOM_MAX = 4;
const LINEAGE_ZOOM_STEP = 1.25;
// Natural (unzoomed) SVG viewBox dimensions — captured when a tree renders.
let lineageNaturalW = 0;
let lineageNaturalH = 0;

function applyLineageZoom(nextZoom, anchor) {
  const svg = lineageViewportEl.querySelector(".lineage-svg");
  if (!svg || !lineageNaturalW) return;
  const clamped = Math.max(LINEAGE_ZOOM_MIN, Math.min(LINEAGE_ZOOM_MAX, nextZoom));
  if (clamped === lineageZoom) return;
  // Preserve the point under `anchor` (default: viewport center) across the
  // zoom change so the user doesn't lose their place.
  const vp = lineageViewportEl;
  const prevZoom = lineageZoom;
  const ax = anchor ? anchor.clientX : vp.getBoundingClientRect().left + vp.clientWidth / 2;
  const ay = anchor ? anchor.clientY : vp.getBoundingClientRect().top + vp.clientHeight / 2;
  const vpRect = vp.getBoundingClientRect();
  // Translate client coords to the SVG-local pixel space (scaled units).
  const localX = vp.scrollLeft + (ax - vpRect.left);
  const localY = vp.scrollTop  + (ay - vpRect.top);
  // Local → natural coords via the old zoom.
  const naturalX = localX / prevZoom;
  const naturalY = localY / prevZoom;
  lineageZoom = clamped;
  svg.setAttribute("width",  String(lineageNaturalW * clamped));
  svg.setAttribute("height", String(lineageNaturalH * clamped));
  // Re-anchor so the same natural point stays under the cursor.
  vp.scrollLeft = naturalX * clamped - (ax - vpRect.left);
  vp.scrollTop  = naturalY * clamped - (ay - vpRect.top);
  if (lineageZoomLabel) {
    lineageZoomLabel.textContent = `${Math.round(clamped * 100)}%`;
  }
}

lineageZoomInBtn?.addEventListener("click", () => applyLineageZoom(lineageZoom * LINEAGE_ZOOM_STEP));
lineageZoomOutBtn?.addEventListener("click", () => applyLineageZoom(lineageZoom / LINEAGE_ZOOM_STEP));
lineageZoomResetBtn?.addEventListener("click", () => applyLineageZoom(1));

// Ctrl / Cmd + wheel → zoom. Plain wheel still scrolls normally.
lineageViewportEl?.addEventListener("wheel", (ev) => {
  if (!(ev.ctrlKey || ev.metaKey)) return;
  ev.preventDefault();
  const factor = ev.deltaY < 0 ? LINEAGE_ZOOM_STEP : 1 / LINEAGE_ZOOM_STEP;
  applyLineageZoom(lineageZoom * factor, { clientX: ev.clientX, clientY: ev.clientY });
}, { passive: false });

// Navigation history (roots visited), for the breadcrumb trail.
const lineageTrail = [];

function openLineageModal(rootIdStr) {
  if (!lineageModalEl) return;
  lineageModalEl.hidden = false;
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", onLineageKey);
  loadLineage(String(rootIdStr));
}

function closeLineageModal() {
  if (!lineageModalEl) return;
  lineageModalEl.hidden = true;
  document.body.style.overflow = "";
  document.removeEventListener("keydown", onLineageKey);
  // Reset breadcrumb trail on close so next time starts fresh.
  lineageTrail.length = 0;
}

function onLineageKey(e) {
  if (e.key === "Escape") closeLineageModal();
}

lineageModalEl?.addEventListener("click", (e) => {
  if (e.target.closest("[data-close='1']")) closeLineageModal();
});

// Shared event cache — single source of truth for BOTH the Timeline feed
// and the Lineage modal. A single `getLogs` sweep populates:
//   • mintedBy   Map<tokenId, {seed, to, block, tx}>
//   • mergedBy   Map<survivorId, Array<{burnedId, newDivisorIndex, ...}>>
//                 each list ordered by block/logIndex
//   • infinityBy Map<megaDotId, Array<tokenIdStr>>
//   • cachedEvents — flat array of normalised events, newest-first, used by
//                    the timeline renderer
//   • blockTs    Map<bigint, number> — block → unix seconds, resolved once
//                per unique block
let mintedBy = new Map();
let mergedBy = new Map();
let infinityBy = new Map();
let cachedEvents = [];
let blockTs = new Map();
let eventCachePromise = null;

const EVENT_KIND = {
  Minted:  "mint",
  Merged:  "merge",
  Burned:  "burn",
  Infinity:"infinity",
};

// Call after any state-changing tx so the next read actually refreshes.
function invalidateEventCache() {
  eventCachePromise = null;
  mintedBy = new Map();
  mergedBy = new Map();
  infinityBy = new Map();
  cachedEvents = [];
  blockTs = new Map();
}

async function ensureEventCache() {
  if (eventCachePromise) return eventCachePromise;
  eventCachePromise = (async () => {
    const v = await loadViem();
    if (!v || !publicClient || !hasContract) return;
    const common = { address: CONTRACT_ADDRESS, fromBlock: 0n, toBlock: "latest" };
    const [minted, merged, burned, infinityEvts] = await Promise.all([
      publicClient.getLogs({ ...common, event: {
        type: "event", name: "Minted",
        inputs: [
          { name: "to", type: "address", indexed: true },
          { name: "tokenId", type: "uint256", indexed: true },
          { name: "seed", type: "uint32", indexed: false },
        ],
      } }),
      publicClient.getLogs({ ...common, event: {
        type: "event", name: "Merged",
        inputs: [
          { name: "survivorId", type: "uint256", indexed: true },
          { name: "burnedId", type: "uint256", indexed: true },
          { name: "newDivisorIndex", type: "uint16", indexed: false },
        ],
      } }),
      publicClient.getLogs({ ...common, event: {
        type: "event", name: "Burned",
        inputs: [{ name: "tokenId", type: "uint256", indexed: true }],
      } }),
      publicClient.getLogs({ ...common, event: {
        type: "event", name: "Infinity",
        inputs: [
          { name: "megaDotId", type: "uint256",   indexed: true },
          { name: "burnedIds", type: "uint256[]", indexed: false },
        ],
      } }),
    ]);

    // mintedBy lookup
    mintedBy = new Map();
    for (const l of minted) {
      mintedBy.set(l.args.tokenId.toString(), {
        seed: Number(l.args.seed),
        to:   l.args.to,
        block: l.blockNumber,
        tx:    l.transactionHash,
      });
    }
    // mergedBy lookup, sorted by block/logIndex per survivor
    mergedBy = new Map();
    for (const l of merged) {
      const sid = l.args.survivorId.toString();
      if (!mergedBy.has(sid)) mergedBy.set(sid, []);
      mergedBy.get(sid).push({
        burnedId:        l.args.burnedId.toString(),
        newDivisorIndex: Number(l.args.newDivisorIndex),
        block:           l.blockNumber,
        logIndex:        l.logIndex,
        tx:              l.transactionHash,
      });
    }
    for (const list of mergedBy.values()) {
      list.sort((a, b) => {
        if (a.block === b.block) return Number(a.logIndex - b.logIndex);
        return Number(a.block - b.block);
      });
    }
    // infinityBy lookup — burnedIds[0] is the keeper (== megaDotId)
    infinityBy = new Map();
    for (const l of infinityEvts) {
      infinityBy.set(
        l.args.megaDotId.toString(),
        l.args.burnedIds.map(b => b.toString()),
      );
    }

    // Build the flat chronological event list (newest first) for the
    // timeline. Each entry carries the minimum fields the renderer needs.
    const normalise = (rawList, name) =>
      rawList.map(l => ({
        kind: EVENT_KIND[name],
        name,
        block: l.blockNumber,
        logIndex: l.logIndex,
        tx: l.transactionHash,
        args: l.args,
      }));
    const all = [
      ...normalise(minted,       "Minted"),
      ...normalise(merged,       "Merged"),
      ...normalise(burned,       "Burned"),
      ...normalise(infinityEvts, "Infinity"),
    ];
    all.sort((a, b) => {
      if (a.block === b.block) return Number(b.logIndex - a.logIndex);
      return Number(b.block - a.block);
    });
    cachedEvents = all;

    // Resolve one timestamp per unique block — done once here instead of
    // on every timeline render.
    const uniqBlocks = [...new Set(all.map(e => e.block))];
    const blocks = await Promise.all(
      uniqBlocks.map(bn => publicClient.getBlock({ blockNumber: bn }))
    );
    blockTs = new Map(blocks.map(b => [b.number, Number(b.timestamp)]));
  })();
  return eventCachePromise;
}

// Return the burnedId that a token consumed to advance from divisor `fromD`
// to `fromD + 1`. Null if the event can't be found (shouldn't happen for
// any token that actually reached level > fromD).
function partnerAtLevel(tokenId, fromD) {
  const list = mergedBy.get(String(tokenId));
  if (!list) return null;
  for (const m of list) {
    if (m.newDivisorIndex === fromD + 1) return m.burnedId;
  }
  return null;
}

// For a surviving token that reached divisor `level` at some point in its
// history, return its `merges[0..level-1]` as tokenId strings by scanning
// the Merged events.
function mergesChainFor(tokenId, level) {
  const out = [];
  for (let k = 0; k < level; ++k) {
    const partner = partnerAtLevel(tokenId, k);
    out.push(partner);
  }
  return out;
}

// Recursively build the binary-tree representation of an ancestry.
// Each node carries enough state for the client-side renderer to draw it.
function buildLineageNode(tokenId, level) {
  const id = String(tokenId);
  const mint = mintedBy.get(id);
  if (!mint) {
    return { id, level, seed: 0, traits: null, merges: [], children: [], missing: true };
  }
  const traits = deriveTraits(mint.seed);
  const mergesChain = mergesChainFor(id, level);
  const node = { id, level, seed: mint.seed, traits, merges: mergesChain, children: [], missing: false };

  if (level === 0) return node;

  if (level === 7) {
    // Infinity step: `infinity(tokenIds[64])` collapses 64 single dots into
    // a Mega Dot in one call — NOT a binary merge. Show all 64 d=6
    // ancestors as direct children (shallow — no further expansion, so the
    // modal stays manageable). Click any child to drill into its own
    // 127-node binary subtree.
    const burnedIds = infinityBy.get(id);
    if (!burnedIds || burnedIds.length === 0) return node;
    for (const bid of burnedIds) {
      const bidStr = String(bid);
      const bm = mintedBy.get(bidStr);
      if (!bm) {
        node.children.push({ id: bidStr, level: 6, seed: 0, traits: null, merges: [], children: [], missing: true });
        continue;
      }
      node.children.push({
        id: bidStr,
        level: 6,
        seed: bm.seed,
        traits: deriveTraits(bm.seed),
        merges: mergesChainFor(bidStr, 6),
        children: [],           // shallow — don't expand, save space
        missing: false,
        isInfinityAncestor: true,
      });
    }
    return node;
  }

  // Binary merge step: child[0] is this token at level-1, child[1] is the
  // partner that was burned into it to reach `level`.
  const partnerId = partnerAtLevel(id, level - 1);
  node.children.push(buildLineageNode(id, level - 1));
  if (partnerId) node.children.push(buildLineageNode(partnerId, level - 1));
  return node;
}

// Count leaves and total nodes for an N-ary children[] tree.
function countLeaves(node) {
  if (!node) return 0;
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}
function countNodes(node) {
  if (!node) return 0;
  if (!node.children || node.children.length === 0) return 1;
  return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
}

// Assign (x, y) coordinates by slicing the parent's horizontal range
// evenly across its children (N-ary, not just binary).
function layoutTree(node, yStep, xStart, xEnd, depth = 0) {
  if (!node) return;
  node.x = (xStart + xEnd) / 2;
  node.y = depth * yStep;
  const kids = node.children || [];
  if (kids.length === 0) return;
  const slice = (xEnd - xStart) / kids.length;
  for (let i = 0; i < kids.length; ++i) {
    const s = xStart + i * slice;
    const e = s + slice;
    layoutTree(kids[i], yStep, s, e, depth + 1);
  }
}

// Walk the whole tree and collect nodes in drawing order (N-ary).
function flattenTree(node, out = []) {
  if (!node) return out;
  out.push(node);
  for (const c of (node.children || [])) flattenTree(c, out);
  return out;
}

// Render a single node as a base64 SVG data URL so it can be dropped into
// an <image> element inside the outer tree SVG.
function nodeThumbDataUrl(node) {
  // Build a Dot-shaped object for the renderer. At level L, the node
  // displays with divisorIndex == L and `merges` sliced to level L. A
  // level-7 node is a Mega Dot — renderer branches on isMega=1.
  const { seed, traits, merges, level } = node;
  const check = {
    seed,
    divisorIndex: level,
    merges: merges.map(n => n === null ? 0 : Number(n)),
    isMega: level === 7 ? 1 : 0,
  };
  if (traits) {
    check.colorBandIdx = traits.colorBandIdx;
    check.gradientIdx  = traits.gradientIdx;
    check.direction    = traits.direction;
    check.speed        = traits.speed;
  }
  const svg = renderSVG(check);
  return "data:image/svg+xml;base64," + btoa(svg);
}

function renderLineageEmpty(msg) {
  lineageViewportEl.innerHTML = `<div class="lineage-empty">${msg || "Open a token from the Explore page to view its merge tree."}</div>`;
  lineageStatsEl.textContent = "—";
  lineageBreadcrumbEl.innerHTML = "";
}

async function loadLineage(rootIdStr, overrideLevel) {
  if (!hasContract) {
    renderLineageEmpty("Paste a contract address in web/config.js to view lineage.");
    return;
  }
  if (lineageDialogTitle) lineageDialogTitle.textContent = `Token #${rootIdStr}`;
  lineageViewportEl.innerHTML = `<div class="lineage-empty">Loading lineage for #${rootIdStr}…</div>`;
  try {
    await ensureEventCache();

    // Figure out the root's current divisor unless the caller explicitly
    // specified a level (used when drilling into a child from its parent
    // tree — the child's level is the level it was at inside that tree,
    // not the token's current state on-chain).
    let rootLevel = 0;
    if (typeof overrideLevel === "number") {
      rootLevel = overrideLevel;
    } else {
      try {
        const dot = await publicClient.readContract({
          address: CONTRACT_ADDRESS, abi: ABI,
          functionName: "getDot", args: [BigInt(rootIdStr)],
        });
        rootLevel = Number(dot.divisorIndex);
      } catch (_) {
        const list = mergedBy.get(rootIdStr) || [];
        for (const m of list) if (m.newDivisorIndex > rootLevel) rootLevel = m.newDivisorIndex;
      }
    }

    const root = buildLineageNode(rootIdStr, rootLevel);
    if (root.missing) {
      renderLineageEmpty(`Token #${rootIdStr} has no mint record.`);
      return;
    }

    // Maintain breadcrumb trail. Avoid pushing duplicates for the same id.
    if (lineageTrail[lineageTrail.length - 1] !== rootIdStr) {
      lineageTrail.push(rootIdStr);
    }

    renderLineageTree(root);
    renderBreadcrumb();
  } catch (e) {
    console.error("loadLineage failed:", e);
    renderLineageEmpty("Failed to reconstruct lineage.");
  }
}

function renderBreadcrumb() {
  if (lineageTrail.length === 0) { lineageBreadcrumbEl.innerHTML = ""; return; }
  lineageBreadcrumbEl.innerHTML = lineageTrail.map((id, i) => {
    const last = i === lineageTrail.length - 1;
    return `<a href="#" class="lineage-crumb${last ? " active" : ""}" data-lineage-id="${id}">#${id}</a>`;
  }).join('<span class="lineage-crumb-sep">→</span>');
  lineageBreadcrumbEl.querySelectorAll(".lineage-crumb").forEach(el => {
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      const id = el.dataset.lineageId;
      if (!id) return;
      // Jump back to that point in the trail.
      const idx = lineageTrail.indexOf(id);
      if (idx !== -1) lineageTrail.length = idx;
      loadLineage(id);
    });
  });
}

function renderLineageTree(root) {
  const leafCount = Math.max(1, countLeaves(root));
  const levels    = root.level + 1; // depth 0..root.level
  const total     = countNodes(root);
  const NODE_W = 56;
  const NODE_H = 70;
  const X_PAD  = 24;
  const Y_STEP = 108;
  const TOP_PAD    = NODE_H / 2 + 20;    // reserve room above the root
  const BOTTOM_PAD = 24;                  // label + breathing room below leaves

  const vbWidth  = Math.max(leafCount * (NODE_W + 14) + X_PAD * 2, 360);
  const vbHeight = TOP_PAD + (levels - 1) * Y_STEP + NODE_H / 2 + BOTTOM_PAD + 16;
  layoutTree(root, Y_STEP, X_PAD + NODE_W / 2, vbWidth - X_PAD - NODE_W / 2);
  const nodes = flattenTree(root);

  // Connector lines between each parent and its children (N-ary walk).
  // All y values shifted down by TOP_PAD so the root has breathing room
  // above it inside the viewBox.
  const lines = [];
  const walk = (n) => {
    if (!n) return;
    const parentY = n.y + TOP_PAD;
    for (const c of (n.children || [])) {
      lines.push({
        x1: n.x, y1: parentY + NODE_H / 2,
        x2: c.x, y2: c.y + TOP_PAD - NODE_H / 2,
      });
      walk(c);
    }
  };
  walk(root);

  const lineSvg = lines
    .map(l => `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="#1e1e2a" stroke-width="1"/>`)
    .join("");

  const nodeSvg = nodes.map(n => {
    const href = nodeThumbDataUrl(n);
    const x = n.x - NODE_W / 2;
    const y = n.y + TOP_PAD - NODE_H / 2;
    const label = `#${n.id}`;
    const cls = `lineage-node${n === root ? " lineage-node-root" : ""}${n.level === 0 ? " lineage-node-leaf" : ""}`;
    return `
      <g class="${cls}" data-id="${n.id}" data-level="${n.level}" transform="translate(${x}, ${y})">
        <rect x="-1" y="-1" width="${NODE_W + 2}" height="${NODE_H + 2}" fill="none" stroke="#2a2a34" stroke-width="1"/>
        <image href="${href}" x="0" y="0" width="${NODE_W}" height="${NODE_H}"/>
        <text x="${NODE_W / 2}" y="${NODE_H + 14}" text-anchor="middle"
              font-family="JetBrains Mono, monospace" font-size="9" fill="#8b8b93">${label}</text>
      </g>
    `;
  }).join("");

  lineageViewportEl.innerHTML = `
    <svg class="lineage-svg" width="${vbWidth}" height="${vbHeight}"
         viewBox="0 0 ${vbWidth} ${vbHeight}"
         preserveAspectRatio="xMidYMin meet" xmlns="http://www.w3.org/2000/svg">
      ${lineSvg}
      ${nodeSvg}
    </svg>
  `;

  // Capture the tree's natural dimensions so the zoom controls have a
  // consistent baseline to scale from, and reset zoom to 1 on every new
  // tree so switching roots doesn't inherit the previous zoom.
  lineageNaturalW = vbWidth;
  lineageNaturalH = vbHeight;
  lineageZoom = 1;
  if (lineageZoomLabel) lineageZoomLabel.textContent = "100%";

  // Auto-center the viewport on the root so the user sees the tree's apex
  // immediately, even for wide trees that exceed the dialog width.
  requestAnimationFrame(() => {
    if (!lineageViewportEl) return;
    const targetX = root.x - lineageViewportEl.clientWidth / 2;
    lineageViewportEl.scrollLeft = Math.max(0, targetX);
    lineageViewportEl.scrollTop = 0;
  });

  lineageStatsEl.innerHTML = `
    <span class="lineage-stat"><strong>#${root.id}</strong> level ${root.level}</span>
    <span class="lineage-stat">${leafCount} ancestor${leafCount === 1 ? "" : "s"}</span>
    <span class="lineage-stat">${total} nodes</span>
  `;

  // Click-to-navigate on every node — stay inside the modal. We skip the
  // root element by CLASS (not by id) because the Mega Dot tree has two
  // nodes that share the same id: the d=7 root and the keeper child at
  // d=6. Each child is tagged with its tree-level via data-level so that
  // clicking the keeper at d=6 opens its d=6 subtree (not the contract's
  // current state, which is d=7 after infinity()).
  const openChild = (el) => {
    if (el.classList.contains("lineage-node-root")) return;
    const id = el.dataset.id;
    const levelStr = el.dataset.level;
    if (!id) return;
    const level = levelStr ? parseInt(levelStr, 10) : undefined;
    loadLineage(id, level);
  };
  lineageViewportEl.querySelectorAll(".lineage-node").forEach(el => {
    el.addEventListener("click", () => openChild(el));
    el.addEventListener("dblclick", () => openChild(el));
  });
}

// ------------------------------------------------------------------
// Hook Explore / Profile click paths to open the lineage modal
// ------------------------------------------------------------------
// Explore tiles open the lineage modal on shift-click or double-click.
// Plain click is reserved for the merge slot picker workflow.
document.addEventListener("click", (ev) => {
  const tile = ev.target.closest("#explore .token");
  if (!tile || !ev.shiftKey) return;
  const id = tile.dataset.id;
  if (!id) return;
  ev.preventDefault();
  ev.stopPropagation();
  openLineageModal(id);
});
document.addEventListener("dblclick", (ev) => {
  const tile = ev.target.closest("#explore .token");
  if (!tile) return;
  const id = tile.dataset.id;
  if (id) openLineageModal(id);
});

// ------------------------------------------------------------------
// Boot
// ------------------------------------------------------------------
// Dispatch to the current route now that every `const` in the file is
// initialised — this is what was racing earlier when the initial
// showPage() ran too close to the top.
showPage(currentPageId());
loadStats();
loadGallery();
loadTimeline();
updateTotalCost();
