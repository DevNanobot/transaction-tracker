# Uniswap Trade Tracker

Watches Uniswap V4 swaps on Robinhood Chain. Swaps go to Kafka (if configured), Supabase, and an SSE stream.

## Local setup

Node 18+, an Alchemy **Robinhood Chain** key (chain id 4663), and a Supabase project. Kafka is optional.

```powershell
npm install
copy .env.example .env
```

Fill in `ALCHEMY_KEY`, `SUPABASE_URL`, and `SUPABASE_SECRET_KEY`. Then run `scripts/migrateSupabase.sql` in the Supabase SQL editor.

```powershell
npm run dev
```

Defaults to `http://127.0.0.1:3000` (`HOST` / `PORT` in `.env`).

### Kafka

Local compose runs one broker on `localhost:9092`. Set `KAFKA_BROKERS=localhost:9092` and:

```powershell
npm run kafka:setup
```

If Kafka is down, the app still runs.

## API

- `GET /health`
- `GET /trades` (Supabase, Kafka fallback)
- `GET /tradesAccelerated` (10 Kafka copies per swap)
- `GET /trades/stream` (live SSE)

See [docs/DEPLOY.md](docs/DEPLOY.md) for Hetzner.

Tracked contracts: Universal Router `0x8876789976dEcBfCbBbe364623C63652db8C0904`, PoolManager `0x8366a39CC670B4001A1121B8F6A443A643e40951`. V3 swaps on the same router are ignored.
