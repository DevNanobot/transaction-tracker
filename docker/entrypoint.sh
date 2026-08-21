#!/bin/sh
set -e

if [ -n "$KAFKA_BROKERS" ]; then
  echo "Ensuring Kafka topics exist..."
  node dist/scripts/createKafkaTopic.js || {
    echo "Warning: topic setup failed; app will still start."
  }
fi

exec node dist/server.js
