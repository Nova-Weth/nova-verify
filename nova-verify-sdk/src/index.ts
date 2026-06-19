import { ProofService } from './proof';
import { VerificationService } from './verification';
import { WalletService } from './wallet';
import { Nova VerifyError } from './errors';
import { Config } from './utils';

/**
 * Nova Verify SDK Client
 * Main entry point for the Nova Verify JavaScript/TypeScript SDK
 */
export class Nova Verify {
  public readonly proof: ProofService;
  public readonly verification: VerificationService;
  public readonly wallet: WalletService;
  public readonly config: Config;

  /**
   * Create a new Nova Verify SDK instance
   * @param options - Configuration options
   */
  constructor(options: Nova VerifyOptions = {}) {
    this.config = new Config(options);
    this.proof = new ProofService(this.config);
    this.verification = new VerificationService(this.config);
    this.wallet = new WalletService(this.config);
  }

  /**
   * Initialize the SDK with configuration
   * @param options - Configuration options
   * @returns Nova Verify instance
   */
  static init(options: Nova VerifyOptions = {}): Nova Verify {
    return new Nova Verify(options);
  }

  /**
   * Get SDK version
   * @returns SDK version string
   */
  static get version(): string {
    return '1.0.0';
  }

  /**
   * Check if SDK is properly configured
   * @returns boolean indicating if SDK is ready
   */
  public isReady(): boolean {
    try {
      return this.config.validate();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current configuration
   * @returns Current configuration
   */
  public getConfig(): Nova VerifyOptions {
    return this.config.getOptions();
  }

  /**
   * Update configuration
   * @param options - New configuration options
   */
  public updateConfig(options: Partial<Nova VerifyOptions>): void {
    this.config.update(options);
  }
}

/**
 * Nova Verify SDK Configuration Options
 */
export interface Nova VerifyOptions {
  /**
   * API endpoint URL
   * @default 'https://api.nova-verify.com'
   */
  apiEndpoint?: string;

  /**
   * Network type
   * @default 'mainnet'
   */
  network?: 'mainnet' | 'testnet';

  /**
   * API key for authentication
   */
  apiKey?: string;

  /**
   * Timeout for API requests in milliseconds
   * @default 10000
   */
  timeout?: number;

  /**
   * Retry configuration
   */
  retry?: {
    maxAttempts?: number;
    delay?: number;
    backoffMultiplier?: number;
  };

  /**
   * Wallet configuration
   */
  wallet?: {
    autoConnect?: boolean;
    supportedWallets?: string[];
  };

  /**
   * Logging configuration
   */
  logging?: {
    enabled?: boolean;
    level?: 'debug' | 'info' | 'warn' | 'error';
  };
}

// Export core types and interfaces
export * from './proof';
export * from './verification';
export * from './wallet';
export * from './errors';
export * from './utils';

// Export default instance for convenience
export default Nova Verify;