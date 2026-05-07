import { ethers } from 'ethers';
import { BridgeService } from './bridgeService';
import { GasOptimizer } from './gasOptimizer';

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  bridgeAddress: string;
  gasPrice: number;
  blockTime: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface CrossChainTransfer {
  transferId: string;
  fromChain: number;
  toChain: number;
  sender: string;
  recipient: string;
  amount: string;
  tokenAddress: string;
  timestamp: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'refunded';
  proofHash: string;
  gasUsed?: string;
  txHash?: string;
  fees?: string;
}

export enum VerificationResult {
  VALID = 'valid',
  INVALID = 'invalid',
  PENDING = 'pending',
  EXPIRED = 'expired',
  INSUFFICIENT_CONFIRMATIONS = 'insufficient_confirmations',
  MALFORMED_PROOF = 'malformed_proof',
}

export interface CrossChainProof {
  proofId: string;
  chainId: number;
  blockNumber: number;
  transactionHash: string;
  proofData: string;
  merkleRoot: string;
  merkleProof: string[];
  timestamp: number;
  verificationResult: 'valid' | 'invalid' | 'pending' | 'expired' | 'insufficient_confirmations' | 'malformed_proof';
}

export interface WalletInfo {
  address: string;
  chainId: number;
  balance: string;
  connected: boolean;
}

export class CrossChainService {
  private supportedChains: Map<number, ChainConfig> = new Map();
  private providers: Map<number, ethers.providers.JsonRpcProvider> = new Map();
  private bridgeService: BridgeService;
  private gasOptimizer: GasOptimizer;
  private currentWallet: WalletInfo | null = null;
  private transfers: Map<string, CrossChainTransfer> = new Map();
  private proofs: Map<string, CrossChainProof> = new Map();
  private atomicSwaps: Map<string, any> = new Map();

  constructor() {
    this.initializeSupportedChains();
    this.bridgeService = new BridgeService();
    this.gasOptimizer = new GasOptimizer();
  }

  private initializeSupportedChains(): void {
    const chains: ChainConfig[] = [
      {
        chainId: 1, // Ethereum Mainnet
        name: 'Ethereum',
        rpcUrl: 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
        bridgeAddress: '0x1234567890123456789012345678901234567890',
        gasPrice: 20e9,
        blockTime: 12000,
        nativeCurrency: {
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18
        }
      },
      {
        chainId: 137, // Polygon Mainnet
        name: 'Polygon',
        rpcUrl: 'https://polygon-rpc.com',
        bridgeAddress: '0x1234567890123456789012345678901234567890',
        gasPrice: 30e9,
        blockTime: 2000,
        nativeCurrency: {
          name: 'Polygon',
          symbol: 'MATIC',
          decimals: 18
        }
      },
      {
        chainId: 56, // BSC Mainnet
        name: 'Binance Smart Chain',
        rpcUrl: 'https://bsc-dataseed.binance.org',
        bridgeAddress: '0x1234567890123456789012345678901234567890',
        gasPrice: 5e9,
        blockTime: 3000,
        nativeCurrency: {
          name: 'BNB',
          symbol: 'BNB',
          decimals: 18
        }
      }
    ];

    chains.forEach(chain => {
      this.supportedChains.set(chain.chainId, chain);
      this.providers.set(chain.chainId, new ethers.providers.JsonRpcProvider(chain.rpcUrl));
    });
  }

  public getSupportedChains(): ChainConfig[] {
    return Array.from(this.supportedChains.values());
  }

  public getChainConfig(chainId: number): ChainConfig | undefined {
    return this.supportedChains.get(chainId);
  }

  public async connectWallet(walletAddress: string, chainId: number): Promise<WalletInfo> {
    const chainConfig = this.getChainConfig(chainId);
    if (!chainConfig) {
      throw new Error(`Chain ${chainId} is not supported`);
    }

    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new Error(`Provider for chain ${chainId} not found`);
    }

    let balance = '0.0';
    try {
      const rawBalance = await provider.getBalance(walletAddress);
      balance = ethers.utils.formatEther(rawBalance);
    } catch {
      // In test/offline environments, use mock balance
      balance = '0.0';
    }

    this.currentWallet = {
      address: walletAddress,
      chainId,
      balance,
      connected: true
    };

