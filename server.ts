import express from "express";
import { env } from "./config/index.js";
import { AlchemyWebSocket } from "./helpers/alchemyWebSocket.js";
import {
  connectKafkaProducer,
  disconnectKafkaProducer,
} from "./helpers/kafkaProducer.js";
import { corsMiddleware, rateLimitMiddleware } from "./helpers/httpSecurity.js";
import { createRoutes } from "./routes/index.js";
import { errorMessage, logger } from "./helpers/logger.js";
import { flushPendingSwaps } from "./controllers/tradeController.js";
import { pingSupabase } from "./helpers/supabaseClient.js";
import { ensureKafkaTopics } from "./scripts/createKafkaTopic.js";

const app = express();

app.use(corsMiddleware);
app.use(rateLimitMiddleware);
app.use(express.json({ limit: "16kb" }));

let alchemyWs: AlchemyWebSocket;
let server: ReturnType<typeof app.listen>;

async function bootstrap(): Promise<void> {
  if (env.isProduction) {
    const supabaseOk = await pingSupabase();
    if (!supabaseOk) {
      logger.warn("Supabase ping failed; continuing");
    }
  }

  try {
    await ensureKafkaTopics();
  } catch (error) {
    logger.warn("Kafka topic setup failed", { error: errorMessage(error) });
  }

  await connectKafkaProducer();

  alchemyWs = new AlchemyWebSocket();
  alchemyWs.start();

  app.use(createRoutes(alchemyWs));

  server = app.listen(env.PORT, env.HOST, () => {
    logger.info("listening", {
      url: `http://${env.HOST}:${env.PORT}`,
      env: env.NODE_ENV,
      kafka: env.kafkaEnabled,
    });
  });

  setupShutdown();
}

function setupShutdown(): void {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info("shutting down", { signal });

    await alchemyWs.stop();
    await flushPendingSwaps();
    await disconnectKafkaProducer();

    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((error) => {
  logger.error("startup failed", { error: errorMessage(error) });
  process.exit(1);
});
