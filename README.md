# Uniswap Trade Tracker

Track Uniswap V4 swaps on Robinhood Chain via Alchemy WebSocket, persist trades to Supabase, and publish events to Kafka.

## Architecture

```
server.ts              ← boots HTTP server + Alchemy WebSocket listener
config/                ← env validation, Alchemy, Supabase, Kafka settings
controllers/           ← trade pipeline, health checks
models/                ← SwapTrade interface + DB/Kafka mappers
helpers/               ← websocket, decoder, supabase, kafka, logger
routes/                ← /health, /trades, /tradesAccelerated
scripts/               ← Supabase migration, Kafka topic setup
```

## Data flow

1. Alchemy WebSocket subscribes to mined transactions sent to the Universal Router
2. Transactions are filtered for Universal Router `execute` (`0x3593564c` or `0x24856bc3`)
3. V4 `Swap` logs from the PoolManager are decoded
4. Each swap is published to Kafka topic `swap` and written to Supabase in batches of 10.
5. The same swap is also published as **10 separate Kafka events** on `swap-accelerated` (one produce per nonce 1–10, same timestamps) and stored in `swaps_accelerated`.

## Prerequisites

- Node.js 18+
- Docker Desktop (for local Kafka)
- Alchemy API key with Base mainnet access
- Supabase project

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

3. Fill in `.env`:

| Variable | Description |
|----------|-------------|
| `ALCHEMY_KEY` | Alchemy API key |
| `UNIVERSAL_ROUTER` | Universal Router on Robinhood Chain (`0x8876789976dEcBfCbBbe364623C63652db8C0904`) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Supabase **secret** key (`sb_secret_...`) for server-side writes |
| `KAFKA_BROKERS` | Optional — use `localhost:9092` with local Docker (single broker). Omit to run without Kafka. |

Production on Hetzner: see **[docs/DEPLOY.md](docs/DEPLOY.md)**.
| `PORT` | HTTP port (default: `3000`) |

4. Run the Supabase migration — paste [`scripts/migrateSupabase.sql`](scripts/migrateSupabase.sql) into the Supabase SQL editor.

   If `swaps` already exists, run only the additive load-test table: [`scripts/migrateSupabaseAccelerated.sql`](scripts/migrateSupabaseAccelerated.sql). Do **not** re-run the full migration (it drops `swaps`).

5. *(Optional)* Start local Kafka and create topics:

```bash
npm run kafka:setup
```

Single `confluentinc/cp-kafka` broker on `localhost:9092` (RF=1). Optional UI: `npm run kafka:ui` → http://127.0.0.1:8080

### Kafka commands

| Command | Description |
|---------|-------------|
| `npm run kafka:up` | Start Kafka broker |
| `npm run kafka:down` | Stop Kafka |
| `npm run kafka:reset` | Stop and **delete** Kafka volume |
| `npm run kafka:setup` | Start broker + create `swap` / `swap-accelerated` topics |
| `npm run kafka:describe` | Show partition layout |
| `npm run prod:up` | **Production** — build app + Kafka on Hetzner (`docker-compose.prod.yml`) |

## Run

```bash
npm run dev          # development with hot reload
npm run build && npm start   # local production build
npm run prod:up      # Docker production stack (see docs/DEPLOY.md)
```

## API

### `GET /health`

Returns service connectivity status.

### `GET /trades?limit=50&offset=0`

Paginated list of **swap** trades from Supabase:

```json
{
  "trades": [{ "type": "swap", "txHash": "0x...", ... }],
  "total": 120,
  "limit": 50,
  "offset": 0
}
```

### `GET /tradesAccelerated?limit=50&offset=0`

Paginated load-test copies from `swaps_accelerated`. Each live swap produces **10** rows with the same `blockTimestamp` / Kafka `timestamp` and `nonce` `1`–`10`:

```json
{
  "trades": [{ "type": "swap-accelerated", "txHash": "0x...", "nonce": 1, ... }],
  "total": 1200,
  "limit": 50,
  "offset": 0
}
```

The live `/trades` path is unchanged (one event per swap).

### `GET /trades/stream` (SSE)

Real-time stream of **swap** and **swap-accelerated** events (the 10 copies are pushed one after another as they are produced):

```javascript
const source = new EventSource("http://localhost:3000/trades/stream");
source.onmessage = (event) => {
  const trade = JSON.parse(event.data);
  console.log(trade.type, trade); // "execute" | "swap"
};
```

## Kafka

Local Docker runs **one broker** (`localhost:9092`, RF=1). Production uses the same single-broker layout to save RAM on Hetzner — see [docs/DEPLOY.md](docs/DEPLOY.md).

Topics: `swap`, `swap-accelerated` (2 partitions each).

Read live from Kafka:

```bash
npm run kafka:consume
```

## Tracked contracts

| Contract | Address |
|----------|---------|
| Universal Router | `0x8876789976dEcBfCbBbe364623C63652db8C0904` |
| V4 PoolManager | `0x8366a39CC670B4001A1121B8F6A443A643e40951` |

## Notes

- Only Uniswap **V4** Swap events are tracked (bytes32 pool id + uint24 fee)
- V3 swaps through the same Universal Router `execute()` call are not captured
- WebSocket runs locally — no public URL required
- **Kafka is optional** — leave `KAFKA_BROKERS` unset to run with Supabase only. If set but unreachable, the app logs a warning and continues.
- With Kafka enabled, live swaps go to Kafka immediately and to Supabase in batches of **10**. Each swap also writes 10 `swap-accelerated` copies (Kafka immediately, Supabase in the same batch). On Ctrl+C leftover batches are flushed.