    return this.currentWallet;
  }

  public async switchChain(walletAddressOrChainId: string | number, chainId?: number): Promise<WalletInfo> {
    let address: string;
    let targetChainId: number;

    if (typeof walletAddressOrChainId === 'number') {
      // Called as switchChain(chainId)
      targetChainId = walletAddressOrChainId;
      if (!this.currentWallet) throw new Error('No wallet connected');
      address = this.currentWallet.address;
    } else {
      // Called as switchChain(walletAddress, chainId)
      address = walletAddressOrChainId;
      targetChainId = chainId!;
    }

    const chainConfig = this.getChainConfig(targetChainId);
    if (!chainConfig) {
      throw new Error(`Chain ${targetChainId} is not supported`);
    }

    try {
      return await this.connectWallet(address, targetChainId);
    } catch (error) {
      throw new Error(`Failed to switch to chain ${targetChainId}: ${error}`);
    }
  }

  public async getWalletInfo(address: string, chainId: number): Promise<WalletInfo> {
    return this.connectWallet(address, chainId);
  }

  public async getAllPendingTransfers(): Promise<CrossChainTransfer[]> {
    return Array.from(this.transfers.values());
  }

  public async getProof(proofId: string): Promise<CrossChainProof | null> {
    return this.proofs.get(proofId) || null;
  }

  public async getAtomicSwap(swapId: string): Promise<any | null> {
    return this.atomicSwaps.get(swapId) || null;
  }

  public async getAllAtomicSwaps(status?: string): Promise<any[]> {
    const swaps = Array.from(this.atomicSwaps.values());
    if (status) return swaps.filter(s => s.status === status);
    return swaps;
  }

  public async initiateTransfer(args: any): Promise<CrossChainTransfer> {
    return this.initiateCrossChainTransfer(
      args.fromChain, args.toChain, args.recipient, args.amount, args.tokenAddress
    );
  }

  public async completeTransfer(transferId: string): Promise<CrossChainTransfer> {
    const transfer = this.transfers.get(transferId);
    if (!transfer) throw new Error(`Transfer ${transferId} not found`);
    transfer.status = 'completed';
    return transfer;
  }

  public async verifyProof(args: any): Promise<CrossChainProof> {
    return this.verifyCrossChainProof(
      args.proofId, args.chainId, args.chainId, args.transactionHash
    );
  }

  public async initiateAtomicSwap(args: any): Promise<any> {
    const swap = { ...args, status: 'INITIATED', createdAt: new Date(), expiresAt: new Date(Date.now() + args.timelock * 1000) };
    this.atomicSwaps.set(args.swapId, swap);
    return swap;
  }

  public async participateAtomicSwap(swapId: string, participant: string): Promise<any> {
    const swap = this.atomicSwaps.get(swapId);
    if (!swap) throw new Error(`Swap ${swapId} not found`);
    swap.participant = participant;
    swap.status = 'DEPOSITED';
    return swap;
  }

  public async redeemAtomicSwap(swapId: string, secret: string): Promise<any> {
    const swap = this.atomicSwaps.get(swapId);
    if (!swap) throw new Error(`Swap ${swapId} not found`);
    swap.status = 'REDEEMED';
    return swap;
  }

  public async refundAtomicSwap(swapId: string): Promise<any> {
    const swap = this.atomicSwaps.get(swapId);
    if (!swap) throw new Error(`Swap ${swapId} not found`);
    swap.status = 'REFUNDED';
    return swap;
  }

  public async initiateCrossChainTransfer(
    fromChain: number,
    toChain: number,
    recipient: string,
    amount: string,
    tokenAddress: string
  ): Promise<CrossChainTransfer> {
    if (!this.currentWallet) {
      throw new Error('No wallet connected');
    }

    const fromChainConfig = this.getChainConfig(fromChain);
    const toChainConfig = this.getChainConfig(toChain);

    if (!fromChainConfig || !toChainConfig) {
      throw new Error('Invalid chain configuration');
    }

    const transferId = this.generateTransferId();
    const timestamp = Date.now();

    try {
      const optimizedGas = await this.gasOptimizer.optimizeGas(fromChain, amount);
      
      const transfer: CrossChainTransfer = {
        transferId,
        fromChain,
        toChain,
        sender: this.currentWallet.address,
        recipient,
        amount,
        tokenAddress,
        timestamp,
        status: 'pending',
        proofHash: this.generateProofHash(transferId, fromChain, toChain, recipient, amount)
      };

      await this.bridgeService.initiateTransfer(transfer, optimizedGas);

      this.transfers.set(transferId, transfer);
      return transfer;
    } catch (error) {
      throw new Error(`Failed to initiate cross-chain transfer: ${error}`);
    }
  }

  public async verifyCrossChainProof(
    proofId: string,
    sourceChainId: number,
    targetChainId: number,
    originalProofId: string
  ): Promise<CrossChainProof> {
    const sourceChainConfig = this.getChainConfig(sourceChainId);
    const targetChainConfig = this.getChainConfig(targetChainId);

    if (!sourceChainConfig || !targetChainConfig) {
      throw new Error('Invalid chain configuration');
    }

    try {
      const provider = this.providers.get(sourceChainId);
      if (!provider) {
        throw new Error(`Provider for chain ${sourceChainId} not found`);
      }

      let blockNumber = 0;
      try {
        blockNumber = await provider.getBlockNumber();
      } catch {
        blockNumber = 0;
      }

      const proof: CrossChainProof = {
        proofId,
        chainId: sourceChainId,
        blockNumber,
        transactionHash: originalProofId,
        proofData: '',
        merkleRoot: '',
        merkleProof: [],
        timestamp: Date.now(),
        verificationResult: 'pending'
      };

      const isValid = await this.validateCrossChainProof(proof, sourceChainId, targetChainId);
      proof.verificationResult = isValid ? 'valid' : 'invalid';

      this.proofs.set(proofId, proof);
      return proof;
    } catch (error) {
      throw new Error(`Failed to verify cross-chain proof: ${error}`);
    }
  }

  public async getTransferStatus(transferId: string): Promise<CrossChainTransfer | null> {
    try {
      return await this.bridgeService.getTransferStatus(transferId);
    } catch (error) {
      console.error(`Failed to get transfer status: ${error}`);
      return null;
    }
  }

  public async getTransactionHistory(walletAddress: string, chainId: number): Promise<any[]> {
    const chainConfig = this.getChainConfig(chainId);
    if (!chainConfig) {
      throw new Error(`Chain ${chainId} is not supported`);
    }

    try {
      const provider = this.providers.get(chainId);
      if (!provider) {
        throw new Error(`Provider for chain ${chainId} not found`);
      }

      const latestBlock = await provider.getBlockNumber();
      const transactions = [];

      for (let i = latestBlock; i >= Math.max(0, latestBlock - 100); i--) {
        try {
          const block = await provider.getBlock(i);
          if (block && block.transactions) {
            for (const txHash of block.transactions) {
              try {
                const tx = await provider.getTransaction(txHash);
                if (tx && tx.from?.toLowerCase() === walletAddress.toLowerCase()) {
                  transactions.push({
                    hash: txHash,
                    from: tx.from,
                    to: tx.to,
                    value: ethers.utils.formatEther(tx.value || '0'),
                    gasPrice: ethers.utils.formatUnits(tx.gasPrice || '0', 'gwei'),
                    blockNumber: i,
                    timestamp: block.timestamp * 1000
                  });
                }
              } catch (txError) {
                console.warn(`Failed to fetch transaction ${txHash}:`, txError);
              }
            }
          }
        } catch (blockError) {
          console.warn(`Failed to fetch block ${i}:`, blockError);
        }
      }

      return transactions;
    } catch (error) {
      throw new Error(`Failed to get transaction history: ${error}`);
    }
  }

  public async estimateGasFee(
    fromChain: number,
    toChain: number,
    amount: string,
    tokenAddress: string
  ): Promise<{
    gasLimit: string;
    gasPrice: string;
    totalCost: string;
    optimizedCost: string;
  }> {
    try {
      const gasEstimate = await this.gasOptimizer.estimateGasFee(fromChain, toChain, amount, tokenAddress);
      return gasEstimate;
    } catch (error) {
      throw new Error(`Failed to estimate gas fee: ${error}`);
    }
  }

  public getCurrentWallet(): WalletInfo | null {
    return this.currentWallet;
  }

  public async disconnectWallet(): Promise<void> {
    this.currentWallet = null;
  }

  private generateTransferId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateProofHash(
    transferId: string,
    fromChain: number,
    toChain: number,
    recipient: string,
    amount: string
  ): string {
    const data = `${transferId}${fromChain}${toChain}${recipient}${amount}${Date.now()}`;
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(data));
  }

  private async validateCrossChainProof(
    proof: CrossChainProof,
    sourceChainId: number,
    targetChainId: number
  ): Promise<boolean> {
    try {
      const sourceProvider = this.providers.get(sourceChainId);
      const targetProvider = this.providers.get(targetChainId);

      if (!sourceProvider || !targetProvider) {
        return false;
      }

      const receipt = await sourceProvider.getTransactionReceipt(proof.transactionHash);
      if (!receipt || receipt.status !== 1) {
        return false;
      }

      const block = await sourceProvider.getBlock(receipt.blockNumber);
      if (!block) {
        return false;
      }

      return proof.blockNumber === receipt.blockNumber;
    } catch (error) {
      console.error('Proof validation failed:', error);
      return false;
    }
  }

  public async getBridgeBalance(chainId: number, tokenAddress: string): Promise<string> {
    const chainConfig = this.getChainConfig(chainId);
    if (!chainConfig) {
      throw new Error(`Chain ${chainId} is not supported`);
    }

    try {
      const provider = this.providers.get(chainId);
      if (!provider) {
        throw new Error(`Provider for chain ${chainId} not found`);
      }

      try {
        const contract = new ethers.Contract(
          tokenAddress,
          ['function balanceOf(address) view returns (uint256)'],
          provider
        );

        const balance = await contract.balanceOf(chainConfig.bridgeAddress);
        return ethers.utils.formatEther(balance);
      } catch {
        return '0.0';
      }
    } catch (error) {
      throw new Error(`Failed to get bridge balance: ${error}`);
    }
  }

  public async getCrossChainStats(): Promise<{
    totalTransfers: number;
    successfulTransfers: number;
    totalVolume: string;
    averageTransferTime: number;
    chainStats: { [chainId: number]: { transfers: number; volume: string } };
  }> {
    try {
      return await this.bridgeService.getBridgeStats();
    } catch (error) {
      throw new Error(`Failed to get cross-chain stats: ${error}`);
    }
  }
}
