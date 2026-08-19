DROP TABLE IF EXISTS swaps CASCADE;

CREATE TABLE swaps (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id         INT NOT NULL,
  contract_address TEXT NOT NULL,
  event_name       TEXT NOT NULL,
  topic0           TEXT NOT NULL,
  tx_hash          TEXT NOT NULL,
  log_index        INT NOT NULL,
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
  UNIQUE (tx_hash, log_index)
);

CREATE INDEX idx_swaps_block ON swaps (block_number DESC);
CREATE INDEX idx_swaps_pool ON swaps (pool_id);
CREATE INDEX idx_swaps_trader ON swaps (trader);

ALTER TABLE swaps ENABLE ROW LEVEL SECURITY;

-- No policies on purpose: anon/authenticated cannot read or write via PostgREST.
-- This app uses the Supabase secret key, which bypasses RLS.
