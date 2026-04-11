// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {IDots} from "./interfaces/IDots.sol";
import {DotsArt} from "./DotsArt.sol";
import {DotsMetadata} from "./DotsMetadata.sol";

/// @title Dots
/// @notice Open-edition onchain generative NFT on MegaETH.
///         Every mint derives a full trait set (colorBand, gradient, direction, speed)
///         from a random seed so every token is visually distinct for marketplaces.
///         Mechanics: merge 2 -> 1 six times to reach a single dot;
///                    infinity() collapses 64 single dots into one Mega Dot.
contract Dots is ERC721, ERC2981, Ownable2Step, IDots {
    mapping(uint256 => Dot) internal _dots;

    uint256 public nextTokenId = 1;
    uint256 public totalSupply;
    uint256 public mintPrice;
    uint64 public mintStart;
    uint64 public mintEnd;

    uint16 public constant MAX_MINT_PER_TX = 50;
    uint256 public constant INFINITY_SIZE = 64;

    /// @notice Number of live tokens at each divisorIndex. Index 0..7 maps to
    ///         glyph counts 80, 40, 20, 10, 5, 4, 1 (single dot), and 1 (mega dot).
    ///         Updated on every mint/merge/infinity/burn so a single read returns
    ///         the full circulation breakdown without iterating tokens.
    uint256[8] internal _circulation;

    // Collection-level metadata for OpenSea.
    string internal _contractURIValue;

    constructor(
        address initialOwner,
        uint256 _mintPrice,
        uint64 _mintStart,
        uint64 _mintEnd
    ) ERC721("Dots", "DOTS") Ownable(initialOwner) {
        mintPrice = _mintPrice;
        mintStart = _mintStart;
        mintEnd = _mintEnd;
        // 5% default royalty to the deployer.
        _setDefaultRoyalty(initialOwner, 500);
    }

    // -----------------------------------------------------------------------
    // Mint
    // -----------------------------------------------------------------------

    function mint(uint256 amount) external payable {
        if (block.timestamp < mintStart || block.timestamp >= mintEnd) revert MintClosed();
        if (amount == 0 || amount > MAX_MINT_PER_TX) revert InvalidTokenCount();
        if (msg.value < mintPrice * amount) revert Underpaid();

        uint256 firstId = nextTokenId;
        for (uint256 i; i < amount; ++i) {
            uint256 id = nextTokenId++;
            uint32 seed = uint32(
                uint256(keccak256(abi.encode(block.prevrandao, id, msg.sender, block.timestamp)))
            );
            (uint8 cb, uint8 gr, uint8 dir, uint8 sp) = DotsArt.deriveTraits(seed);

            Dot storage c = _dots[id];
            c.seed = seed;
            c.divisorIndex = 0;
            c.merged = 0;
            c.colorBandIdx = cb;
            c.gradientIdx = gr;
            c.direction = dir;
            c.speed = sp;
            c.isMega = 0;
            // merges array is already zeroed
            _mint(msg.sender, id);
            emit Minted(msg.sender, id, seed);
        }
        totalSupply += amount;
        _circulation[0] += amount;
        emit BatchMetadataUpdate(firstId, firstId + amount - 1);
    }

    // -----------------------------------------------------------------------
    // Merge / Burn
    // -----------------------------------------------------------------------

    function merge(uint256 survivorId, uint256 burnId, bool swap) external {
        _merge(survivorId, burnId, swap);
    }

    function mergeMany(uint256[] calldata survivors, uint256[] calldata burns) external {
        if (survivors.length != burns.length) revert ArrayLengthMismatch();
        for (uint256 i; i < survivors.length; ++i) {
            _merge(survivors[i], burns[i], false);
        }
    }

    function _merge(uint256 survivorId, uint256 burnId, bool swap) internal {
        if (survivorId == burnId) revert SameToken();
        if (ownerOf(survivorId) != msg.sender) revert NotOwner();
        if (ownerOf(burnId) != msg.sender) revert NotOwner();

        Dot storage s = _dots[survivorId];
        Dot storage b = _dots[burnId];

        if (s.divisorIndex != b.divisorIndex) revert DifferentDivisors();
        if (s.divisorIndex >= 6) revert AlreadyMega();

        if (swap) {
            // Adopt the burn token's seed + traits. Visual identity transplant.
            uint32 tmpSeed = s.seed;
            uint8 tmpCb = s.colorBandIdx;
            uint8 tmpGr = s.gradientIdx;
            uint8 tmpDir = s.direction;
            uint8 tmpSp = s.speed;
            s.seed = b.seed;
            s.colorBandIdx = b.colorBandIdx;
            s.gradientIdx = b.gradientIdx;
            s.direction = b.direction;
            s.speed = b.speed;
            b.seed = tmpSeed;
            b.colorBandIdx = tmpCb;
            b.gradientIdx = tmpGr;
            b.direction = tmpDir;
            b.speed = tmpSp;
        }

        // Record the burn partner in the merges history at the current level.
        uint16 oldDivisor = s.divisorIndex;
        s.merges[oldDivisor] = uint24(burnId);

        unchecked {
            s.divisorIndex = oldDivisor + 1;
            s.merged = s.merged + 1 + b.merged;
        }

        delete _dots[burnId];
        _burn(burnId);
        unchecked {
            totalSupply -= 1;
            // Two tokens leave the old level; one survivor joins the new level.
            _circulation[oldDivisor] -= 2;
            _circulation[oldDivisor + 1] += 1;
        }

        emit Merged(survivorId, burnId, s.divisorIndex);
        emit MetadataUpdate(survivorId);
    }

    function infinity(uint256[] calldata tokenIds) external {
        if (tokenIds.length != INFINITY_SIZE) revert MegaDotRequires64();

        uint256 keeper = tokenIds[0];
        if (ownerOf(keeper) != msg.sender) revert NotOwner();
        Dot storage k = _dots[keeper];
        if (k.divisorIndex != 6) revert NotSingleDot();

        for (uint256 i = 1; i < INFINITY_SIZE; ++i) {
            uint256 id = tokenIds[i];
            if (id == keeper) revert SameToken();
            // Reject duplicates within the burned set up front so the revert
            // is a clean SameToken() rather than whatever ERC721 reverts with
            // on the second _burn of the same id. O(N^2) is fine — N is 64.
            for (uint256 j = 1; j < i; ++j) {
                if (tokenIds[j] == id) revert SameToken();
            }
            if (ownerOf(id) != msg.sender) revert NotOwner();
            if (_dots[id].divisorIndex != 6) revert NotSingleDot();
            delete _dots[id];
            _burn(id);
        }

        k.divisorIndex = 7;
        k.isMega = 1;
        unchecked {
            k.merged += uint16(INFINITY_SIZE - 1);
            totalSupply -= (INFINITY_SIZE - 1);
            // All 64 single dots leave level 6; one Mega Dot joins level 7.
            _circulation[6] -= INFINITY_SIZE;
            _circulation[7] += 1;
        }

        emit Infinity(keeper, tokenIds);
        emit MetadataUpdate(keeper);
    }

    function burn(uint256 tokenId) external {
        if (ownerOf(tokenId) != msg.sender) revert NotOwner();
        uint16 d = _dots[tokenId].divisorIndex;
        delete _dots[tokenId];
        _burn(tokenId);
        unchecked {
            totalSupply -= 1;
            _circulation[d] -= 1;
        }
        emit Burned(tokenId);
    }

    // -----------------------------------------------------------------------
    // Views
    // -----------------------------------------------------------------------

    function getDot(uint256 tokenId) external view returns (Dot memory) {
        _requireOwned(tokenId);
        return _dots[tokenId];
    }

    /// @notice Live circulation at each divisorIndex (0..7).
    /// @dev    Mapping: 0 -> 80 dots, 1 -> 40 dots, 2 -> 20 dots, 3 -> 10 dots,
    ///                  4 -> 5 dots, 5 -> 4 dots, 6 -> 1 dot (single),
    ///                  7 -> Mega Dot.
    function circulation() external view returns (uint256[8] memory) {
        return _circulation;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return DotsMetadata.tokenURI(tokenId, _dots[tokenId]);
    }

    /// @notice Collection-level metadata for OpenSea and other marketplaces.
    /// @dev    If the owner has set an explicit URI via setContractURI(), return that.
    ///         Otherwise return a fallback inline base64 JSON so the collection shows
    ///         name/description/image/banner/royalty immediately after deploy —
    ///         still 100% onchain, no IPFS or hosted assets.
    function contractURI() external view returns (string memory) {
        if (bytes(_contractURIValue).length > 0) return _contractURIValue;
        // Build two inline SVGs — a square collection image and a wide banner.
        string memory imageUri = _collectionImageSvg();
        string memory bannerUri = _collectionBannerSvg();
        bytes memory json = abi.encodePacked(
            '{"name":"Dots",',
            '"description":"Onchain generative edition on MegaETH. Open mint, merge 80 -> 40 -> 20 -> 10 -> 5 -> 4 -> 1, then burn 64 single dots into one Mega Dot. All art is rendered fully onchain from seed.",',
            '"image":"', imageUri, '",',
            '"banner_image":"', bannerUri, '",',
            '"external_link":"https://dots.megaeth.art",',
            '"seller_fee_basis_points":500,',
            '"fee_recipient":"',
            Strings.toHexString(uint160(owner()), 20),
            '"}'
        );
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(json)));
    }

    /// @dev Square SVG used as the OpenSea collection thumbnail (via contractURI
    ///      fallback). Renders a single-dot "infinity terminal" on a dark canvas
    ///      so the collection identity is clear before any token is minted.
    function _collectionImageSvg() private pure returns (string memory) {
        bytes memory svg = abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">',
            '<rect width="800" height="800" fill="#0a0a14"/>',
            '<circle cx="400" cy="400" r="180" fill="#DFD9D9"/>',
            '<text x="400" y="470" text-anchor="middle" font-family="Inter,sans-serif" font-size="200" font-weight="700" fill="#19191A">M</text>',
            '<text x="400" y="700" text-anchor="middle" font-family="Inter,sans-serif" font-size="48" font-weight="600" fill="#E7E7EA" letter-spacing="4">DOTS</text>',
            '</svg>'
        );
        return string(abi.encodePacked(
            "data:image/svg+xml;base64,", Base64.encode(svg)
        ));
    }

    /// @dev Wide SVG used as the OpenSea collection banner (via contractURI
    ///      fallback). Shows the merge ladder 80 -> 40 -> 20 -> 10 -> 5 -> 4 -> 1
    ///      as seven increasingly spare glyph counts.
    function _collectionBannerSvg() private pure returns (string memory) {
        bytes memory svg = abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 400">',
            '<rect width="1400" height="400" fill="#0a0a14"/>',
            // 7 circles along the horizontal midline, shrinking left->right.
            '<circle cx="170"  cy="200" r="90" fill="#E84AA9"/>',
            '<circle cx="340"  cy="200" r="76" fill="#FCDE5B"/>',
            '<circle cx="505"  cy="200" r="62" fill="#94E337"/>',
            '<circle cx="660"  cy="200" r="50" fill="#5FCD8C"/>',
            '<circle cx="805"  cy="200" r="40" fill="#60B1F4"/>',
            '<circle cx="935"  cy="200" r="32" fill="#4576D0"/>',
            '<circle cx="1050" cy="200" r="26" fill="#6C31D7"/>',
            // Terminal Mega Dot at the right.
            '<circle cx="1230" cy="200" r="80" fill="#DFD9D9"/>',
            '<text x="1230" y="232" text-anchor="middle" font-family="Inter,sans-serif" font-size="100" font-weight="700" fill="#19191A">M</text>',
            '</svg>'
        );
        return string(abi.encodePacked(
            "data:image/svg+xml;base64,", Base64.encode(svg)
        ));
    }

    /// @notice ERC-165 — advertise ERC2981 support alongside ERC721.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // -----------------------------------------------------------------------
    // Owner admin
    // -----------------------------------------------------------------------

    function setMintWindow(uint64 _mintStart, uint64 _mintEnd) external onlyOwner {
        mintStart = _mintStart;
        mintEnd = _mintEnd;
    }

    function setMintPrice(uint256 _price) external onlyOwner {
        mintPrice = _price;
    }

    function withdraw(address payable to) external onlyOwner {
        (bool ok, ) = to.call{value: address(this).balance}("");
        if (!ok) revert WithdrawFailed();
    }

    function setContractURI(string calldata uri) external onlyOwner {
        _contractURIValue = uri;
    }

    function setDefaultRoyalty(address receiver, uint96 bps) external onlyOwner {
        _setDefaultRoyalty(receiver, bps);
    }
}
