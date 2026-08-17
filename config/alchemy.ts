import { env } from "./index.js";

export const BASE_CHAIN_ID = 8453;

export const POOL_MANAGER = "0x498581ff718922c3f8e6a244956af099b2652b2b" as const;

export const EXECUTE_SELECTOR = "0x3593564c" as const;

export const alchemyConfig = {
  apiKey: env.ALCHEMY_KEY,
  wssUrl: `wss://base-mainnet.g.alchemy.com/v2/${env.ALCHEMY_KEY}`,
  httpUrl: `https://base-mainnet.g.alchemy.com/v2/${env.ALCHEMY_KEY}`,
  universalRouter: env.UNIVERSAL_ROUTER,
  poolManager: POOL_MANAGER,
  executeSelector: EXECUTE_SELECTOR,
} as const;
