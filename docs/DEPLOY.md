# Deploy to Hetzner (single VPS)

One **Confluent Kafka broker** + **Node app** on the same machine. Kafka is **not** exposed publicly; the API binds to localhost and should sit behind a reverse proxy.

## Requirements

- Hetzner Cloud VPS (2 GB RAM minimum recommended; Kafka heap capped at 512 MB)
- Docker + Docker Compose v2
- Supabase project with `scripts/migrateSupabase.sql` applied

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
| `CORS_ORIGIN` | Your frontend URL, e.g. `https://api.example.com` |
| `PORT` | `3000` |

Do **not** set `KAFKA_BROKERS` in `.env`. `docker-compose.prod.yml` sets `kafka:29092` for the app container.

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

You should see the app listening in the logs. If `curl` fails, check `CORS_ORIGIN` / Supabase errors.

## 4. Reverse proxy (Caddy) for `api.YOURDOMAIN.com`

DNS: cPanel **Zone Editor** → A record `api` → droplet IPv4. Check with `nslookup api.YOURDOMAIN.com` (must return the Hetzner IP).

Open **80** and **443** in `ufw` and in the Hetzner Cloud Firewall (Let's Encrypt needs both).

```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw reload

apt install -y caddy   # skip if already installed

cat > /etc/caddy/Caddyfile <<'EOF'
api.YOURDOMAIN.com {
	encode gzip
	reverse_proxy 127.0.0.1:3000 {
		flush_interval -1
	}
}
EOF

# edit YOURDOMAIN.com to the real domain, then:
caddy validate --config /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy
curl -sSI https://api.YOURDOMAIN.com/
curl -sS https://api.YOURDOMAIN.com/health
```

Caddy will get a Let's Encrypt certificate automatically. In the app `.env` set:

```
CORS_ORIGIN=https://api.YOURDOMAIN.com
```

Then recreate the app container so it picks up CORS:

```bash
docker compose -f docker-compose.prod.yml up -d
```

After HTTPS works, you can close public **3000** in the Hetzner firewall (Caddy talks to `127.0.0.1:3000` on the box).

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

Acceptable on a small VPS. Swaps still land in Supabase if Kafka is down.

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
