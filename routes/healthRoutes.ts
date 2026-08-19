import { Router } from "express";
import type { AlchemyWebSocket } from "../helpers/alchemyWebSocket.js";
import { createHealthController } from "../controllers/healthController.js";

export function createHealthRoutes(alchemyWs: AlchemyWebSocket): Router {
  const router = Router();
  const controller = createHealthController(alchemyWs);

  router.get("/health", (req, res) => {
    void controller.getHealth(req, res);
  });

  return router;
}
