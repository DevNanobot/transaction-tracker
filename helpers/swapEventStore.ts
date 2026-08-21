import { Kafka } from "kafkajs";
import { isKafkaConfigured, kafkaConfig } from "../config/kafka.js";
import type { SwapAcceleratedEvent, SwapEvent } from "../models/TradeEvent.js";
import { logger } from "./logger.js";

const MAX_CACHED_EVENTS = 10_000;
const KAFKA_READ_MS = 8_000;

const swapCache: SwapEvent[] = [];
const acceleratedCache: SwapAcceleratedEvent[] = [];

let swapHydrate: Promise<void> | null = null;
let acceleratedHydrate: Promise<void> | null = null;

function newestFirst<T extends { blockNumber: string; logIndex: number }>(
  a: T,
  b: T
): number {
  const block = Number(b.blockNumber) - Number(a.blockNumber);
  if (block !== 0) {
    return block;
  }
  return b.logIndex - a.logIndex;
}

function pushBounded<T>(cache: T[], event: T): void {
  cache.push(event);
  if (cache.length > MAX_CACHED_EVENTS) {
    cache.splice(0, cache.length - MAX_CACHED_EVENTS);
  }
}

export function rememberSwapEvent(event: SwapEvent): void {
  pushBounded(swapCache, event);
}

export function rememberAcceleratedSwapEvent(event: SwapAcceleratedEvent): void {
  pushBounded(acceleratedCache, event);
}

function pageFromCache<T extends { blockNumber: string; logIndex: number }>(
  cache: T[],
  limit: number,
  offset: number
): { trades: T[]; total: number; source: "kafka" } {
  const sorted = [...cache].sort(newestFirst);
  return {
    trades: sorted.slice(offset, offset + limit),
    total: sorted.length,
    source: "kafka",
  };
}

function parseSwap(value: string): SwapEvent | null {
  try {
    const parsed = JSON.parse(value) as Partial<SwapEvent>;
    if (parsed.type !== "swap" || typeof parsed.txHash !== "string") {
      return null;
    }
    return parsed as SwapEvent;
  } catch {
    return null;
  }
}

function parseAccelerated(value: string): SwapAcceleratedEvent | null {
  try {
    const parsed = JSON.parse(value) as Partial<SwapAcceleratedEvent>;
    if (parsed.type !== "swap-accelerated" || typeof parsed.txHash !== "string") {
      return null;
    }
    return parsed as SwapAcceleratedEvent;
  } catch {
    return null;
  }
}

async function readTopic<T>(
  topic: string,
  parse: (value: string) => T | null
): Promise<T[]> {
  if (!isKafkaConfigured || !kafkaConfig) {
    return [];
  }

  const kafka = new Kafka({
    clientId: `${kafkaConfig.clientId}-reader`,
    brokers: kafkaConfig.brokers,
  });

  const consumer = kafka.consumer({
    groupId: `${kafkaConfig.clientId}-reader-${Date.now()}`,
  });

  const items: T[] = [];

  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });

  const run = consumer.run({
    autoCommit: false,
    eachMessage: async ({ message }) => {
      if (!message.value) {
        return;
      }
      const parsed = parse(message.value.toString());
      if (parsed) {
        items.push(parsed);
      }
    },
  });

  await Promise.race([
    run,
    new Promise((resolve) => setTimeout(resolve, KAFKA_READ_MS)),
  ]);

  await consumer.stop();
  await consumer.disconnect();

  return items;
}

async function hydrateSwaps(): Promise<void> {
  if (swapCache.length > 0 || !kafkaConfig) {
    return;
  }

  logger.warn("loading swaps from kafka", { topic: kafkaConfig.topic });

  const events = await readTopic(kafkaConfig.topic, parseSwap);
  for (const event of events) {
    rememberSwapEvent(event);
  }
}

async function hydrateAccelerated(): Promise<void> {
  if (acceleratedCache.length > 0 || !kafkaConfig) {
    return;
  }

  logger.warn("loading accelerated swaps from kafka", {
    topic: kafkaConfig.acceleratedTopic,
  });

  const events = await readTopic(kafkaConfig.acceleratedTopic, parseAccelerated);
  for (const event of events) {
    rememberAcceleratedSwapEvent(event);
  }
}

export async function getSwapsFromKafka(
  limit: number,
  offset: number
): Promise<{ trades: SwapEvent[]; total: number; source: "kafka" }> {
  if (swapCache.length === 0) {
    swapHydrate ??= hydrateSwaps().finally(() => {
      swapHydrate = null;
    });
    await swapHydrate;
  }

  return pageFromCache(swapCache, limit, offset);
}

export async function getAcceleratedSwapsFromKafka(
  limit: number,
  offset: number
): Promise<{ trades: SwapAcceleratedEvent[]; total: number; source: "kafka" }> {
  if (acceleratedCache.length === 0) {
    acceleratedHydrate ??= hydrateAccelerated().finally(() => {
      acceleratedHydrate = null;
    });
    await acceleratedHydrate;
  }

  return pageFromCache(acceleratedCache, limit, offset);
}
