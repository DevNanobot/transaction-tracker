import type { Request, Response } from "express";
import { pingSupabase } from "../helpers/supabaseClient.js";
import { isKafkaConfigured, isKafkaConnected } from "../helpers/kafkaProducer.js";
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
        timestamp: new Date().toISOString(),
      });
    },
  };
}
