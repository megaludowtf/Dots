// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {IDots} from "./interfaces/IDots.sol";
import {DotsArt} from "./DotsArt.sol";

/// @title DotsMetadata
/// @notice Builds the base64-encoded ERC721 JSON metadata document for a token.
///         OpenSea and most marketplaces key rarity off the `attributes` array.
///         Trait names and values match Checks — VV Edition for compatibility.
library DotsMetadata {
    function tokenURI(uint256 tokenId, IDots.Dot memory c) internal pure returns (string memory) {
        string memory svg = DotsArt.render(c);
        string memory image = string.concat("data:image/svg+xml;base64,", Base64.encode(bytes(svg)));

        string memory attrs = _attributes(c);

        string memory json = string.concat(
            '{"name":"Dot #',
            Strings.toString(tokenId),
            '","description":"Dots \\u2014 an onchain generative edition on MegaETH. Merge two dots of the same divisor to burn one and advance the other toward the terminal Mega Dot.",',
            '"image":"',
            image,
            '","attributes":',
            attrs,
            "}"
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    /// @dev Speed raw values: 1, 2, 4. Checks VV displays as: 2x, 1x, 0.5x.
    function _speedLabel(uint8 speed) private pure returns (string memory) {
        if (speed == 1) return "2x";
        if (speed == 2) return "1x";
        return "0.5x"; // speed == 4
    }

    function _attributes(IDots.Dot memory c) private pure returns (string memory) {
        // Split into multiple concat calls to stay under stack-depth limits.
        string memory part1 = string.concat(
            '[{"trait_type":"Dots","value":',
            Strings.toString(DotsArt.glyphCount(c.divisorIndex)),
            '},{"trait_type":"Divisor Index","value":',
            Strings.toString(uint256(c.divisorIndex)),
            '},{"trait_type":"Merged","value":',
            Strings.toString(uint256(c.merged)),
            '},'
        );

        string memory part2 = string.concat(
            '{"trait_type":"Color Band","value":"',
            DotsArt.colorBandLabel(c.colorBandIdx),
            '"},{"trait_type":"Gradient","value":"',
            DotsArt.gradientLabel(c.gradientIdx),
            '"},'
        );

        string memory part3 = string.concat(
            '{"trait_type":"Shift","value":"',
            c.direction == 0 ? "IR" : "UV",
            '"},{"trait_type":"Speed","value":"',
            _speedLabel(c.speed),
            '"},{"trait_type":"Seed","value":"',
            Strings.toHexString(uint256(c.seed), 4),
            '"},{"trait_type":"Mega Dot","value":"',
            c.isMega == 1 ? "Yes" : "No",
            '"}]'
        );

        return string.concat(part1, part2, part3);
    }
}
