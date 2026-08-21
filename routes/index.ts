import { Router } from "express";
import type { AlchemyWebSocket } from "../helpers/alchemyWebSocket.js";
import { createHealthRoutes } from "./healthRoutes.js";
import { createTradesRoutes } from "./tradesRoutes.js";

export function createRoutes(alchemyWs: AlchemyWebSocket): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Transaction tracker</title>
  </head>
  <body>
    <h1>App is live</h1>
    <p>API is running. Try:</p>
    <ul>
      <li><a href="/health">/health</a></li>
      <li><a href="/trades?limit=50">/trades</a></li>
      <li><a href="/tradesAccelerated?limit=50">/tradesAccelerated</a></li>
      <li><a href="/trades/stream">/trades/stream</a></li>
    </ul>
  </body>
</html>`);
  });

  router.use(createHealthRoutes(alchemyWs));
  router.use(createTradesRoutes());

  return router;
}
