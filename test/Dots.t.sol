// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Dots} from "../src/Dots.sol";
import {IDots} from "../src/interfaces/IDots.sol";

contract DotsTest is Test {
    Dots internal dots;
    address internal owner = address(0xABCD);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    uint256 internal constant PRICE = 0.001 ether;

    function setUp() public {
        vm.warp(1_000_000);
        dots = new Dots(owner, PRICE, uint64(block.timestamp), uint64(block.timestamp + 7 days));
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    // -------- Mint --------

    function test_Mint_SingleToken() public {
        vm.prank(alice);
        dots.mint{value: PRICE}(1);

        assertEq(dots.ownerOf(1), alice);
        assertEq(dots.totalSupply(), 1);
        assertEq(dots.nextTokenId(), 2);

        IDots.Dot memory c = dots.getDot(1);
        assertEq(c.divisorIndex, 0);
        assertEq(c.merged, 0);
        assertEq(c.isMega, 0);
        assertTrue(c.seed != 0);
    }

    function test_Mint_Batch() public {
        vm.prank(alice);
        dots.mint{value: PRICE * 10}(10);

        assertEq(dots.totalSupply(), 10);
        for (uint256 i = 1; i <= 10; ++i) {
            assertEq(dots.ownerOf(i), alice);
        }
    }

    function test_Mint_RevertIfClosed() public {
        vm.warp(block.timestamp + 8 days);
        vm.expectRevert(IDots.MintClosed.selector);
        vm.prank(alice);
        dots.mint{value: PRICE}(1);
    }

    function test_Mint_RevertIfUnderpaid() public {
        vm.expectRevert(IDots.Underpaid.selector);
        vm.prank(alice);
        dots.mint{value: PRICE - 1}(1);
    }

    function test_Mint_RevertIfZero() public {
        vm.expectRevert(IDots.InvalidTokenCount.selector);
        vm.prank(alice);
        dots.mint{value: 0}(0);
    }

    function test_Mint_RevertIfTooMany() public {
        vm.expectRevert(IDots.InvalidTokenCount.selector);
        vm.prank(alice);
        dots.mint{value: PRICE * 51}(51);
    }

    function test_Mint_EmitsBatchMetadataUpdate() public {
        vm.expectEmit(false, false, false, true);
        emit IDots.BatchMetadataUpdate(1, 3);
        vm.prank(alice);
        dots.mint{value: PRICE * 3}(3);
    }

    // -------- Burn --------

    function test_Burn_DestroysToken() public {
        vm.startPrank(alice);
        dots.mint{value: PRICE}(1);
        dots.burn(1);
        vm.stopPrank();

        assertEq(dots.totalSupply(), 0);
        vm.expectRevert();
        dots.ownerOf(1);
    }

    function test_Burn_RevertIfNotOwner() public {
        vm.prank(alice);
        dots.mint{value: PRICE}(1);

        vm.prank(bob);
        vm.expectRevert(IDots.NotOwner.selector);
        dots.burn(1);
    }

    // -------- Owner admin --------

    function test_Admin_OnlyOwnerCanWithdraw() public {
        vm.prank(alice);
        dots.mint{value: PRICE * 3}(3);

        uint256 before = owner.balance;
        vm.prank(owner);
        dots.withdraw(payable(owner));
        assertEq(owner.balance - before, PRICE * 3);
    }

    function test_Admin_NonOwnerCannotWithdraw() public {
        vm.prank(alice);
        dots.mint{value: PRICE}(1);

        vm.expectRevert();
        vm.prank(alice);
        dots.withdraw(payable(alice));
    }

    function test_Admin_SetMintPrice() public {
        vm.prank(owner);
        dots.setMintPrice(0.01 ether);
        assertEq(dots.mintPrice(), 0.01 ether);
    }

    function test_Admin_SetMintWindow() public {
        vm.prank(owner);
        dots.setMintWindow(uint64(block.timestamp + 1 days), uint64(block.timestamp + 2 days));
        assertEq(dots.mintStart(), uint64(block.timestamp + 1 days));
    }

    // -------- Circulation counter --------

    function test_Circulation_InitialZero() public view {
        uint256[8] memory c = dots.circulation();
        for (uint256 i = 0; i < 8; ++i) assertEq(c[i], 0);
    }

    function test_Circulation_IncrementsOnMint() public {
        vm.prank(alice);
        dots.mint{value: PRICE * 5}(5);
        uint256[8] memory c = dots.circulation();
        assertEq(c[0], 5, "5 fresh tokens at divisor 0");
        for (uint256 i = 1; i < 8; ++i) assertEq(c[i], 0);
    }

    function test_Circulation_DecrementsOnBurn() public {
        vm.startPrank(alice);
        dots.mint{value: PRICE * 3}(3);
        dots.burn(2);
        vm.stopPrank();
        uint256[8] memory c = dots.circulation();
        assertEq(c[0], 2, "2 tokens left at divisor 0 after burning one");
    }

    function test_Circulation_AdvancesOnMerge() public {
        vm.startPrank(alice);
        dots.mint{value: PRICE * 2}(2);
        dots.merge(1, 2, false);
        vm.stopPrank();
        uint256[8] memory c = dots.circulation();
        assertEq(c[0], 0, "both originals left divisor 0");
        assertEq(c[1], 1, "survivor joined divisor 1");
    }

    // -------- Metadata & interface support --------

    function test_ContractURI_Fallback_HasRequiredFields() public view {
        string memory uri = dots.contractURI();
        bytes memory b = bytes(uri);
        // Must be a base64 JSON data URL.
        assertTrue(b.length > 100, "uri too short");
        assertTrue(_startsWith(uri, "data:application/json;base64,"));
        // Decode and sanity-check that the JSON has every marketplace-critical key.
        bytes memory json = _decodeBase64Prefix(uri, "data:application/json;base64,");
        assertTrue(_contains(string(json), '"name":"Dots"'));
        assertTrue(_contains(string(json), '"description":'));
        assertTrue(_contains(string(json), '"image":"data:image/svg+xml;base64,'));
        assertTrue(_contains(string(json), '"banner_image":"data:image/svg+xml;base64,'));
        assertTrue(_contains(string(json), '"external_link":'));
        assertTrue(_contains(string(json), '"seller_fee_basis_points":500'));
        assertTrue(_contains(string(json), '"fee_recipient":"0x'));
    }

    function test_ContractURI_Override_TakesPrecedence() public {
        string memory custom = "ipfs://bafy-custom-override";
        vm.prank(owner);
        dots.setContractURI(custom);
        assertEq(dots.contractURI(), custom, "owner override must win over fallback");
    }

    function test_SetContractURI_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        dots.setContractURI("hax");
    }

    function test_RoyaltyInfo_DefaultsTo5pct() public view {
        // ERC-2981 default set in constructor: 500 bps to deployer (`owner`).
        (address receiver, uint256 amount) = dots.royaltyInfo(1, 10_000 wei);
        assertEq(receiver, owner, "royalty recipient is the deployer");
        assertEq(amount, 500 wei, "5% of 10000 = 500");
    }

    function test_SetDefaultRoyalty_OwnerOnly() public {
        vm.prank(owner);
        dots.setDefaultRoyalty(alice, 1000); // 10% to alice
        (address r, uint256 a) = dots.royaltyInfo(1, 10_000 wei);
        assertEq(r, alice);
        assertEq(a, 1000);

        vm.prank(bob);
        vm.expectRevert();
        dots.setDefaultRoyalty(bob, 10000);
    }

    function test_SupportsInterface_AdvertisesEverything() public view {
        // ERC-165 itself
        assertTrue(dots.supportsInterface(0x01ffc9a7), "erc-165");
        // ERC-721
        assertTrue(dots.supportsInterface(0x80ac58cd), "erc-721");
        // ERC-721 Metadata
        assertTrue(dots.supportsInterface(0x5b5e139f), "erc-721 metadata");
        // ERC-2981 royalty
        assertTrue(dots.supportsInterface(0x2a55205a), "erc-2981");
        // Unknown interface returns false
        assertFalse(dots.supportsInterface(0xdeadbeef), "unknown returns false");
    }

    // -------- Internal helpers for contractURI JSON parsing --------

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

    function _decodeBase64Prefix(string memory full, string memory prefix)
        internal pure returns (bytes memory)
    {
        bytes memory bs = bytes(full);
        bytes memory bp = bytes(prefix);
        bytes memory payload = new bytes(bs.length - bp.length);
        for (uint256 i = 0; i < payload.length; ++i) payload[i] = bs[bp.length + i];
        return _b64decode(string(payload));
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
            uint8 b_ = _b64char(uint8(data[i + 1]));
            uint8 c = _b64char(uint8(data[i + 2]));
            uint8 d = _b64char(uint8(data[i + 3]));
            uint32 triple = (uint32(a) << 18) | (uint32(b_) << 12) | (uint32(c) << 6) | uint32(d);
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

    function test_Circulation_TracksFullLadder() public {
        // Mint 64, walk them down to one single dot, then verify circulation.
        vm.startPrank(alice);
        uint256 remaining = 64;
        while (remaining > 0) {
            uint256 batch = remaining > 50 ? 50 : remaining;
            dots.mint{value: PRICE * batch}(batch);
            remaining -= batch;
        }
        // 32 pairs -> divisor 1
        for (uint256 i = 0; i < 32; ++i) dots.merge(1 + i * 2, 2 + i * 2, false);
        // 16 pairs -> divisor 2
        for (uint256 i = 0; i < 16; ++i) dots.merge(1 + i * 4, 3 + i * 4, false);
        // 8 pairs -> divisor 3
        for (uint256 i = 0; i < 8; ++i) dots.merge(1 + i * 8, 5 + i * 8, false);
        // 4 pairs -> divisor 4
        for (uint256 i = 0; i < 4; ++i) dots.merge(1 + i * 16, 9 + i * 16, false);
        // 2 pairs -> divisor 5
        dots.merge(1, 17, false);
        dots.merge(33, 49, false);
        // 1 pair -> divisor 6
        dots.merge(1, 33, false);
        vm.stopPrank();

        uint256[8] memory c = dots.circulation();
        assertEq(c[0], 0);
        assertEq(c[1], 0);
        assertEq(c[2], 0);
        assertEq(c[3], 0);
        assertEq(c[4], 0);
        assertEq(c[5], 0);
        assertEq(c[6], 1, "single dot survivor at divisor 6");
        assertEq(c[7], 0);
        assertEq(dots.totalSupply(), 1);
    }
}
