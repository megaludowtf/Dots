# Dots

Onchain generative NFT on MegaETH. Spiritual clone of Jack Butcher's *Checks — VV Edition*, substituting the MegaETH logomark for the checkmark glyph.

Every token stores a seed and a `divisorIndex`. At divisor 0 a token shows an 8×10 grid of 80 coloured MegaETH logomarks. Two tokens at the same divisor can be **merged**: one burns, the other advances a step (80 → 40 → 20 → 10 → 5 → 4 → 1). At the final step only one lone MegaETH logomark remains, centered in the canvas at roughly 2×2 cell size — the single dot.

To go one step further, **sixty-four single dots can be collapsed into one Mega Dot** via `infinity(tokenIds[])`. The Mega Dot lives at `divisorIndex = 7` and renders as a grayscale off-white disc with the black logomark on top — the terminal state of the collection. There's no step beyond it.

Art is generated fully onchain — `tokenURI` returns a base64-encoded JSON with an inline SVG. Nothing lives off-chain.

## Layout

```
src/
  Dots.sol              ERC-721, mint/merge/burn/admin
  DotsArt.sol           pure SVG renderer (library)
  DotsMetadata.sol      base64 JSON wrapper (library)
  interfaces/IDots.sol  struct + events + errors
script/
  Deploy.s.sol                MegaETH testnet deployment
test/
  Dots.t.sol            mint, burn, admin
  Merge.t.sol             full 80 -> 1 ladder, guard-rail reverts
  Art.t.sol                   SVG renderer + tokenURI well-formedness
assets/
  megaeth-icon.svg            source icon (embedded as <symbol id="m">)
  megaeth-wordmark.svg        source wordmark (reference only, not embedded)
web/
  index.html                  checks.art-style landing page
  styles.css                  dark minimalist theme
  app.js                      viem-based wallet + mint + gallery
  art.js                      client-side mirror of DotsArt.sol
  config.js                   contract address + chain + ABI
preview/
  index.html                  simple divisor-level debug preview
```

## Frontend

After deploying, paste the contract address into `web/config.js` and open `web/index.html`
in a browser. Works from a plain `file://` URL or any static server:

```bash
# from the project root
npx serve web    # or: python -m http.server --directory web 8000
```

The frontend auto-loads mint stats, lets you connect a wallet (MetaMask/compatible),
mints directly against the deployed contract, and renders a live gallery of recent
tokens by reading `tokenURI` from the contract. No backend, no build step.

## Prerequisites

You need **Foundry** installed. If you don't have it yet:

```bash
# Unix / WSL / macOS
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Windows (PowerShell)
# Install via WSL, or use the Windows installer at https://book.getfoundry.sh/getting-started/installation
```

## Setup

```bash
cd "Mega checks"

# Initialise git (forge install uses submodules by default)
git init

# Install dependencies
forge install foundry-rs/forge-std --no-commit
forge install OpenZeppelin/openzeppelin-contracts --no-commit

# Compile
forge build
```

## Running tests

```bash
forge test -vv
```

Interesting tests:

- `test_Merge_FullLadderToMega` — walks a single token through the entire 6-step merge ladder down to `divisorIndex = 6`
- `test_Render_AllLevels_EmitValidSvg` — renders each divisor level and sanity-checks the SVG envelope
- `test_TokenURI_WellFormedJson` — mints a token, decodes the base64 JSON, and asserts required fields are present

To view actual art, mint a token in a forge test and print `dots.tokenURI(1)`, then paste the base64 portion into a decoder and open the resulting SVG in a browser.

## Deploy to MegaETH testnet

1. Get testnet ETH from the [MegaETH faucet](https://testnet.megaeth.com/)
2. Copy `.env.example` to `.env` and fill in `PRIVATE_KEY`
3. Deploy:

```bash
source .env
forge script script/Deploy.s.sol:Deploy \
    --rpc-url $MEGAETH_RPC_URL \
    --broadcast \
    --private-key $PRIVATE_KEY
```

The deploy script prints the contract address on completion. Tokens can then be minted:

```bash
cast send <contract> "mint(uint256)" 1 \
    --value 0.001ether \
    --rpc-url $MEGAETH_RPC_URL \
    --private-key $PRIVATE_KEY
```

And the tokenURI inspected:

```bash
cast call <contract> "tokenURI(uint256)(string)" 1 \
    --rpc-url $MEGAETH_RPC_URL
```

## MegaETH testnet quick facts

| Field        | Value                                       |
|--------------|---------------------------------------------|
| Chain ID     | 6342                                        |
| RPC          | https://carrot.megaeth.com/rpc              |
| Explorer     | https://megaeth-testnet-v2.blockscout.com/  |
| Faucet       | https://testnet.megaeth.com/                |
| Native token | ETH                                         |

## Merge mechanics

| divisorIndex | Visible glyphs | Layout                                    |
|:-:|:-:|---|
| 0 | 80 | full 8×10 grid                            |
| 1 | 40 | checkerboard (col+row even)               |
| 2 | 20 | 4×5 block grid                            |
| 3 | 10 | 2×5 block grid (center columns, even rows)|
| 4 | 5  | single column, even rows                  |
| 5 | 4  | 2×2 block at the centre                   |
| 6 | 1  | single 2×2-cell-sized logomark, centered  |
| 7 | ∞  | single grayscale Mega Dot (via `infinity`)|

The seed stays **stable** through merges by default — the survivor keeps its visual identity. Pass `swap: true` to `merge()` to adopt the burned partner's seed and traits instead. Colours shift after a merge because the renderer nudges the palette anchor based on the burn partner's ID, not because the seed changes.

### Infinity

```solidity
function infinity(uint256[] calldata tokenIds) external;
```

Requires the caller to own **exactly 64** tokens, all at `divisorIndex == 6`. The first ID in the array becomes the keeper — it advances to `divisorIndex = 7` with `isMega = 1`. The other 63 are burned.

## Credits

Original mechanics designed by Jack Butcher for *Checks — VV Edition* on Ethereum. This is an independent homage built for MegaETH, using the official MegaETH logomark provided by the user.
