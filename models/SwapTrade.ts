export interface SwapTrade {
  chainId: number;
  contractAddress: string;
  eventName: "Swap";
  topic0: string;
  txHash: string;
  logIndex: number;
  blockNumber: bigint;
  blockTimestamp: bigint;
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
  chain_id: number;
  contract_address: string;
  event_name: string;
  topic0: string;
  tx_hash: string;
  log_index: number;
  block_number: string;
  block_timestamp: string;
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

function toIsoTimestamp(unixSeconds: bigint): string {
  return new Date(Number(unixSeconds) * 1000).toISOString();
}

export function toSupabaseRow(trade: SwapTrade): SupabaseSwapRow {
  return {
    chain_id: trade.chainId,
    contract_address: trade.contractAddress,
    event_name: trade.eventName,
    topic0: trade.topic0,
    tx_hash: trade.txHash,
    log_index: trade.logIndex,
    block_number: trade.blockNumber.toString(),
    block_timestamp: toIsoTimestamp(trade.blockTimestamp),
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

export function fromSupabaseRow(
  row: SupabaseSwapRow & { id?: string; created_at?: string }
): SwapTrade {
  return {
    chainId: row.chain_id,
    contractAddress: row.contract_address,
    eventName: "Swap",
    topic0: row.topic0,
    txHash: row.tx_hash,
    logIndex: row.log_index,
    blockNumber: BigInt(row.block_number),
    blockTimestamp: BigInt(Math.floor(new Date(row.block_timestamp).getTime() / 1000)),
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
