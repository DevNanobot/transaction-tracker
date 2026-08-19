import express from "express";
import { env } from "./config/index.js";
import { AlchemyWebSocket } from "./helpers/alchemyWebSocket.js";
import {
  connectKafkaProducer,
  disconnectKafkaProducer,
} from "./helpers/kafkaProducer.js";
import {
  apiKeyMiddleware,
  corsMiddleware,
  rateLimitMiddleware,
} from "./helpers/httpSecurity.js";
import { createRoutes } from "./routes/index.js";
import { logger } from "./helpers/logger.js";
import { flushPendingSwaps } from "./controllers/tradeController.js";

const app = express();

app.use(corsMiddleware);
app.use(rateLimitMiddleware);
app.use(apiKeyMiddleware);
app.use(express.json({ limit: "16kb" }));

let alchemyWs: AlchemyWebSocket;
let server: ReturnType<typeof app.listen>;

async function bootstrap(): Promise<void> {
  await connectKafkaProducer();

  alchemyWs = new AlchemyWebSocket();
  alchemyWs.start();

  app.use(createRoutes(alchemyWs));

  server = app.listen(env.PORT, env.HOST, () => {
    logger.info("Server started", {
      host: env.HOST,
      port: env.PORT,
      corsOrigin: env.CORS_ORIGIN,
      apiKeyRequired: Boolean(env.apiKey),
    });
  });

  setupGracefulShutdown();
}

function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    logger.info("Shutting down", { signal });

    await alchemyWs.stop();

    try {
      await flushPendingSwaps();
    } catch (error) {
      logger.error("Failed to flush pending swaps", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await disconnectKafkaProducer();

    if (server) {
      server.close(() => {
        logger.info("HTTP server closed");
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((error) => {
  logger.error("Failed to start server", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
