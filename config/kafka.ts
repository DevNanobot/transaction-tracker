import { env } from "./index.js";

const SWAP_TOPIC = "swap";

export const isKafkaConfigured = env.kafkaEnabled;

export const kafkaConfig = isKafkaConfigured
  ? {
      brokers: env.kafkaBrokers,
      topic: SWAP_TOPIC,
      clientId: env.KAFKA_CLIENT_ID,
    }
  : null;
