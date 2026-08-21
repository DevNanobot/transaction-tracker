import { Kafka, type Producer } from "kafkajs";
import { isKafkaConfigured, kafkaConfig } from "../config/kafka.js";
import {
  toAcceleratedSwapEvents,
  type SwapAcceleratedEvent,
  type SwapEvent,
} from "../models/TradeEvent.js";
import { errorMessage, logger } from "./logger.js";

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
    return;
  }

  if (connected && producer) {
    return;
  }

  try {
    producer = getKafka().producer();
    await producer.connect();
    connected = true;
    logger.info("kafka connected", {
      brokers: kafkaConfig.brokers,
      topic: kafkaConfig.topic,
    });
  } catch (error) {
    producer = null;
    connected = false;
    logger.warn("kafka unavailable", { error: errorMessage(error) });
  }
}

export async function disconnectKafkaProducer(): Promise<void> {
  if (!producer || !connected) {
    return;
  }

  await producer.disconnect();
  connected = false;
  producer = null;
}

export async function publishSwapEvent(key: string, message: SwapEvent): Promise<void> {
  if (!producer || !connected || !kafkaConfig) {
    return;
  }

  await producer.send({
    topic: kafkaConfig.topic,
    messages: [{ key, value: JSON.stringify(message) }],
  });
}

export async function publishAcceleratedSwapEvents(
  event: SwapEvent,
  onEach?: (copy: SwapAcceleratedEvent) => void
): Promise<void> {
  for (const copy of toAcceleratedSwapEvents(event)) {
    if (producer && connected && kafkaConfig) {
      await producer.send({
        topic: kafkaConfig.acceleratedTopic,
        messages: [
          {
            key: `${copy.txHash}-${copy.logIndex}-${copy.nonce}`,
            value: JSON.stringify(copy),
          },
        ],
      });
    }
    onEach?.(copy);
  }
}

export function isKafkaConnected(): boolean {
  return connected;
}
