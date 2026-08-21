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

The API is only on **localhost:3000** (not the public IP). Compose always sets `PORT=3000` inside the container.

```bash
docker compose -f docker-compose.prod.yml logs app --tail=50
curl -sS http://127.0.0.1:3000/
curl -sS http://127.0.0.1:3000/health
```

You should see `App is live` in both the logs and the `/` HTML. If `curl` fails, the container is not listening — check logs for `API_KEY` / `CORS_ORIGIN` / Supabase boot errors.

## 4. Reverse proxy (Caddy)

Use [`deploy/Caddyfile`](../deploy/Caddyfile). Example for `api.example.com`:

```
api.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile   # set your real hostname
sudo systemctl reload caddy
```

Then open `https://api.example.com/` in the browser. Opening `http://DROPLET_IP:3000` from your laptop will **not** work: that port is bound to `127.0.0.1` only.

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
