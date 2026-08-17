export interface SwapTrade {
  txHash: string;
  logIndex: number;
  blockNumber: bigint;
  trader: string;
  poolId: string;
  sender: string;
  amount0: string;
  amount1: string;
  sqrtPriceX96: string;
  liquidity: string;
  tick: number;
  fee: number;
}

export interface SupabaseSwapRow {
  tx_hash: string;
  log_index: number;
  block_number: string;
  trader: string;
  pool_id: string;
  sender: string;
  amount0: string;
  amount1: string;
  sqrt_price_x96: string;
  liquidity: string;
  tick: number;
  fee: number;
}

export function toSupabaseRow(trade: SwapTrade): SupabaseSwapRow {
  return {
    tx_hash: trade.txHash,
    log_index: trade.logIndex,
    block_number: trade.blockNumber.toString(),
    trader: trade.trader,
    pool_id: trade.poolId,
    sender: trade.sender,
    amount0: trade.amount0,
    amount1: trade.amount1,
    sqrt_price_x96: trade.sqrtPriceX96,
    liquidity: trade.liquidity,
    tick: trade.tick,
    fee: trade.fee,
  };
}

export function toKafkaMessage(trade: SwapTrade): Record<string, unknown> {
  return {
    txHash: trade.txHash,
    logIndex: trade.logIndex,
    blockNumber: trade.blockNumber.toString(),
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

export function fromSupabaseRow(row: SupabaseSwapRow & { id?: string; created_at?: string }): SwapTrade {
  return {
    txHash: row.tx_hash,
    logIndex: row.log_index,
    blockNumber: BigInt(row.block_number),
    trader: row.trader,
    poolId: row.pool_id,
    sender: row.sender,
    amount0: row.amount0,
    amount1: row.amount1,
    sqrtPriceX96: row.sqrt_price_x96,
    liquidity: row.liquidity,
    tick: row.tick,
    fee: row.fee,
  };
}
