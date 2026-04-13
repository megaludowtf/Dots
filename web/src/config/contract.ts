// Contract address — paste the deployed address here.
export const CONTRACT_ADDRESS: `0x${string}` = '0x478558FBD4d89fE2aEC886595B7bD02308eBE23D';

export const hasContract =
  CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000';

// Minimal ABI — only the functions and events the frontend needs.
export const ABI = [
  // ---- Write functions ----
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'payable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'merge',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'survivorId', type: 'uint256' },
      { name: 'burnId', type: 'uint256' },
      { name: 'swap', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'mergeMany',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'survivors', type: 'uint256[]' },
      { name: 'burns', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'infinity',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenIds', type: 'uint256[]' }],
    outputs: [],
  },
  // ---- View functions ----
  {
    type: 'function',
    name: 'circulation',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256[8]' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'nextTokenId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'mintPrice',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'mintStart',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint64' }],
  },
  {
    type: 'function',
    name: 'mintEnd',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint64' }],
  },
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getDot',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'seed', type: 'uint32' },
          { name: 'divisorIndex', type: 'uint16' },
          { name: 'merged', type: 'uint16' },
          { name: 'merges', type: 'uint24[6]' },
          { name: 'colorBandIdx', type: 'uint8' },
          { name: 'gradientIdx', type: 'uint8' },
          { name: 'direction', type: 'uint8' },
          { name: 'speed', type: 'uint8' },
          { name: 'isMega', type: 'uint8' },
        ],
      },
    ],
  },
  // ---- Events ----
  {
    type: 'event',
    name: 'Minted',
    inputs: [
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'seed', type: 'uint32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Merged',
    inputs: [
      { name: 'survivorId', type: 'uint256', indexed: true },
      { name: 'burnedId', type: 'uint256', indexed: true },
      { name: 'newDivisorIndex', type: 'uint16', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Burned',
    inputs: [{ name: 'tokenId', type: 'uint256', indexed: true }],
  },
  {
    type: 'event',
    name: 'Infinity',
    inputs: [
      { name: 'megaDotId', type: 'uint256', indexed: true },
      { name: 'burnedIds', type: 'uint256[]', indexed: false },
    ],
  },
] as const;
