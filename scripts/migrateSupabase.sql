CREATE TABLE IF NOT EXISTS swaps (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash        TEXT NOT NULL,
  log_index      INT  NOT NULL,
  block_number   BIGINT NOT NULL,
  trader         TEXT NOT NULL,
  pool_id        TEXT NOT NULL,
  sender         TEXT NOT NULL,
  amount0        TEXT NOT NULL,
  amount1        TEXT NOT NULL,
  sqrt_price_x96 TEXT NOT NULL,
  liquidity      TEXT NOT NULL,
  tick           INT  NOT NULL,
  fee            INT  NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_swaps_block ON swaps (block_number DESC);
