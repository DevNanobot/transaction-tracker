import type { Request, Response } from "express";
import { isKafkaConfigured } from "../config/kafka.js";
import { pingSupabase } from "../helpers/supabaseClient.js";
import { isKafkaConnected } from "../helpers/kafkaProducer.js";
import type { AlchemyWebSocket } from "../helpers/alchemyWebSocket.js";

export function createHealthController(alchemyWs: AlchemyWebSocket) {
  return {
    async getHealth(_req: Request, res: Response): Promise<void> {
      const supabase = await pingSupabase();
      const kafka = isKafkaConfigured ? isKafkaConnected() : "disabled";
      const ok =
        supabase &&
        alchemyWs.isConnected() &&
        (!isKafkaConfigured || isKafkaConnected());

      res.json({
        status: ok ? "ok" : "degraded",
        services: {
          alchemy: alchemyWs.isConnected(),
          supabase,
          kafka,
        },
        timestamp: new Date().toISOString(),
      });
    },
  };
}
