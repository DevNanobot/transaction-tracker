import { env } from "./index.js";

export const isKafkaConfigured = env.kafkaEnabled;

export const kafkaConfig = isKafkaConfigured
  ? {
      brokers: env.kafkaBrokers,
      topic: env.KAFKA_TOPIC,
      clientId: env.KAFKA_CLIENT_ID,
    }
  : null;
