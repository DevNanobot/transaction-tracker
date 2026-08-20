import { env } from "./index.js";

const SWAP_TOPIC = "swap";
const SWAP_ACCELERATED_TOPIC = "swap-accelerated";

export const isKafkaConfigured = env.kafkaEnabled;

export const kafkaConfig = isKafkaConfigured
  ? {
      brokers: env.kafkaBrokers,
      topic: SWAP_TOPIC,
      acceleratedTopic: SWAP_ACCELERATED_TOPIC,
      clientId: env.KAFKA_CLIENT_ID,
    }
  : null;
