import { Router, type Request, type Response } from "express";
import { getAcceleratedTradesPage, getTradesPage } from "../controllers/tradeController.js";
import { attachTradeStream } from "../helpers/tradeBroadcaster.js";
import { logger } from "../helpers/logger.js";

const MAX_OFFSET = 100_000;

function parseLimit(value: unknown, fallback = 50): number {
  return Math.min(Math.max(parseInt(String(value ?? fallback), 10) || fallback, 1), 200);
}

function parseOffset(value: unknown): number {
  return Math.min(Math.max(parseInt(String(value ?? "0"), 10) || 0, 0), MAX_OFFSET);
}

export function createTradesRoutes(): Router {
  const router = Router();

  router.get("/trades", (req: Request, res: Response) => {
    void (async () => {
      try {
        const limit = parseLimit(req.query.limit);
        const offset = parseOffset(req.query.offset);

        const page = await getTradesPage(limit, offset);

        res.json(page);
      } catch (error) {
        logger.error("Failed to fetch trades", {
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: "Failed to fetch trades" });
      }
    })();
  });

  router.get("/tradesAccelerated", (req: Request, res: Response) => {
    void (async () => {
      try {
        const limit = parseLimit(req.query.limit);
        const offset = parseOffset(req.query.offset);

        const page = await getAcceleratedTradesPage(limit, offset);

        res.json(page);
      } catch (error) {
        logger.error("Failed to fetch accelerated trades", {
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: "Failed to fetch accelerated trades" });
      }
    })();
  });

  router.get("/trades/stream", (req: Request, res: Response) => {
    const cleanup = attachTradeStream(res);

    if (!cleanup) {
      res.status(503).json({ error: "Too many stream connections" });
      return;
    }

    req.on("close", () => {
      cleanup();
    });
  });

  return router;
}
