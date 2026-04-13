// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {Dots} from "../src/Dots.sol";
import {DotsArt} from "../src/DotsArt.sol";
import {EightyColors} from "../src/libraries/EightyColors.sol";
import {IDots} from "../src/interfaces/IDots.sol";

contract ArtTest is Test {
    Dots internal dots;
    address internal owner = address(0xABCD);
    address internal alice = address(0xA11CE);

    uint256 internal constant PRICE = 0.001 ether;

    function setUp() public {
        vm.warp(1_000_000);
        dots = new Dots(owner, PRICE, uint64(block.timestamp), uint64(block.timestamp + 30 days));
        vm.deal(alice, 10 ether);
    }

    function _dot(uint16 d, uint32 seed) internal pure returns (IDots.Dot memory c) {
        c.seed = seed;
        c.divisorIndex = d;
        c.merged = 0;
        c.isMega = d == 7 ? 1 : 0;
        // Derive the same traits the contract would cache at mint time.
        (uint8 cb, uint8 gr, uint8 dir, uint8 sp) = DotsArt.deriveTraits(seed);
        c.colorBandIdx = cb;
        c.gradientIdx = gr;
        c.direction = dir;
        c.speed = sp;
    }

    // -------- glyphCount sanity --------

    function test_GlyphCount_Ladder() public pure {
        assertEq(DotsArt.glyphCount(0), 80);
        assertEq(DotsArt.glyphCount(1), 40);
        assertEq(DotsArt.glyphCount(2), 20);
        assertEq(DotsArt.glyphCount(3), 10);
        assertEq(DotsArt.glyphCount(4), 5);
        assertEq(DotsArt.glyphCount(5), 4);
        assertEq(DotsArt.glyphCount(6), 1);
        assertEq(DotsArt.glyphCount(7), 1);
    }

    // -------- Renderer output shape --------

    function test_Render_AllLevels_EmitValidSvg() public pure {
        for (uint16 d = 0; d <= 7; ++d) {
            IDots.Dot memory c = _dot(d, 0xDEADBEEF);
            string memory svg = DotsArt.render(c);
            bytes memory b = bytes(svg);
            assertGt(b.length, 200, "svg too short");
            assertEq(b[0], bytes1("<"));
            assertEq(b[1], bytes1("s"));
            assertEq(b[2], bytes1("v"));
            assertEq(b[3], bytes1("g"));
            assertEq(b[b.length - 1], bytes1(">"));
        }
    }

    function test_Render_GridContainsIconSymbol() public pure {
        IDots.Dot memory c = _dot(0, 42);
        string memory svg = DotsArt.render(c);
        assertTrue(_contains(svg, '<use href="#m"'), "grid should use icon symbol");
    }

    function test_Render_MegaIsSingleCenteredGlyph() public pure {
        IDots.Dot memory c = _dot(6, 1234);
        string memory svg = DotsArt.render(c);
        assertTrue(_contains(svg, 'x="280"'), "mega glyph horizontally centered");
        assertTrue(_contains(svg, 'y="360"'), "mega glyph vertically centered");
        assertTrue(_contains(svg, 'width="120"'), "mega glyph 2x2 footprint");
    }

    function test_Render_MegaDot_Style() public pure {
        IDots.Dot memory c = _dot(7, 99);
        string memory svg = DotsArt.render(c);
        // Dark canvas (like every other divisor) + warm off-white disc + black logomark.
        assertTrue(_contains(svg, 'fill="#0a0a14"'), "dark canvas like other divisors");
        assertTrue(_contains(svg, 'fill="#DFD9D9"'), "warm off-white disc");
        assertTrue(_contains(svg, '<use href="#m"'), "final dot uses the black logo symbol");
    }

    function test_Render_Divisor2_UsesBlockGlyphs() public pure {
        IDots.Dot memory c = _dot(2, 7777);
        string memory svg = DotsArt.render(c);
        assertTrue(_contains(svg, 'width="120"'), "divisor 2 uses 120x120 glyphs");
    }

    function test_Render_UsesPalette() public pure {
        // Render a divisor-0 token (80 visible glyphs) and assert every fill hex found in
        // the SVG is a valid EightyColors entry. This is a much stronger invariant than
        // checking a few hand-picked hex values.
        IDots.Dot memory c = _dot(0, 0xABCDEF01);
        string memory svg = DotsArt.render(c);
        string[80] memory palette = EightyColors.COLORS();

        // At divisor 0 every rendered fill is drawn from the palette. Scan the SVG for
        // `fill="#XXXXXX"` substrings and verify each sits in the palette.
        bytes memory b = bytes(svg);
        bytes memory needle = bytes('fill="#');
        uint256 found = 0;
        for (uint256 i = 0; i + needle.length + 6 < b.length; ++i) {
            bool match_ = true;
            for (uint256 j = 0; j < needle.length; ++j) {
                if (b[i + j] != needle[j]) { match_ = false; break; }
            }
            if (!match_) continue;
            // Extract the 6 hex chars after `fill="#`.
            bytes memory hex_ = new bytes(6);
            for (uint256 j = 0; j < 6; ++j) hex_[j] = b[i + needle.length + j];
            string memory extracted = string(hex_);
            // Skip non-palette chrome colours (background, grid strokes, logo fill).
            if (
                _eq(extracted, "000000") || _eq(extracted, "ffffff") ||
                _eq(extracted, "0a0a14") || _eq(extracted, "1e1e2a") ||
                _eq(extracted, "e5e5ea") || _eq(extracted, "19191A") ||
                _eq(extracted, "19191a")
            ) continue;
            bool inPalette = false;
            for (uint256 k = 0; k < 80; ++k) {
                if (_eq(extracted, palette[k])) { inPalette = true; break; }
            }
            assertTrue(inPalette, "fill hex must be a palette entry");
            found++;
        }
        assertGt(found, 0, "should have found at least one palette fill");
    }

    function _eq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    // -------- tokenURI end-to-end --------

    function test_TokenURI_WellFormedJson() public {
        vm.prank(alice);
        dots.mint{value: PRICE}(1);

        string memory uri = dots.tokenURI(1);
        bytes memory b = bytes(uri);

        assertTrue(_startsWith(uri, "data:application/json;base64,"));

        uint256 prefixLen = bytes("data:application/json;base64,").length;
        bytes memory b64 = new bytes(b.length - prefixLen);
        for (uint256 i = 0; i < b64.length; ++i) b64[i] = b[prefixLen + i];
        bytes memory json = _b64decode(string(b64));

        assertTrue(_contains(string(json), '"name":"Dot #1"'));
        assertTrue(_contains(string(json), '"image":"data:image/svg+xml;base64,'));
        assertTrue(_contains(string(json), '"trait_type":"Dots","value":80'));
    }

    // -------- helpers --------

    function _startsWith(string memory s, string memory prefix) internal pure returns (bool) {
        bytes memory bs = bytes(s);
        bytes memory bp = bytes(prefix);
        if (bs.length < bp.length) return false;
        for (uint256 i = 0; i < bp.length; ++i) {
            if (bs[i] != bp[i]) return false;
        }
        return true;
    }

    function _contains(string memory s, string memory sub) internal pure returns (bool) {
        bytes memory bs = bytes(s);
        bytes memory bu = bytes(sub);
        if (bu.length == 0) return true;
        if (bs.length < bu.length) return false;
        for (uint256 i = 0; i <= bs.length - bu.length; ++i) {
            bool hit = true;
            for (uint256 j = 0; j < bu.length; ++j) {
                if (bs[i + j] != bu[j]) { hit = false; break; }
            }
            if (hit) return true;
        }
        return false;
    }

    function _b64decode(string memory input) internal pure returns (bytes memory) {
        bytes memory data = bytes(input);
        if (data.length == 0) return new bytes(0);
        require(data.length % 4 == 0, "bad b64 len");
        uint256 padding = 0;
        if (data[data.length - 1] == "=") padding++;
        if (data[data.length - 2] == "=") padding++;
        bytes memory result = new bytes((data.length / 4) * 3 - padding);
        uint256 j = 0;
        for (uint256 i = 0; i < data.length; i += 4) {
            uint8 a = _b64char(uint8(data[i]));
            uint8 b = _b64char(uint8(data[i + 1]));
            uint8 c = _b64char(uint8(data[i + 2]));
            uint8 d = _b64char(uint8(data[i + 3]));
            uint32 triple = (uint32(a) << 18) | (uint32(b) << 12) | (uint32(c) << 6) | uint32(d);
            if (j < result.length) result[j++] = bytes1(uint8(triple >> 16));
            if (j < result.length) result[j++] = bytes1(uint8(triple >> 8));
            if (j < result.length) result[j++] = bytes1(uint8(triple));
        }
        return result;
    }

    function _b64char(uint8 ch) private pure returns (uint8) {
        if (ch >= 65 && ch <= 90) return ch - 65;
        if (ch >= 97 && ch <= 122) return ch - 71;
        if (ch >= 48 && ch <= 57) return ch + 4;
        if (ch == 43) return 62;
        if (ch == 47) return 63;
        return 0;
    }
}
