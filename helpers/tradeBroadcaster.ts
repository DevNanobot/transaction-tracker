import type { Response } from "express";
import type { SwapEvent } from "../models/TradeEvent.js";

type Subscriber = (event: SwapEvent) => void;

const MAX_SUBSCRIBERS = 32;
const subscribers = new Set<Subscriber>();

export function broadcastTradeEvent(event: SwapEvent): void {
  for (const subscriber of subscribers) {
    subscriber(event);
  }
}

function subscribeToTradeEvents(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

export function attachTradeStream(res: Response): (() => void) | null {
  if (subscribers.size >= MAX_SUBSCRIBERS) {
    return null;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  res.write(": connected\n\n");

  const send = (event: SwapEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const unsubscribe = subscribeToTradeEvents(send);

  return () => {
    unsubscribe();
    res.end();
  };
}
