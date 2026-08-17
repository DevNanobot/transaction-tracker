# Uniswap Trade Tracker

Track Uniswap V4 swaps on Base chain via Alchemy WebSocket, persist trades to Supabase, and publish events to Kafka.

## Architecture

```
server.ts              ← boots HTTP server + Alchemy WebSocket listener
config/                ← env validation, Alchemy, Supabase, Kafka settings
controllers/           ← trade pipeline, health checks
models/                ← SwapTrade interface + DB/Kafka mappers
helpers/               ← websocket, decoder, supabase, kafka, logger
routes/                ← /health, /trades
scripts/               ← Supabase migration, Kafka topic setup
```

## Data flow

1. Alchemy WebSocket subscribes to mined transactions sent to the Universal Router
2. Transactions are filtered for `execute(bytes,bytes[],uint256)` (`0x3593564c`)
3. V4 `Swap` logs from the PoolManager are decoded
4. Each swap is upserted into Supabase and published to Kafka

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
| `UNIVERSAL_ROUTER` | Universal Router on Base (`0x6fF5693b99212Da76ad316178A184AB56D299b43`) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Supabase **secret** key (`sb_secret_...`) for server-side writes |
| `KAFKA_BROKERS` | Optional — comma-separated brokers. Omit to run without Kafka. Use `localhost:9092` with Docker setup. |
| `KAFKA_TOPIC` | Kafka topic (default: `base.uniswap.v4.swaps`) |
| `PORT` | HTTP port (default: `3000`) |

4. Run the Supabase migration — paste [`scripts/migrateSupabase.sql`](scripts/migrateSupabase.sql) into the Supabase SQL editor.

5. *(Optional)* Start local Kafka and create the topic:

```bash
npm run kafka:setup
```

This starts Kafka via [`docker-compose.yml`](docker-compose.yml) and creates the `base.uniswap.v4.swaps` topic. **Skip this step** if you are not using Kafka — the app runs with Supabase only when `KAFKA_BROKERS` is unset.

### Kafka commands

| Command | Description |
|---------|-------------|
| `npm run kafka:up` | Start Kafka container |
| `npm run kafka:down` | Stop Kafka container |
| `npm run kafka:logs` | Tail Kafka logs |
| `npm run create-topic` | Create topic (Kafka must already be running) |

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

### `GET /trades/stream` (SSE)

Real-time stream of **execute** and **swap** events for your frontend:

```javascript
const source = new EventSource("http://localhost:3000/trades/stream");
source.onmessage = (event) => {
  const trade = JSON.parse(event.data);
  console.log(trade.type, trade); // "execute" | "swap"
};
```

## Kafka

Every event is published to `KAFKA_TOPIC` (default `base.uniswap.v4.swaps`):

| Event type | Stored in Supabase | Kafka | SSE |
|------------|-------------------|-------|-----|
| `execute`  | No                | Yes   | Yes |
| `swap`     | Yes               | Yes   | Yes |

Read live from Kafka in a second terminal:

```bash
npm run kafka:consume
```

## Tracked contracts

| Contract | Address |
|----------|---------|
| Universal Router | `0x6fF5693b99212Da76ad316178A184AB56D299b43` |
| V4 PoolManager | `0x498581ff718922c3f8e6a244956af099b2652b2b` |

## Notes

- Only Uniswap **V4** Swap events are tracked (bytes32 pool id + uint24 fee)
- V3 swaps through the same Universal Router `execute()` call are not captured
- WebSocket runs locally — no public URL required
- **Kafka is optional** — leave `KAFKA_BROKERS` unset to run with Supabase only. If set but unreachable, the app logs a warning and continues.
