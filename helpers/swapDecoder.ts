import {
  decodeEventLog,
  getEventSelector,
  parseAbiItem,
  type Log,
  type TransactionReceipt,
} from "viem";
import { alchemyConfig } from "../config/alchemy.js";
import type { SwapTrade } from "../models/SwapTrade.js";

const swapEvent = parseAbiItem(
  "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)"
);

const swapEventTopic = getEventSelector(swapEvent);

export function decodeSwapLogs(
  receipt: TransactionReceipt,
  trader: string,
  blockTimestamp: bigint
): SwapTrade[] {
  const poolManager = alchemyConfig.poolManager.toLowerCase();
  const trades: SwapTrade[] = [];

  for (const log of receipt.logs) {
    if (!isPoolManagerSwapLog(log, poolManager)) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: [swapEvent],
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName !== "Swap") {
        continue;
      }

      const topic0 = log.topics[0];
      if (!topic0) {
        continue;
      }

      trades.push({
        chainId: alchemyConfig.chainId,
        contractAddress: log.address,
        eventName: "Swap",
        topic0,
        txHash: receipt.transactionHash,
        logIndex: Number(log.logIndex),
        blockNumber: receipt.blockNumber,
        blockTimestamp,
        trader,
        poolId: decoded.args.id,
        sender: decoded.args.sender,
        amount0: decoded.args.amount0.toString(),
        amount1: decoded.args.amount1.toString(),
        sqrtPriceX96: decoded.args.sqrtPriceX96.toString(),
        liquidity: decoded.args.liquidity.toString(),
        tick: Number(decoded.args.tick),
        fee: Number(decoded.args.fee),
      });
    } catch {
      continue;
    }
  }

  return trades;
}

function isPoolManagerSwapLog(log: Log, poolManager: string): boolean {
  return (
    log.address.toLowerCase() === poolManager &&
    log.topics[0]?.toLowerCase() === swapEventTopic.toLowerCase()
  );
}
