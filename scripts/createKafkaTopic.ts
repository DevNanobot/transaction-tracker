import { Kafka } from "kafkajs";
import dotenv from "dotenv";
import { isKafkaConfigured, kafkaConfig } from "../config/kafka.js";

dotenv.config();

async function createTopic(): Promise<void> {
  if (!isKafkaConfigured || !kafkaConfig) {
    console.error("KAFKA_BROKERS is not set — nothing to do.");
    process.exit(1);
  }

  const kafka = new Kafka({
    clientId: `${kafkaConfig.clientId}-admin`,
    brokers: kafkaConfig.brokers,
  });

  const admin = kafka.admin();

  try {
    await admin.connect();

    const existingTopics = await admin.listTopics();

    if (existingTopics.includes(kafkaConfig.topic)) {
      console.log(`Topic already exists: ${kafkaConfig.topic}`);
      return;
    }

    await admin.createTopics({
      topics: [
        {
          topic: kafkaConfig.topic,
          numPartitions: 3,
          replicationFactor: 1,
        },
      ],
    });

    console.log(`Created topic: ${kafkaConfig.topic}`);
  } finally {
    await admin.disconnect();
  }
}

createTopic().catch((error) => {
  console.error("Failed to create Kafka topic:", error);
  process.exit(1);
});
