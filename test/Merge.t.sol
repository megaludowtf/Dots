// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Dots} from "../src/Dots.sol";
import {IDots} from "../src/interfaces/IDots.sol";

contract MergeTest is Test {
    Dots internal dots;
    address internal owner = address(0xABCD);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    uint256 internal constant PRICE = 0.001 ether;

    function setUp() public {
        vm.warp(1_000_000);
        dots = new Dots(owner, PRICE, uint64(block.timestamp), uint64(block.timestamp + 30 days));
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
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

    // -------- Single merge step --------

    function test_Merge_AdvancesDivisor() public {
        _mint(alice, 2);

        vm.prank(alice);
        dots.merge(1, 2, false);

        IDots.Dot memory c = dots.getDot(1);
        assertEq(c.divisorIndex, 1);
        assertEq(c.merged, 1);
        assertEq(c.merges[0], 2, "burn partner recorded");

        vm.expectRevert();
        dots.ownerOf(2);
    }

    function test_Merge_SeedStableByDefault() public {
        _mint(alice, 2);
        uint32 before = dots.getDot(1).seed;

        vm.prank(alice);
        dots.merge(1, 2, false);

        uint32 afterSeed = dots.getDot(1).seed;
        assertEq(before, afterSeed, "seed must remain stable without swap");
    }

    function test_Merge_SwapAdoptsBurnSeed() public {
        _mint(alice, 2);
        uint32 burnSeed = dots.getDot(2).seed;

        vm.prank(alice);
        dots.merge(1, 2, true);

        assertEq(dots.getDot(1).seed, burnSeed, "swap should adopt burn seed");
    }

    function test_Merge_EmitsMetadataUpdate() public {
        _mint(alice, 2);
        vm.expectEmit(true, true, false, true);
        emit IDots.Merged(1, 2, 1);
        vm.expectEmit(false, false, false, true);
        emit IDots.MetadataUpdate(1);
        vm.prank(alice);
        dots.merge(1, 2, false);
    }

    // -------- Guard rails --------

    function test_Merge_RevertIfDifferentDivisors() public {
        _mint(alice, 4);
        vm.prank(alice);
        dots.merge(1, 2, false);
        vm.expectRevert(IDots.DifferentDivisors.selector);
        vm.prank(alice);
        dots.merge(1, 3, false);
    }

    function test_Merge_RevertIfNotOwner() public {
        _mint(alice, 1);
        _mint(bob, 1);
        vm.prank(alice);
        vm.expectRevert(IDots.NotOwner.selector);
        dots.merge(1, 2, false);
    }

    function test_Merge_RevertIfSameToken() public {
        _mint(alice, 1);
        vm.prank(alice);
        vm.expectRevert(IDots.SameToken.selector);
        dots.merge(1, 1, false);
    }

    function test_Merge_CannotMixAdvancedWithFresh() public {
        _mint(alice, 2);
        vm.prank(alice);
        dots.merge(1, 2, false);
        _mint(alice, 1);
        vm.prank(alice);
        vm.expectRevert(IDots.DifferentDivisors.selector);
        dots.merge(1, 3, false);
    }

    // -------- Full ladder --------

    /// @dev Reduce 64 contiguous tokens starting at `startId` into a single d=6 token at `startId`.
    function _reduce64To1(uint256 startId) internal {
        for (uint256 i = 0; i < 32; ++i) dots.merge(startId + i * 2, startId + 1 + i * 2, false);
        for (uint256 i = 0; i < 16; ++i) dots.merge(startId + i * 4, startId + 2 + i * 4, false);
        for (uint256 i = 0; i < 8; ++i)  dots.merge(startId + i * 8, startId + 4 + i * 8, false);
        for (uint256 i = 0; i < 4; ++i)  dots.merge(startId + i * 16, startId + 8 + i * 16, false);
        dots.merge(startId, startId + 16, false);
        dots.merge(startId + 32, startId + 48, false);
        dots.merge(startId, startId + 32, false);
    }

    function test_Merge_FullLadderToMega() public {
        _mint(alice, 64);
        vm.startPrank(alice);
        _reduce64To1(1);
        vm.stopPrank();

        IDots.Dot memory mega = dots.getDot(1);
        assertEq(mega.divisorIndex, 6);
        assertEq(dots.totalSupply(), 1);
    }

    function test_Merge_RevertIfComposeAtMega() public {
        _mint(alice, 64);
        _mint(alice, 64);
        vm.startPrank(alice);
        _reduce64To1(1);
        _reduce64To1(65);

        vm.expectRevert(IDots.AlreadyMega.selector);
        dots.merge(1, 65, false);
        vm.stopPrank();
    }

    // -------- mergeMany --------

    function test_MergeMany() public {
        _mint(alice, 4);
        uint256[] memory survivors = new uint256[](2);
        uint256[] memory burns = new uint256[](2);
        survivors[0] = 1; burns[0] = 2;
        survivors[1] = 3; burns[1] = 4;

        vm.prank(alice);
        dots.mergeMany(survivors, burns);

        assertEq(dots.getDot(1).divisorIndex, 1);
        assertEq(dots.getDot(3).divisorIndex, 1);
        assertEq(dots.totalSupply(), 2);
    }

    function test_MergeMany_RevertOnMismatchedArrays() public {
        _mint(alice, 2);
        uint256[] memory survivors = new uint256[](2);
        uint256[] memory burns = new uint256[](1);

        vm.prank(alice);
        vm.expectRevert(IDots.ArrayLengthMismatch.selector);
        dots.mergeMany(survivors, burns);
    }
}
