import {
  ACCELERATED_SWAP_COPIES,
  type SwapTrade,
  type SupabaseAcceleratedSwapRow,
} from "./SwapTrade.js";

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

export interface SwapAcceleratedEvent extends Omit<SwapEvent, "type"> {
  type: "swap-accelerated";
  nonce: number;
}

export function toAcceleratedSwapEvents(event: SwapEvent): SwapAcceleratedEvent[] {
  return Array.from({ length: ACCELERATED_SWAP_COPIES }, (_, index) => ({
    ...event,
    type: "swap-accelerated",
    nonce: index + 1,
    timestamp: event.timestamp,
    blockTimestamp: event.blockTimestamp,
  }));
}

export function fromAcceleratedSupabaseRow(
  row: SupabaseAcceleratedSwapRow & { id?: string; created_at?: string }
): SwapAcceleratedEvent {
  return {
    type: "swap-accelerated",
    chainId: row.chain_id,
    contractAddress: row.contract_address,
    eventName: "Swap",
    topic0: row.topic0,
    txHash: row.tx_hash,
    logIndex: row.log_index,
    blockNumber: row.block_number,
    blockTimestamp: row.block_timestamp,
    trader: row.trader,
    poolId: row.pool_id,
    sender: row.sender,
    amount0: row.amount0,
    amount1: row.amount1,
    sqrtPriceX96: row.sqrt_price_x96,
    liquidity: row.liquidity,
    tick: row.tick,
    fee: row.fee,
    timestamp: row.block_timestamp,
    nonce: row.nonce,
  };
}
