import { Kafka, type Producer } from "kafkajs";
import { isKafkaConfigured, kafkaConfig } from "../config/kafka.js";
import type { SwapEvent } from "../models/TradeEvent.js";
import { logger } from "./logger.js";

let producer: Producer | null = null;
let connected = false;

function getKafka(): Kafka {
  if (!kafkaConfig) {
    throw new Error("Kafka is not configured");
  }

  return new Kafka({
    clientId: kafkaConfig.clientId,
    brokers: kafkaConfig.brokers,
  });
}

export async function connectKafkaProducer(): Promise<void> {
  if (!isKafkaConfigured || !kafkaConfig) {
    logger.info("Kafka disabled — omit KAFKA_BROKERS or leave it empty to run without Kafka");
    return;
  }

  if (connected && producer) {
    return;
  }

  try {
    producer = getKafka().producer();
    await producer.connect();
    connected = true;
    logger.info("Kafka producer connected", {
      brokers: kafkaConfig.brokers,
      topic: kafkaConfig.topic,
    });
  } catch (error) {
    producer = null;
    connected = false;
    logger.warn("Kafka connection failed — continuing without Kafka", {
      brokers: kafkaConfig.brokers,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function disconnectKafkaProducer(): Promise<void> {
  if (producer && connected) {
    await producer.disconnect();
    connected = false;
    producer = null;
    logger.info("Kafka producer disconnected");
  }
}

export async function publishSwapEvent(
  key: string,
  message: SwapEvent
): Promise<void> {
  if (!isKafkaConfigured || !producer || !connected || !kafkaConfig) {
    return;
  }

  await producer.send({
    topic: kafkaConfig.topic,
    messages: [
      {
        key,
        value: JSON.stringify(message),
      },
    ],
  });
}

export function isKafkaConnected(): boolean {
  return connected;
}
