import type { SwapTrade } from "./SwapTrade.js";
import { toKafkaMessage as toSwapKafkaMessage } from "./SwapTrade.js";

export interface ExecuteEvent {
  type: "execute";
  txHash: string;
  from: string;
  to: string;
  blockNumber: string;
  inputLength: number;
  timestamp: string;
}

export interface SwapEvent {
  type: "swap";
  txHash: string;
  logIndex: number;
  blockNumber: string;
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

export type TradeEvent = ExecuteEvent | SwapEvent;

export function toExecuteEvent(input: {
  txHash: string;
  from: string;
  to: string;
  blockNumber: bigint;
  inputLength: number;
}): ExecuteEvent {
  return {
    type: "execute",
    txHash: input.txHash,
    from: input.from,
    to: input.to,
    blockNumber: input.blockNumber.toString(),
    inputLength: input.inputLength,
    timestamp: new Date().toISOString(),
  };
}

export function toSwapEvent(trade: SwapTrade): SwapEvent {
  const message = toSwapKafkaMessage(trade);
  return {
    type: "swap",
    txHash: message.txHash as string,
    logIndex: message.logIndex as number,
    blockNumber: message.blockNumber as string,
    trader: message.trader as string,
    poolId: message.poolId as string,
    sender: message.sender as string,
    amount0: message.amount0 as string,
    amount1: message.amount1 as string,
    sqrtPriceX96: message.sqrtPriceX96 as string,
    liquidity: message.liquidity as string,
    tick: message.tick as number,
    fee: message.fee as number,
    timestamp: message.timestamp as string,
  };
}

export function serializeSwapForApi(trade: SwapTrade): SwapEvent {
  return toSwapEvent(trade);
}
