import {
  createPublicClient,
  http,
  webSocket,
  type Hash,
  type PublicClient,
} from "viem";
import { alchemyConfig, robinhoodChain } from "../config/alchemy.js";
import { processSwap } from "../controllers/tradeController.js";
import { isExecuteTransaction } from "./executeFilter.js";
import { decodeSwapLogs } from "./swapDecoder.js";
import { errorMessage, logger } from "./logger.js";

const HTTP_POLL_MS = 1_000;

function isHandshakeError(error: Error): boolean {
  return /non-101|network error|socket|websocket/i.test(error.message);
}

export class AlchemyWebSocket {
  private readonly wsClient = createPublicClient({
    chain: robinhoodChain,
    transport: webSocket(alchemyConfig.wssUrl, {
      retryCount: 3,
      retryDelay: 1_000,
    }),
  });

  private readonly httpClient = createPublicClient({
    chain: robinhoodChain,
    transport: http(alchemyConfig.httpUrl, {
      timeout: 20_000,
      retryCount: 3,
    }),
  });

  private client: PublicClient = this.wsClient;
  private polling = false;
  private unwatch: (() => void) | undefined;
  private seenTxHashes = new Set<Hash>();
  private watching = false;
  private inflight = 0;
  private idleWaiters: Array<() => void> = [];

  start(): void {
    this.watching = true;
    this.watch(false);
    logger.info("watching blocks", {
      chainId: alchemyConfig.chainId,
      router: alchemyConfig.universalRouter,
    });
  }

  private watch(poll: boolean): void {
    this.unwatch?.();
    this.polling = poll;
    this.client = poll ? this.httpClient : this.wsClient;

    this.unwatch = poll
      ? this.client.watchBlocks({
          poll: true,
          pollingInterval: HTTP_POLL_MS,
          onBlock: (block) => this.onBlock(block?.number),
          onError: (error) => this.onWatchError(error),
        })
      : this.client.watchBlocks({
          onBlock: (block) => this.onBlock(block?.number),
          onError: (error) => this.onWatchError(error),
        });
  }

  private onBlock(blockNumber: bigint | undefined | null): void {
    if (!this.watching || blockNumber == null) {
      return;
    }

    this.inflight += 1;
    void this.handleBlock(blockNumber).finally(() => {
      this.inflight -= 1;
      if (this.inflight === 0) {
        for (const resolve of this.idleWaiters) {
          resolve();
        }
        this.idleWaiters = [];
      }
    });
  }

  private onWatchError(error: Error): void {
    logger.error("block watch error", { error: error.message, polling: this.polling });

    if (this.watching && !this.polling && isHandshakeError(error)) {
      logger.warn("websocket failed, falling back to http polling");
      this.watch(true);
    }
  }

  async stop(): Promise<void> {
    this.watching = false;
    this.unwatch?.();
    this.unwatch = undefined;

    if (this.inflight > 0) {
      await new Promise<void>((resolve) => {
        this.idleWaiters.push(resolve);
      });
    }
  }

  isConnected(): boolean {
    return this.watching;
  }

  private async handleBlock(blockNumber: bigint): Promise<void> {
    try {
      const block = await this.client.getBlock({
        blockNumber,
        includeTransactions: true,
      });

      const router = alchemyConfig.universalRouter.toLowerCase();

      for (const tx of block.transactions) {
        if (typeof tx === "string") {
          continue;
        }
        if (tx.to?.toLowerCase() !== router) {
          continue;
        }
        if (!isExecuteTransaction(tx.input) || this.seenTxHashes.has(tx.hash)) {
          continue;
        }

        this.trackTxHash(tx.hash);
        await this.processSwapLogs(tx.hash, tx.from, block.timestamp);
      }
    } catch (error) {
      logger.error("block failed", {
        blockNumber: blockNumber.toString(),
        error: errorMessage(error),
      });
    }
  }

  private async processSwapLogs(
    txHash: Hash,
    trader: `0x${string}`,
    blockTimestamp: bigint
  ): Promise<void> {
    try {
      const receipt = await this.client.getTransactionReceipt({ hash: txHash });
      if (!receipt || receipt.status !== "success") {
        return;
      }

      const swaps = decodeSwapLogs(receipt, trader, blockTimestamp);
      if (swaps.length === 0) {
        return;
      }

      for (const swap of swaps) {
        logger.info("swap", {
          txHash: swap.txHash,
          logIndex: swap.logIndex,
          poolId: swap.poolId,
          amount0: swap.amount0,
          amount1: swap.amount1,
          tick: swap.tick,
          fee: swap.fee,
        });
        await processSwap(swap);
      }
    } catch (error) {
      logger.error("swap decode failed", { txHash, error: errorMessage(error) });
    }
  }

  private trackTxHash(hash: Hash): void {
    this.seenTxHashes.add(hash);
    if (this.seenTxHashes.size > 10_000) {
      const oldest = this.seenTxHashes.values().next().value;
      if (oldest) {
        this.seenTxHashes.delete(oldest);
      }
    }
  }
}
