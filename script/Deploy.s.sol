// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Dots} from "../src/Dots.sol";

/// @notice Deploys Dots to MegaETH (testnet or mainnet).
/// @dev    Testnet:
///             forge script script/Deploy.s.sol:Deploy \
///                 --rpc-url $MEGAETH_RPC_URL \
///                 --broadcast \
///                 --private-key $PRIVATE_KEY
///         Mainnet:
///             forge script script/Deploy.s.sol:Deploy \
///                 --rpc-url $MEGAETH_MAINNET_RPC_URL \
///                 --broadcast \
///                 --private-key $PRIVATE_KEY \
///                 --verify
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        uint256 mintPrice = _envOr("MINT_PRICE_WEI", 0.0001 ether);
        uint64 mintStart = uint64(_envOr("MINT_START", block.timestamp));
        uint64 mintEnd = uint64(_envOr("MINT_END", block.timestamp + 7 days));

        console2.log("deployer:", deployer);
        console2.log("mint price (wei):", mintPrice);
        console2.log("mint start:", mintStart);
        console2.log("mint end:", mintEnd);

        vm.startBroadcast(pk);
        Dots dots = new Dots(deployer, mintPrice, mintStart, mintEnd);
        vm.stopBroadcast();

        console2.log("Dots deployed at:", address(dots));
    }

    function _envOr(string memory key, uint256 fallbackValue) internal view returns (uint256) {
        try vm.envUint(key) returns (uint256 v) {
            if (v == 0) return fallbackValue;
            return v;
        } catch {
            return fallbackValue;
        }
    }
}
