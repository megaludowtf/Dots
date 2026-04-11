// Contract and chain configuration.
// Paste your deployed address below and flip ACTIVE_CHAIN between the two
// exports depending on whether you are pointing the frontend at testnet or
// mainnet. Viem reads whatever ACTIVE_CHAIN resolves to at import time.
export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export const MEGAETH_TESTNET = {
  id: 6342,
  name: "MegaETH Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://carrot.megaeth.com/rpc"] },
    public: { http: ["https://carrot.megaeth.com/rpc"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://megaeth-testnet-v2.blockscout.com" },
  },
  testnet: true,
};

export const MEGAETH_MAINNET = {
  id: 4326,
  name: "MegaETH",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.megaeth.com/rpc"] },
    public: { http: ["https://mainnet.megaeth.com/rpc"] },
  },
  blockExplorers: {
    // Replace with the real mainnet explorer URL from docs.megaeth.com
    // before going live.
    default: { name: "MegaETH Explorer", url: "https://explorer.megaeth.com" },
  },
  testnet: false,
};

// Anvil local dev chain — launched via `.claude/launch.json` → anvil, or
// manually via `~/.foundry/bin/anvil.exe --port 8545`. Chain id 31337 is the
// anvil / hardhat default.
export const ANVIL_LOCAL = {
  id: 31337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
    public:  { http: ["http://127.0.0.1:8545"] },
  },
  blockExplorers: {
    default: { name: "Anvil", url: "http://127.0.0.1:8545" },
  },
  testnet: true,
};

// Which chain the frontend currently points at. Change this single line when
// moving between environments — no other frontend code needs to change.
// Local dev default: ANVIL_LOCAL. Flip to MEGAETH_TESTNET/MEGAETH_MAINNET
// before deploying to a public chain.
export const ACTIVE_CHAIN = ANVIL_LOCAL;

// Minimal ABI — only the functions the frontend needs.
export const ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "payable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "merge",
    stateMutability: "nonpayable",
    inputs: [
      { name: "survivorId", type: "uint256" },
      { name: "burnId", type: "uint256" },
      { name: "swap", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "mergeMany",
    stateMutability: "nonpayable",
    inputs: [
      { name: "survivors", type: "uint256[]" },
      { name: "burns", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "infinity",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenIds", type: "uint256[]" }],
    outputs: [],
  },
  {
    type: "function",
    name: "circulation",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256[8]" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "nextTokenId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "mintPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "mintStart",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "mintEnd",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getDot",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "seed", type: "uint32" },
          { name: "divisorIndex", type: "uint16" },
          { name: "merged", type: "uint16" },
          { name: "merges", type: "uint24[6]" },
          { name: "colorBandIdx", type: "uint8" },
          { name: "gradientIdx", type: "uint8" },
          { name: "direction", type: "uint8" },
          { name: "speed", type: "uint8" },
          { name: "isMega", type: "uint8" },
        ],
      },
    ],
  },
  // ---- Events the timeline feed reads ----
  {
    type: "event",
    name: "Minted",
    inputs: [
      { name: "to",      type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "seed",    type: "uint32",  indexed: false },
    ],
  },
  {
    type: "event",
    name: "Merged",
    inputs: [
      { name: "survivorId",      type: "uint256", indexed: true },
      { name: "burnedId",        type: "uint256", indexed: true },
      { name: "newDivisorIndex", type: "uint16",  indexed: false },
    ],
  },
  {
    type: "event",
    name: "Burned",
    inputs: [{ name: "tokenId", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "Infinity",
    inputs: [
      { name: "megaDotId", type: "uint256",   indexed: true },
      { name: "burnedIds", type: "uint256[]", indexed: false },
    ],
  },
];
