import type { Request, Response } from "express";
import { isKafkaConfigured } from "../config/kafka.js";
import { pingSupabase } from "../helpers/supabaseClient.js";
import { isKafkaConnected } from "../helpers/kafkaProducer.js";
import type { AlchemyWebSocket } from "../helpers/alchemyWebSocket.js";

export function createHealthController(alchemyWs: AlchemyWebSocket) {
  return {
    async getHealth(_req: Request, res: Response): Promise<void> {
      const supabaseOk = await pingSupabase();

      const kafkaStatus = isKafkaConfigured
        ? isKafkaConnected()
        : "disabled";

      const coreServicesOk = supabaseOk && alchemyWs.isConnected();
      const kafkaOk = !isKafkaConfigured || isKafkaConnected();

      res.json({
        status: coreServicesOk && kafkaOk ? "ok" : "degraded",
        services: {
          alchemyWebSocket: alchemyWs.isConnected(),
          supabase: supabaseOk,
          kafka: kafkaStatus,
        },
        kafka: isKafkaConfigured
          ? { configured: true, connected: isKafkaConnected() }
          : {
              configured: false,
              reason:
                "KAFKA_BROKERS is empty in this process. Docker Kafka running is not enough — the API must be started with docker-compose.prod.yml (sets kafka:29092) or KAFKA_BROKERS=localhost:9092 if you run npm on the host.",
            },
        timestamp: new Date().toISOString(),
      });
    },
  };
}
