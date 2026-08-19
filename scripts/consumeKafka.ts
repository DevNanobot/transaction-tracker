import { Kafka } from "kafkajs";
import { isKafkaConfigured, kafkaConfig } from "../config/kafka.js";

async function consume(): Promise<void> {
  if (!isKafkaConfigured || !kafkaConfig) {
    console.error("KAFKA_BROKERS is not set — nothing to do.");
    process.exit(1);
  }

  const kafka = new Kafka({
    clientId: `${kafkaConfig.clientId}-consumer`,
    brokers: kafkaConfig.brokers,
  });

  const consumer = kafka.consumer({
    groupId: `${kafkaConfig.clientId}-cli`,
  });

  const shutdown = async (signal: string) => {
    console.log(`\nShutting down (${signal})`);
    try {
      await consumer.disconnect();
    } finally {
      process.exit(0);
    }
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  await consumer.connect();
  await consumer.subscribe({
    topic: kafkaConfig.topic,
    fromBeginning: false,
  });

  console.log(`Listening on topic: ${kafkaConfig.topic}`);
  console.log("Press Ctrl+C to stop.\n");

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        return;
      }

      try {
        const parsed = JSON.parse(message.value.toString()) as Record<string, unknown>;
        console.log(JSON.stringify(parsed, null, 2));
        console.log("---");
      } catch {
        console.log(message.value.toString());
        console.log("---");
      }
    },
  });
}

consume().catch((error) => {
  console.error("Kafka consumer failed:", error);
  process.exit(1);
});
