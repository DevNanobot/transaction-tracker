-- Additive load-test table. Safe to run on an existing swaps database.
-- Does not drop or alter the live `swaps` table.

CREATE TABLE IF NOT EXISTS swaps_accelerated (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id         INT NOT NULL,
  contract_address TEXT NOT NULL,
  event_name       TEXT NOT NULL,
  topic0           TEXT NOT NULL,
  tx_hash          TEXT NOT NULL,
  log_index        INT NOT NULL,
  nonce            INT NOT NULL CHECK (nonce BETWEEN 1 AND 10),
  block_number     BIGINT NOT NULL,
  block_timestamp  TIMESTAMPTZ NOT NULL,
  trader           TEXT NOT NULL,
  pool_id          TEXT NOT NULL,
  sender           TEXT NOT NULL,
  amount0          TEXT NOT NULL,
  amount1          TEXT NOT NULL,
  sqrt_price_x96   TEXT NOT NULL,
  liquidity        TEXT NOT NULL,
  tick             INT NOT NULL,
  fee              INT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tx_hash, log_index, nonce)
);

CREATE INDEX IF NOT EXISTS idx_swaps_accelerated_block
  ON swaps_accelerated (block_number DESC);

CREATE INDEX IF NOT EXISTS idx_swaps_accelerated_pool
  ON swaps_accelerated (pool_id);

CREATE INDEX IF NOT EXISTS idx_swaps_accelerated_trader
  ON swaps_accelerated (trader);

ALTER TABLE swaps_accelerated ENABLE ROW LEVEL SECURITY;
