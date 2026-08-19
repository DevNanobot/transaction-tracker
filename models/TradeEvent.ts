import type { SwapTrade } from "./SwapTrade.js";

export interface SwapEvent {
  type: "swap";
  chainId: number;
  contractAddress: string;
  eventName: "Swap";
  topic0: string;
  txHash: string;
  logIndex: number;
  blockNumber: string;
  blockTimestamp: string;
  trader: string;
  poolId: string;
  sender: string;
  amount0: string;
  amount1: string;
  sqrtPriceX96: string;
  liquidity: string;
  tick: number;
  fee: number;
  timestamp: string;
}

export function toSwapEvent(trade: SwapTrade): SwapEvent {
  const blockTimestamp = new Date(Number(trade.blockTimestamp) * 1000).toISOString();

  return {
    type: "swap",
    chainId: trade.chainId,
    contractAddress: trade.contractAddress,
    eventName: trade.eventName,
    topic0: trade.topic0,
    txHash: trade.txHash,
    logIndex: trade.logIndex,
    blockNumber: trade.blockNumber.toString(),
    blockTimestamp,
    trader: trade.trader,
    poolId: trade.poolId,
    sender: trade.sender,
    amount0: trade.amount0,
    amount1: trade.amount1,
    sqrtPriceX96: trade.sqrtPriceX96,
    liquidity: trade.liquidity,
    tick: trade.tick,
    fee: trade.fee,
    timestamp: new Date().toISOString(),
  };
}
