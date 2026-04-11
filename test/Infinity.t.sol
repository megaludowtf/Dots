// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Dots} from "../src/Dots.sol";
import {IDots} from "../src/interfaces/IDots.sol";

/// @notice Tests the terminal Mega Dot state: 64 single dots -> 1 divisor-7 token.
contract InfinityTest is Test {
    Dots internal dots;
    address internal owner = address(0xABCD);
    address internal alice = address(0xA11CE);
    uint256 internal constant PRICE = 0.001 ether;

    function setUp() public {
        vm.warp(1_000_000);
        dots = new Dots(owner, PRICE, uint64(block.timestamp), uint64(block.timestamp + 30 days));
        vm.deal(alice, 100 ether);
    }

    function _mint(address to, uint256 amount) internal {
        uint256 remaining = amount;
        while (remaining > 0) {
            uint256 batch = remaining > 50 ? 50 : remaining;
            vm.prank(to);
            dots.mint{value: PRICE * batch}(batch);
            remaining -= batch;
        }
    }

    function _reduce64To1(uint256 startId) internal {
        for (uint256 i = 0; i < 32; ++i) dots.merge(startId + i * 2, startId + 1 + i * 2, false);
        for (uint256 i = 0; i < 16; ++i) dots.merge(startId + i * 4, startId + 2 + i * 4, false);
        for (uint256 i = 0; i < 8; ++i)  dots.merge(startId + i * 8, startId + 4 + i * 8, false);
        for (uint256 i = 0; i < 4; ++i)  dots.merge(startId + i * 16, startId + 8 + i * 16, false);
        dots.merge(startId, startId + 16, false);
        dots.merge(startId + 32, startId + 48, false);
        dots.merge(startId, startId + 32, false);
    }

    /// @notice Reduce `howMany` batches of 64 tokens each into single-check survivors
    ///         and collect their token IDs into an array. Each batch yields one id.
    function _build64SingleChecks() internal returns (uint256[] memory) {
        uint256 total = 64 * 64; // 4096 tokens
        _mint(alice, total);
        vm.startPrank(alice);
        uint256[] memory singles = new uint256[](64);
        for (uint256 i = 0; i < 64; ++i) {
            uint256 startId = 1 + i * 64;
            _reduce64To1(startId);
            singles[i] = startId;
        }
        vm.stopPrank();
        return singles;
    }

    function test_Infinity_ReducesTo1MegaDot() public {
        uint256[] memory singles = _build64SingleChecks();
        assertEq(dots.totalSupply(), 64, "64 single dots should remain");

        vm.prank(alice);
        dots.infinity(singles);

        assertEq(dots.totalSupply(), 1, "only the keeper should remain");
        IDots.Dot memory k = dots.getDot(singles[0]);
        assertEq(k.divisorIndex, 7, "keeper advanced to Mega Dot");
        assertEq(k.isMega, 1, "isMega flag set");
    }

    function test_Infinity_EmitsEvents() public {
        uint256[] memory singles = _build64SingleChecks();

        vm.expectEmit(true, false, false, false);
        emit IDots.Infinity(singles[0], singles);
        vm.expectEmit(false, false, false, true);
        emit IDots.MetadataUpdate(singles[0]);

        vm.prank(alice);
        dots.infinity(singles);
    }

    function test_Infinity_RevertIfWrongCount() public {
        _mint(alice, 64);
        uint256[] memory ids = new uint256[](10);
        for (uint256 i = 0; i < 10; ++i) ids[i] = i + 1;

        vm.prank(alice);
        vm.expectRevert(IDots.MegaDotRequires64.selector);
        dots.infinity(ids);
    }

    function test_Infinity_RevertIfNotSingleDots() public {
        // 64 freshly-minted tokens are at divisor 0, not 6 — should revert.
        _mint(alice, 64);
        uint256[] memory ids = new uint256[](64);
        for (uint256 i = 0; i < 64; ++i) ids[i] = i + 1;

        vm.prank(alice);
        vm.expectRevert(IDots.NotSingleDot.selector);
        dots.infinity(ids);
    }

    function test_Infinity_CirculationFlip() public {
        uint256[] memory singles = _build64SingleChecks();
        uint256[8] memory before = dots.circulation();
        assertEq(before[6], 64, "64 single dots before infinity");
        assertEq(before[7], 0, "no mega dot yet");

        vm.prank(alice);
        dots.infinity(singles);

        uint256[8] memory afterCall = dots.circulation();
        assertEq(afterCall[6], 0, "all single dots consumed");
        assertEq(afterCall[7], 1, "one mega dot minted");
    }

    /// @notice Passing the same id twice in the burned-partner slots must
    ///         revert with SameToken() up-front, not with a confusing
    ///         ERC721NonexistentToken() from the second _burn.
    function test_Infinity_RevertIfDuplicateBurnedPartner() public {
        uint256[] memory singles = _build64SingleChecks();
        // Swap slot 5 with slot 3's value so index 3 and index 5 share the
        // same tokenId — index 0 (keeper) stays distinct.
        singles[5] = singles[3];

        vm.prank(alice);
        vm.expectRevert(IDots.SameToken.selector);
        dots.infinity(singles);
    }

    /// @notice Forging two Mega Dots back-to-back should leave the
    ///         circulation array internally consistent: level 6 drops by
    ///         128, level 7 gains 2, and the sum across all buckets equals
    ///         totalSupply. Guards against a future regression in the
    ///         `unchecked` bookkeeping block inside infinity().
    function test_Infinity_TwoMegaDotsCirculationStable() public {
        // Build 128 single dots by reducing 128 groups of 64 freshly-minted
        // tokens down to one survivor each.
        uint256 total = 128 * 64;
        _mint(alice, total);
        vm.startPrank(alice);
        uint256[] memory singlesA = new uint256[](64);
        uint256[] memory singlesB = new uint256[](64);
        for (uint256 i = 0; i < 128; ++i) {
            uint256 startId = 1 + i * 64;
            _reduce64To1(startId);
            if (i < 64) singlesA[i] = startId;
            else        singlesB[i - 64] = startId;
        }
        assertEq(dots.totalSupply(), 128, "128 single dots before infinities");

        dots.infinity(singlesA);
        dots.infinity(singlesB);
        vm.stopPrank();

        assertEq(dots.totalSupply(), 2, "two Mega Dots remain");
        uint256[8] memory c = dots.circulation();
        assertEq(c[6], 0, "all single dots consumed");
        assertEq(c[7], 2, "two Mega Dots minted");
        // All other buckets should be empty and the total across buckets
        // must match totalSupply. Catches underflow / overflow regressions
        // in the unchecked block.
        uint256 sum;
        for (uint256 i = 0; i < 8; ++i) sum += c[i];
        assertEq(sum, dots.totalSupply(), "circulation sums to totalSupply");
    }
}
