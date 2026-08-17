import type { Response } from "express";
import type { TradeEvent } from "../models/TradeEvent.js";

type Subscriber = (event: TradeEvent) => void;

const subscribers = new Set<Subscriber>();

export function broadcastTradeEvent(event: TradeEvent): void {
  for (const subscriber of subscribers) {
    subscriber(event);
  }
}

export function subscribeToTradeEvents(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

export function attachTradeStream(res: Response): () => void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  res.write(": connected\n\n");

  const send = (event: TradeEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const unsubscribe = subscribeToTradeEvents(send);

  return () => {
    unsubscribe();
    res.end();
  };
}
