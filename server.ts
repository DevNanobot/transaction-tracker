import express from "express";
import { env } from "./config/index.js";
import { AlchemyWebSocket } from "./helpers/alchemyWebSocket.js";
import {
  connectKafkaProducer,
  disconnectKafkaProducer,
} from "./helpers/kafkaProducer.js";
import { createRoutes } from "./routes/index.js";
import { logger } from "./helpers/logger.js";

const app = express();

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json());

let alchemyWs: AlchemyWebSocket;
let server: ReturnType<typeof app.listen>;

async function bootstrap(): Promise<void> {
  await connectKafkaProducer();

  alchemyWs = new AlchemyWebSocket();
  alchemyWs.start();

  app.use(createRoutes(alchemyWs));

  server = app.listen(env.PORT, () => {
    logger.info("Server started", { port: env.PORT });
  });

  setupGracefulShutdown();
}

function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    logger.info("Shutting down", { signal });

    await alchemyWs.stop();
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
