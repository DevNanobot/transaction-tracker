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
| `KAFKA_BROKERS` | Optional — comma-separated brokers. Omit to run without Kafka. Use `localhost:9092,localhost:9094,localhost:9096` with the local Docker cluster. |
| `PORT` | HTTP port (default: `3000`) |

4. Run the Supabase migration — paste [`scripts/migrateSupabase.sql`](scripts/migrateSupabase.sql) into the Supabase SQL editor.

   If `swaps` already exists, run only the additive load-test table: [`scripts/migrateSupabaseAccelerated.sql`](scripts/migrateSupabaseAccelerated.sql). Do **not** re-run the full migration (it drops `swaps`).

5. *(Optional)* Start local Kafka and create the topic:

```bash
npm run kafka:setup
```

This starts three Kafka brokers via [`docker-compose.yml`](docker-compose.yml) (`localhost:9092`, `9094`, `9096`), each a controller voter, and creates `swap` and `swap-accelerated` with RF=3.

The first time you switch to this 3-voter quorum, Kafka disks must be recreated (old single-voter metadata cannot elect a replacement for `kafka1`). This deletes **Kafka volumes only**, not Supabase:

```bash
npm run kafka:reset
npm run kafka:setup
```

### Kafka commands

| Command | Description |
|---------|-------------|
| `npm run kafka:up` | Start all three brokers, Kafka UI, and wait until broker healthchecks pass |
| `npm run kafka:down` | Stop brokers and UI (keeps volumes) |
| `npm run kafka:reset` | Stop brokers and **delete** Kafka volumes |
| `npm run kafka:logs` | Tail logs from `kafka1`, `kafka2`, and `kafka3` |
| `npm run create-topic` | Create `swap` and `swap-accelerated` with 2 partitions and RF=3 |
| `npm run kafka:describe` | Show partition leaders and replicas for `swap` and `swap-accelerated` |

## Run

```bash
npm run dev    # development with hot reload
npm start      # production
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

Local Docker Compose runs **three brokers**, each **broker + controller** (voters 1, 2, 3), and [Kafbat UI](https://github.com/kafbat/kafka-ui):

- `kafka1` — `localhost:9092`
- `kafka2` — `localhost:9094`
- `kafka3` — `localhost:9096`
- `kafka-ui` — web UI at [http://localhost:8080](http://localhost:8080)

Majority is **2 of 3**. Stopping any **one** broker (including `kafka1`) lets the other two elect a controller and move partition leaders. `swap` is RF=3 with `min.insync.replicas=2`, so writes continue with one broker down. Stopping two brokers loses quorum.

Confirm replica placement:

```bash
npm run kafka:describe
```

Expect replicas `1,2,3` and one leader per partition. If `kafka1` is the node you stopped, describe from another broker:

```bash
docker compose exec kafka2 kafka-topics --bootstrap-server localhost:9092 --describe --topic swap
```

Or open **http://localhost:8080** after `npm run kafka:up`. Use **Brokers** to see which node is controller and how partitions are assigned, **Topics → swap** for partition leaders/replicas, **Consumer Groups** for lag, and **Messages** to browse events by partition.

Every live swap is published to topic `swap`. Then **10 separate produce calls** push the same payload to `swap-accelerated` (nonce 1 then 2 … 10, identical timestamps, keys `${txHash}-${logIndex}-${nonce}`). They are not batched into one Kafka request:

| Event type | Stored in Supabase | Kafka topic | SSE |
|------------|-------------------|-------------|-----|
| `swap` | `swaps` | `swap` | Yes |
| `swap-accelerated` | `swaps_accelerated` | `swap-accelerated` | Yes |

Read live from Kafka in a second terminal (`swap` only):

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
