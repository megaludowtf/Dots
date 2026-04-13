// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IDots} from "./interfaces/IDots.sol";
import {EightyColors} from "./libraries/EightyColors.sol";

/// @title DotsArt
/// @notice Pure SVG renderer for Dots. Mirrors the spirit of VV:
///         colours are drawn from an 80-entry sorted gradient palette, walked through
///         a randomly-chosen `colorBand` with a randomly-chosen `gradient` stride.
///         Merged tokens inherit colour shifts from their ancestors.
library DotsArt {
    // ---------- Canvas + layout ----------
    uint256 internal constant CANVAS_W = 680;
    uint256 internal constant CANVAS_H = 840;
    uint256 internal constant COLS = 8;
    uint256 internal constant ROWS = 10;
    uint256 internal constant PAD = 20;
    uint256 internal constant CELL = 80;
    uint256 internal constant GLYPH = 60;
    uint256 internal constant BLOCK = 160;
    uint256 internal constant BLOCK_GLYPH = 120;

    // ---------- Static SVG chrome ----------
    string internal constant SVG_OPEN =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 840" width="680" height="840" preserveAspectRatio="xMidYMid meet" overflow="hidden">';
    string internal constant SVG_BG = '<rect width="680" height="840" fill="#0a0a14"/>';
    string internal constant SVG_GRID =
        '<path d="M20 20V820M100 20V820M180 20V820M260 20V820M340 20V820M420 20V820M500 20V820M580 20V820M660 20V820'
        'M20 20H660M20 100H660M20 180H660M20 260H660M20 340H660M20 420H660M20 500H660M20 580H660M20 660H660M20 740H660M20 820H660" '
        'stroke="#1e1e2a" stroke-width="1" fill="none"/>';
    string internal constant SVG_CLOSE = "</svg>";

    // ---------- Logomark symbol ----------
    string internal constant SYMBOL_M_DARK =
        '<symbol id="m" viewBox="0 0 48 48">'
        '<circle cx="18" cy="28.978" r="2" fill="#19191A"/>'
        '<circle cx="30" cy="28.978" r="2" fill="#19191A"/>'
        '<path d="M32.974,20.864C34.809,19.36,36,16.462,36,12.978c0-5.131-2.58-9-6-9'
        's-6,3.869-6,9c0,1.903,0.356,3.631,0.977,5.054c-0.325-0.021-0.647-0.054-0.977-0.054'
        's-0.652,0.033-0.977,0.054C23.644,16.609,24,14.881,24,12.978c0-5.131-2.58-9-6-9'
        's-6,3.869-6,9c0,3.484,1.191,6.383,3.026,7.886C10.752,23.834,8,28.626,8,32.978'
        'c0,6.683,6.28,11,16,11s16-4.317,16-11C40,28.626,37.248,23.834,32.974,20.864z'
        ' M30,7.978c0.581,0,2,1.752,2,5s-1.419,5-2,5s-2-1.752-2-5S29.419,7.978,30,7.978z'
        ' M18,7.978c0.581,0,2,1.752,2,5s-1.419,5-2,5s-2-1.752-2-5S17.419,7.978,18,7.978z'
        ' M26,39.9v-3.922h2v-4h-8v4h2V39.9c-5.14-0.391-10-2.353-10-6.922'
        'c0-4.982,5.353-11,12-11s12,6.018,12,11C36,37.547,31.14,39.509,26,39.9z" fill="#19191A"/>'
        "</symbol>";

    // ---------- Trait tables ----------
    /// @dev 7 possible colour-band widths. Mirrors VV' band values.
    function colorBands() internal pure returns (uint256[7] memory) {
        return [uint256(80), 60, 40, 20, 10, 5, 1];
    }

    /// @dev 7 possible gradient stride values. 0 = random within band, higher = longer walks.
    function gradients() internal pure returns (uint256[7] memory) {
        return [uint256(0), 1, 2, 5, 8, 9, 10];
    }

    /// @dev Labels used in tokenURI attributes.
    function colorBandLabel(uint8 idx) internal pure returns (string memory) {
        string[7] memory labels =
            ["Eighty", "Sixty", "Forty", "Twenty", "Ten", "Five", "One"];
        return labels[idx];
    }

    function gradientLabel(uint8 idx) internal pure returns (string memory) {
        string[7] memory labels =
            ["None", "Linear", "Double Linear", "Reflected", "Double Angled", "Angled", "Linear Z"];
        return labels[idx];
    }

    /// @notice Number of visible glyphs for a given divisor index.
    function glyphCount(uint16 d) internal pure returns (uint256) {
        if (d == 0) return 80;
        if (d == 1) return 40;
        if (d == 2) return 20;
        if (d == 3) return 10;
        if (d == 4) return 5;
        if (d == 5) return 4;
        return 1; // 6 or 7
    }

    /// @notice Derive the colorBandIdx / gradientIdx / direction / speed traits from a raw seed.
    /// @dev    Called by the contract at mint time and cached in the Dot struct.
    function deriveTraits(uint32 seed)
        internal
        pure
        returns (uint8 colorBandIdx, uint8 gradientIdx, uint8 direction, uint8 speed)
    {
        uint256 h = uint256(keccak256(abi.encode(seed, "traits")));
        colorBandIdx = uint8(h % 7);
        // A band width of 1 (colorBandIdx == 6) means every glyph is the
        // same colour — gradient is meaningless, so force it to None (0).
        gradientIdx = colorBandIdx == 6 ? 0 : uint8((h >> 16) % 7);
        direction = uint8((h >> 32) & 1);
        speed = uint8(1 << ((h >> 48) % 3)); // 1, 2, or 4
    }

    // -----------------------------------------------------------------------
    // Colour derivation
    // -----------------------------------------------------------------------

    /// @notice Returns a palette index in [0, 80) for the `i`-th visible glyph of `c`.
    /// @dev    Uses the stable seed plus the merges history so merged tokens
    ///         inherit a colour signature from their ancestors — no seed reroll.
    function colorIndexFor(IDots.Dot memory c, uint256 i) internal pure returns (uint256) {
        uint256[7] memory bands = colorBands();
        uint256[7] memory grads = gradients();
        uint256 band = bands[c.colorBandIdx];
        uint256 grad = grads[c.gradientIdx];

        // Where in the 80-palette to anchor this token.
        uint256 startIndex = uint256(keccak256(abi.encode(c.seed, "start"))) % 80;

        // Nudge the anchor based on every burn partner folded into this survivor.
        uint256 nudge = 0;
        for (uint256 k = 0; k < 6; ++k) {
            if (c.merges[k] == 0) break;
            nudge = uint256(keccak256(abi.encode(nudge, c.merges[k])));
        }

        // Position within the band.
        uint256 step;
        if (grad == 0) {
            // gradient 0 = independent random pick within the band
            step = uint256(keccak256(abi.encode(c.seed, i, "glyph"))) % band;
        } else {
            uint256 count = glyphCount(c.divisorIndex);
            if (count == 0) count = 1;
            step = (i * grad * band / count) % band;
        }
        // Walk reverses if the token's animation direction is 1 (purely visual variation).
        if (c.direction == 1) step = (band - step) % band;

        return (startIndex + nudge + step) % 80;
    }

    function _hexColor(IDots.Dot memory c, uint256 i) private pure returns (string memory) {
        string[80] memory palette = EightyColors.COLORS();
        return palette[colorIndexFor(c, i)];
    }

    // -----------------------------------------------------------------------
    // Renderers
    // -----------------------------------------------------------------------

    function render(IDots.Dot memory c) internal pure returns (string memory) {
        if (c.divisorIndex >= 7 || c.isMega == 1) return _renderMegaDot();
        if (c.divisorIndex == 6) return _renderMega(c);
        if (c.divisorIndex >= 2) return _renderBlocks(c);
        return _renderGrid(c);
    }

    function _renderGrid(IDots.Dot memory c) private pure returns (string memory) {
        string memory cells = "";
        uint256 visibleIdx = 0;
        for (uint256 row = 0; row < ROWS; ++row) {
            for (uint256 col = 0; col < COLS; ++col) {
                if (c.divisorIndex == 1 && (col + row) % 2 != 0) continue;
                uint256 x = PAD + col * CELL + (CELL - GLYPH) / 2;
                uint256 y = PAD + row * CELL + (CELL - GLYPH) / 2;
                cells = string.concat(cells, _glyph(x, y, GLYPH, _hexColor(c, visibleIdx)));
                ++visibleIdx;
            }
        }
        return string.concat(SVG_OPEN, SVG_BG, SVG_GRID, _defs(), '<g clip-path="url(#canvas-clip)">', cells, '</g>', SVG_CLOSE);
    }

    function _renderBlocks(IDots.Dot memory c) private pure returns (string memory) {
        string memory cells = "";
        uint16 d = c.divisorIndex;
        uint256 visibleIdx = 0;

        if (d == 2) {
            for (uint256 br = 0; br < 5; ++br) {
                for (uint256 bc = 0; bc < 4; ++bc) {
                    uint256 x = PAD + bc * BLOCK + 20;
                    uint256 y = PAD + br * BLOCK + 20;
                    cells = string.concat(cells, _glyph(x, y, BLOCK_GLYPH, _hexColor(c, visibleIdx)));
                    ++visibleIdx;
                }
            }
        } else if (d == 3) {
            // 2 cols x 5 rows, centered
            for (uint256 br = 0; br < 5; ++br) {
                for (uint256 bc = 1; bc <= 2; ++bc) {
                    uint256 x = PAD + bc * BLOCK + 20;
                    uint256 y = PAD + br * BLOCK + 20;
                    cells = string.concat(cells, _glyph(x, y, BLOCK_GLYPH, _hexColor(c, visibleIdx)));
                    ++visibleIdx;
                }
            }
        } else if (d == 4) {
            uint256 x = (CANVAS_W - BLOCK_GLYPH) / 2;
            for (uint256 br = 0; br < 5; ++br) {
                uint256 y = PAD + br * BLOCK + 20;
                cells = string.concat(cells, _glyph(x, y, BLOCK_GLYPH, _hexColor(c, br)));
            }
        } else {
            // d == 5: 2x2 centered on canvas
            uint256[4] memory xs = [uint256(200), uint256(360), uint256(200), uint256(360)];
            uint256[4] memory ys = [uint256(280), uint256(280), uint256(440), uint256(440)];
            for (uint256 i = 0; i < 4; ++i) {
                cells = string.concat(cells, _glyph(xs[i], ys[i], BLOCK_GLYPH, _hexColor(c, i)));
            }
        }

        return string.concat(SVG_OPEN, SVG_BG, SVG_GRID, _defs(), '<g clip-path="url(#canvas-clip)">', cells, '</g>', SVG_CLOSE);
    }

    function _renderMega(IDots.Dot memory c) private pure returns (string memory) {
        uint256 x = (CANVAS_W - BLOCK_GLYPH) / 2;
        uint256 y = (CANVAS_H - BLOCK_GLYPH) / 2;
        string memory mark = _glyph(x, y, BLOCK_GLYPH, _hexColor(c, 0));
        return string.concat(SVG_OPEN, SVG_BG, SVG_GRID, _defs(), '<g clip-path="url(#canvas-clip)">', mark, '</g>', SVG_CLOSE);
    }

    function _renderMegaDot() private pure returns (string memory) {
        // Same dark canvas + grid as every other divisor, with a #DFD9D9 disc and
        // the black MegaETH logomark on top.
        uint256 x = (CANVAS_W - BLOCK_GLYPH) / 2;
        uint256 y = (CANVAS_H - BLOCK_GLYPH) / 2;
        uint256 half = BLOCK_GLYPH / 2;
        string memory mark = string.concat(
            '<circle cx="', Strings.toString(x + half),
            '" cy="', Strings.toString(y + half),
            '" r="', Strings.toString(half),
            '" fill="#DFD9D9"/>',
            '<use href="#m" x="', Strings.toString(x),
            '" y="', Strings.toString(y),
            '" width="', Strings.toString(BLOCK_GLYPH),
            '" height="', Strings.toString(BLOCK_GLYPH),
            '"/>'
        );
        return string.concat(SVG_OPEN, SVG_BG, SVG_GRID, _defs(), '<g clip-path="url(#canvas-clip)">', mark, '</g>', SVG_CLOSE);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    function _defs() private pure returns (string memory) {
        return string.concat(
            "<defs>", SYMBOL_M_DARK,
            '<clipPath id="canvas-clip"><rect width="680" height="840"/></clipPath>',
            "</defs>"
        );
    }

    function _glyph(uint256 x, uint256 y, uint256 size, string memory hexColor)
        private
        pure
        returns (string memory)
    {
        uint256 half = size / 2;
        return string.concat(
            '<circle cx="', Strings.toString(x + half),
            '" cy="', Strings.toString(y + half),
            '" r="', Strings.toString(half),
            '" fill="#', hexColor, '"/>',
            '<use href="#m" x="', Strings.toString(x),
            '" y="', Strings.toString(y),
            '" width="', Strings.toString(size),
            '" height="', Strings.toString(size),
            '"/>'
        );
    }
}
