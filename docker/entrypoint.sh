#!/bin/sh
set -eu

echo "Starting transaction-tracker..."

if [ -n "${KAFKA_BROKERS:-}" ]; then
  echo "Ensuring Kafka topics exist..."
  if ! node dist/scripts/createKafkaTopic.js; then
    echo "Warning: topic setup failed; app will still start."
  fi
fi

echo "Starting Node server..."
exec node dist/server.js
