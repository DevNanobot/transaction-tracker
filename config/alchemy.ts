import { defineChain, type Address } from "viem";
import { env } from "./index.js";

export const ROBINHOOD_CHAIN_ID = 4663;

export const POOL_MANAGER =
  "0x8366a39CC670B4001A1121B8F6A443A643e40951" as Address;

/** execute(bytes,bytes[],uint256) */
export const EXECUTE_WITH_DEADLINE_SELECTOR = "0x3593564c" as const;
/** execute(bytes,bytes[]) — used by Robinhood Chain Universal Router */
export const EXECUTE_SELECTOR = "0x24856bc3" as const;

export const EXECUTE_SELECTORS = [
  EXECUTE_WITH_DEADLINE_SELECTOR,
  EXECUTE_SELECTOR,
] as const;

export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [`https://robinhood-mainnet.g.alchemy.com/v2/${env.ALCHEMY_KEY}`],
      webSocket: [`wss://robinhood-mainnet.g.alchemy.com/v2/${env.ALCHEMY_KEY}`],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});

export const alchemyConfig = {
  wssUrl: `wss://robinhood-mainnet.g.alchemy.com/v2/${env.ALCHEMY_KEY}`,
  universalRouter: env.UNIVERSAL_ROUTER,
  poolManager: POOL_MANAGER,
  chainId: ROBINHOOD_CHAIN_ID,
} as const;
