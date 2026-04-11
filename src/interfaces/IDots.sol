// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IDots
/// @notice Storage struct, events, and errors for Dots.
/// @dev    Dot struct fits in one 256-bit storage slot:
///           32 seed + 16 divisorIndex + 16 merged
///         + 144 (6*24) merges
///         + 8 colorBandIdx + 8 gradientIdx + 8 direction + 8 speed + 8 isMega
///         = 248 bits, 8 bits spare.
interface IDots {
    struct Dot {
        uint32 seed;           // mint-time entropy. Never changes after mint.
        uint16 divisorIndex;   // 0..7. 7 is the terminal Mega Dot.
        uint16 merged;     // total number of tokens folded into this survivor.
        uint24[6] merges;  // burned partner IDs at each merge step (level 0..5).
        uint8 colorBandIdx;    // index into COLOR_BANDS [80,60,40,20,10,5,1]
        uint8 gradientIdx;     // index into GRADIENTS   [0,1,2,5,8,9,10]
        uint8 direction;       // animation direction, 0 or 1
        uint8 speed;           // animation speed, 1 | 2 | 4
        uint8 isMega;         // 1 if this is an index-7 Mega Dot, else 0.
    }

    error InvalidTokenCount();
    error MintClosed();
    error Underpaid();
    error NotOwner();
    error DifferentDivisors();
    error AlreadyMega();
    error WithdrawFailed();
    error ArrayLengthMismatch();
    error SameToken();
    error MegaDotRequires64();
    error NotSingleDot();

    event Minted(address indexed to, uint256 indexed tokenId, uint32 seed);
    event Merged(uint256 indexed survivorId, uint256 indexed burnedId, uint16 newDivisorIndex);
    event Burned(uint256 indexed tokenId);
    event Infinity(uint256 indexed megaDotId, uint256[] burnedIds);

    // ERC-4906 MetadataUpdate events so indexers re-fetch tokenURI after merge/infinity.
    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);
}
