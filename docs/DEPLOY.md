# Deploy to Hetzner (single VPS)

One **Confluent Kafka broker** + **Node app** on the same machine. Kafka is **not** exposed publicly; the API binds to localhost and should sit behind a reverse proxy.

## Requirements

- Hetzner Cloud VPS (2 GB RAM minimum recommended; Kafka heap capped at 512 MB)
- Docker + Docker Compose v2
- Supabase project with migrations applied:
  - [`scripts/migrateSupabase.sql`](../scripts/migrateSupabase.sql)
  - [`scripts/migrateSupabaseAccelerated.sql`](../scripts/migrateSupabaseAccelerated.sql) (if using accelerated swaps)

## 1. Server setup

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
# log out and back in
```

## 2. Clone and configure

```bash
git clone <your-repo> transaction-tracker
cd transaction-tracker
cp .env.production.example .env
nano .env
```

Required in `.env`:

| Variable | Production value |
|----------|------------------|
| `NODE_ENV` | `production` |
| `ALCHEMY_KEY` | Alchemy key |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | Supabase credentials |
| `API_KEY` | Long random secret (required) |
| `CORS_ORIGIN` | Your frontend URL, e.g. `https://app.example.com` |
| `PORT` | `3000` |

Do **not** set `KAFKA_BROKERS` in `.env` — `docker-compose.prod.yml` sets `kafka:29092` for the app container.

## 3. Start production stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This starts:

- **kafka** — single `confluentinc/cp-kafka:8.3.1` broker, RF=1, 168h log retention
- **app** — compiled Node.js, topics auto-created on boot, API on `127.0.0.1:3000`

Check logs:

```bash
npm run prod:logs
curl -s http://127.0.0.1:3000/health | jq
```

## 4. Reverse proxy (Caddy example)

Install Caddy on the host and proxy to the app:

```
api.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

Frontend calls:

- `GET https://api.example.com/health`
- `GET https://api.example.com/trades?limit=50` with header `X-API-Key: <API_KEY>`
- `GET https://api.example.com/trades/stream?apiKey=<API_KEY>` (SSE)

## 5. Updates

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Single-broker trade-offs

| | Single broker (this setup) | 3-broker cluster |
|--|---------------------------|------------------|
| RAM / disk | ~512 MB–1 GB for Kafka | 3× cost |
| HA | Broker down = Kafka down | Survives 1 node loss |
| Replication | RF=1 (no copy) | RF=3 |

Acceptable for a cost-conscious Hetzner deployment; Supabase remains the durable store for swaps.

## Local development

```bash
cp .env.example .env
npm run kafka:setup    # single broker on localhost:9092
npm run dev
```

Optional Kafka UI (local only):

```bash
npm run kafka:ui       # http://127.0.0.1:8080
```

## Useful commands

```bash
npm run prod:up        # start production stack
npm run prod:down      # stop production stack
npm run kafka:reset    # wipe local Kafka volume (dev only)
npm run kafka:describe # partition layout
```
