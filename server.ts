import express from "express";
import { env } from "./config/index.js";
import { AlchemyWebSocket } from "./helpers/alchemyWebSocket.js";
import {
  connectKafkaProducer,
  disconnectKafkaProducer,
} from "./helpers/kafkaProducer.js";
import { corsMiddleware, rateLimitMiddleware } from "./helpers/httpSecurity.js";
import { createRoutes } from "./routes/index.js";
import { logger } from "./helpers/logger.js";
import { flushPendingSwaps } from "./controllers/tradeController.js";
import { pingSupabase } from "./helpers/supabaseClient.js";
import { ensureKafkaTopics } from "./scripts/createKafkaTopic.js";

const app = express();

app.use(corsMiddleware);
app.use(rateLimitMiddleware);
app.use(express.json({ limit: "16kb" }));

let alchemyWs: AlchemyWebSocket;
let server: ReturnType<typeof app.listen>;

function publicAppUrl(host: string, port: number): string {
  if (host === "0.0.0.0" || host === "::") {
    return `http://0.0.0.0:${port} (use http://YOUR_SERVER_IP:${port})`;
  }

  return `http://${host}:${port}`;
}

async function bootstrap(): Promise<void> {
  if (env.isProduction) {
    const supabaseOk = await pingSupabase();
    if (!supabaseOk) {
      console.error(
        "Supabase check failed — run scripts/migrateSupabase.sql in Supabase. Continuing anyway."
      );
    }
  }

  try {
    await ensureKafkaTopics();
  } catch (error) {
    console.error(
      "Kafka topic setup failed:",
      error instanceof Error ? error.message : String(error)
    );
  }

  await connectKafkaProducer();

  alchemyWs = new AlchemyWebSocket();
  alchemyWs.start();

  app.use(createRoutes(alchemyWs));

  const appUrl = publicAppUrl(env.HOST, env.PORT);

  server = app.listen(env.PORT, env.HOST, () => {
    const liveMessage = `App is live on ${appUrl}`;
    console.log(liveMessage);
    logger.info(liveMessage, {
      nodeEnv: env.NODE_ENV,
      host: env.HOST,
      port: env.PORT,
      url: appUrl,
      corsOrigin: env.CORS_ORIGIN,
      kafkaEnabled: env.kafkaEnabled,
    });
  });

  setupGracefulShutdown();
}

function setupGracefulShutdown(): void {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info("Shutting down", { signal });

    await alchemyWs.stop();

    try {
      await flushPendingSwaps({ reason: "shutdown" });
    } catch (error) {
      logger.error("Failed to flush pending swaps", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await disconnectKafkaProducer();

    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      logger.info("HTTP server closed");
    }

    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Failed to start server:", message);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  logger.error("Failed to start server", { error: message });
  process.exit(1);
});
