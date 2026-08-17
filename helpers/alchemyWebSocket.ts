import { createPublicClient, webSocket, type Hash } from "viem";
import { base } from "viem/chains";
import { alchemyConfig } from "../config/alchemy.js";
import {
  processExecute,
  processSwap,
  toExecuteEvent,
} from "../controllers/tradeController.js";
import { isExecuteTransaction } from "./executeFilter.js";
import { decodeSwapLogs } from "./swapDecoder.js";
import { logger } from "./logger.js";

export class AlchemyWebSocket {
  private readonly client = createPublicClient({
    chain: base,
    transport: webSocket(alchemyConfig.wssUrl),
  });

  private unwatch: (() => void) | undefined;
  private seenTxHashes = new Set<Hash>();
  private watching = false;

  start(): void {
    logger.info("Starting viem WebSocket subscription", {
      url: alchemyConfig.wssUrl,
    });

    this.unwatch = this.client.watchBlocks({
      onBlock: (block) => {
        void this.handleBlock(block.number);
      },
      onError: (error) => {
        logger.error("Viem block subscription error", {
          error: error.message,
        });
      },
    });

    this.watching = true;
    logger.info("Subscribed to new blocks via viem");
  }

  async stop(): Promise<void> {
    this.unwatch?.();
    this.unwatch = undefined;
    this.watching = false;
    logger.info("Stopped viem block subscription");
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

        if (!isExecuteTransaction(tx.input)) {
          continue;
        }

        if (this.seenTxHashes.has(tx.hash)) {
          continue;
        }

        this.trackTxHash(tx.hash);

        const executeEvent = toExecuteEvent({
          txHash: tx.hash,
          from: tx.from,
          to: tx.to ?? alchemyConfig.universalRouter,
          blockNumber: block.number,
          inputLength: tx.input.length,
        });

        await processExecute(executeEvent);
        await this.processSwapLogs(tx.hash, tx.from);
      }
    } catch (error) {
      logger.error("Failed to process block", {
        blockNumber: blockNumber.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async processSwapLogs(
    txHash: Hash,
    trader: `0x${string}`
  ): Promise<void> {
    try {
      const receipt = await this.client.getTransactionReceipt({ hash: txHash });

      if (!receipt || receipt.status !== "success") {
        return;
      }

      const swaps = decodeSwapLogs(receipt, trader);

      for (const swap of swaps) {
        await processSwap(swap);
      }
    } catch (error) {
      logger.error("Failed to decode swap logs", {
        txHash,
        error: error instanceof Error ? error.message : String(error),
      });
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
