import { createPublicClient, webSocket, type Hash } from 'viem'
import { base } from 'viem/chains'
import { alchemyConfig } from '../config/alchemy.js'
import { processSwap } from '../controllers/tradeController.js'
import { isExecuteTransaction } from './executeFilter.js'
import { decodeSwapLogs } from './swapDecoder.js'
import { logger } from './logger.js'

export class AlchemyWebSocket {
  private readonly client = createPublicClient({
    chain: base,
    transport: webSocket(alchemyConfig.wssUrl),
  })

  private unwatch: (() => void) | undefined
  private seenTxHashes = new Set<Hash>()
  private watching = false

  start(): void {
    this.unwatch = this.client.watchBlocks({
      onBlock: (block) => {
        void this.handleBlock(block.number)
      },
      onError: (error) => {
        logger.error('Viem block subscription error', {
          error: error.message,
        })
      },
    })

    this.watching = true
    logger.info('Subscribed to new blocks via viem')
  }

  async stop(): Promise<void> {
    this.unwatch?.()
    this.unwatch = undefined
    this.watching = false
    logger.info('Stopped viem block subscription')
  }

  isConnected(): boolean {
    return this.watching
  }

  private async handleBlock(blockNumber: bigint): Promise<void> {
    try {
      const block = await this.client.getBlock({
        blockNumber,
        includeTransactions: true,
      })

      const router = alchemyConfig.universalRouter.toLowerCase()

      for (const tx of block.transactions) {
        if (typeof tx === 'string') {
          continue
        }

        if (tx.to?.toLowerCase() !== router) {
          continue
        }

        if (!isExecuteTransaction(tx.input)) {
          continue
        }

        if (this.seenTxHashes.has(tx.hash)) {
          continue
        }

        this.trackTxHash(tx.hash)
        await this.processSwapLogs(tx.hash, tx.from, block.timestamp)
      }
    } catch (error) {
      logger.error('Failed to process block', {
        blockNumber: blockNumber.toString(),
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private async processSwapLogs(
    txHash: Hash,
    trader: `0x${string}`,
    blockTimestamp: bigint,
  ): Promise<void> {
    try {
      const receipt = await this.client.getTransactionReceipt({ hash: txHash })

      if (!receipt || receipt.status !== 'success') {
        return
      }

      const swaps = decodeSwapLogs(receipt, trader, blockTimestamp)

      for (const swap of swaps) {
        logger.info('Swap', {
          address: swap.contractAddress,
          name: swap.eventName,
          txHash: swap.txHash,
          logIndex: swap.logIndex,
          id: swap.poolId,
          sender: swap.sender,
          amount0: swap.amount0,
          amount1: swap.amount1,
          sqrtPriceX96: swap.sqrtPriceX96,
          liquidity: swap.liquidity,
          tick: swap.tick,
          fee: swap.fee,
        })

        await processSwap(swap)
      }
    } catch (error) {
      logger.error('Failed to decode swap logs', {
        txHash,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private trackTxHash(hash: Hash): void {
    this.seenTxHashes.add(hash)

    if (this.seenTxHashes.size > 10_000) {
      const oldest = this.seenTxHashes.values().next().value
      if (oldest) {
        this.seenTxHashes.delete(oldest)
      }
    }
  }
}
