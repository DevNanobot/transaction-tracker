import { createPublicClient, webSocket, type Hash } from 'viem'
import { alchemyConfig, robinhoodChain } from '../config/alchemy.js'
import { processSwap } from '../controllers/tradeController.js'
import { isExecuteTransaction } from './executeFilter.js'
import { decodeSwapLogs } from './swapDecoder.js'
import { logger } from './logger.js'

export class AlchemyWebSocket {
  private readonly client = createPublicClient({
    chain: robinhoodChain,
    transport: webSocket(alchemyConfig.wssUrl, {
      retryCount: 10,
      retryDelay: 1_000,
    }),
  })

  private unwatch: (() => void) | undefined
  private seenTxHashes = new Set<Hash>()
  private watching = false
  private inflight = 0
  private idleWaiters: Array<() => void> = []

  start(): void {
    this.unwatch = this.client.watchBlocks({
      onBlock: (block) => {
        if (!this.watching) {
          return
        }

        const blockNumber = block?.number

        if (blockNumber === undefined || blockNumber === null) {
          logger.warn('Ignored block subscription event without a number')
          return
        }

        this.inflight += 1
        void this.handleBlock(blockNumber).finally(() => {
          this.inflight -= 1
          if (this.inflight === 0) {
            for (const resolve of this.idleWaiters) {
              resolve()
            }
            this.idleWaiters = []
          }
        })
      },
      onError: (error) => {
        logger.error('Viem block subscription error', {
          error: error.message,
        })
      },
    })

    this.watching = true
    logger.info('Subscribed to new blocks via viem', {
      chainId: alchemyConfig.chainId,
      universalRouter: alchemyConfig.universalRouter,
      poolManager: alchemyConfig.poolManager,
    })
  }

  async stop(): Promise<void> {
    this.watching = false
    this.unwatch?.()
    this.unwatch = undefined

    if (this.inflight > 0) {
      logger.info('Waiting for in-flight blocks before flush', {
        inflight: this.inflight,
      })
      await new Promise<void>((resolve) => {
        this.idleWaiters.push(resolve)
      })
    }

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

      if (swaps.length === 0) {
        logger.info('Router execute with no V4 Swap logs', {
          txHash,
          logCount: receipt.logs.length,
        })
        return
      }

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
