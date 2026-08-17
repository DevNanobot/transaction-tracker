import { Router } from "express";
import type { AlchemyWebSocket } from "../helpers/alchemyWebSocket.js";
import { createHealthRoutes } from "./healthRoutes.js";
import { createTradesRoutes } from "./tradesRoutes.js";

export function createRoutes(alchemyWs: AlchemyWebSocket): Router {
  const router = Router();

  router.use(createHealthRoutes(alchemyWs));
  router.use(createTradesRoutes());

  return router;
}
