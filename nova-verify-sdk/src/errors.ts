/**
 * Base error class for Nova Verify SDK
 */
export class Nova VerifyError extends Error {
  public readonly code: string;
  public readonly details?: any;
  public readonly timestamp: Date;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'Nova VerifyError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    
    // Maintains proper stack trace for where our error was thrown
    Object.setPrototypeOf(this, Nova VerifyError.prototype);
  }

  /**
   * Convert error to JSON
   */
  public toJSON(): Nova VerifyErrorJSON {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp.toISOString()
    };
  }

  /**
   * Create error from JSON
   */
  public static fromJSON(json: Nova VerifyErrorJSON): Nova VerifyError {
    const error = new Nova VerifyError(json.message, json.code, json.details);
    (error as any).timestamp = new Date(json.timestamp);
    return error;
  }
}

/**
 * Network error - issues with API connectivity
 */
export class NetworkError extends Nova VerifyError {
  constructor(message: string, details?: any) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

/**
 * Authentication error - invalid API key or credentials
 */
export class AuthenticationError extends Nova VerifyError {
  constructor(message: string, details?: any) {
    super(message, 'AUTHENTICATION_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Validation error - invalid input parameters
 */
export class ValidationError extends Nova VerifyError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Proof error - issues with proof creation or verification
 */
export class ProofError extends Nova VerifyError {
  constructor(message: string, details?: any) {
    super(message, 'PROOF_ERROR', details);
    this.name = 'ProofError';
  }
}

/**
 * Wallet error - issues with wallet connection or operations
 */
export class WalletError extends Nova VerifyError {
  constructor(message: string, details?: any) {
    super(message, 'WALLET_ERROR', details);
    this.name = 'WalletError';
  }
}

/**
 * Blockchain error - issues with blockchain operations
 */
export class BlockchainError extends Nova VerifyError {
  constructor(message: string, details?: any) {
    super(message, 'BLOCKCHAIN_ERROR', details);
    this.name = 'BlockchainError';
  }
}

/**
 * Timeout error - operation exceeded time limit
 */
export class TimeoutError extends Nova VerifyError {
  constructor(message: string, details?: any) {
    super(message, 'TIMEOUT_ERROR', details);
    this.name = 'TimeoutError';
  }
}

/**
 * Rate limit error - too many requests
 */
export class RateLimitError extends Nova VerifyError {
  constructor(message: string, details?: any) {
    super(message, 'RATE_LIMIT_ERROR', details);
    this.name = 'RateLimitError';
  }
}

/**
 * Server error - internal server issues
 */
export class ServerError extends Nova VerifyError {
  constructor(message: string, details?: any) {
    super(message, 'SERVER_ERROR', details);
    this.name = 'ServerError';
  }
}

/**
 * Not found error - resource not found
 */
export class NotFoundError extends Nova VerifyError {
  constructor(message: string, details?: any) {
    super(message, 'NOT_FOUND_ERROR', details);
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict error - resource conflict
 */
export class ConflictError extends Nova VerifyError {
  constructor(message: string, details?: any) {
    super(message, 'CONFLICT_ERROR', details);
    this.name = 'ConflictError';
  }
}

/**
 * Error factory for creating appropriate error instances
 */
export class ErrorFactory {
  /**
   * Create error based on HTTP status code
   */
  public static fromHttpStatus(status: number, message: string, details?: any): Nova VerifyError {
    switch (status) {
      case 400:
        return new ValidationError(message, details);
      case 401:
      case 403:
        return new AuthenticationError(message, details);
      case 404:
        return new NotFoundError(message, details);
      case 409:
        return new ConflictError(message, details);
      case 429:
        return new RateLimitError(message, details);
      case 500:
      case 502:
      case 503:
      case 504:
        return new ServerError(message, details);
      default:
        return new Nova VerifyError(message, 'UNKNOWN_ERROR', details);
    }
  }

  /**
   * Create network error
   */
  public static network(message: string, details?: any): NetworkError {
    return new NetworkError(message, details);
  }

  /**
   * Create validation error
   */
  public static validation(message: string, details?: any): ValidationError {
    return new ValidationError(message, details);
  }

  /**
   * Create proof error
   */
  public static proof(message: string, details?: any): ProofError {
    return new ProofError(message, details);
  }

  /**
   * Create wallet error
   */
  public static wallet(message: string, details?: any): WalletError {
    return new WalletError(message, details);
  }

  /**
   * Create blockchain error
   */
  public static blockchain(message: string, details?: any): BlockchainError {
    return new BlockchainError(message, details);
  }
}

/**
 * Error handling utilities
 */
export class ErrorHandler {
  /**
   * Wrap async function with error handling
   */
  public static async wrap<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof Nova VerifyError) {
        throw error;
      }
      
      // Convert unknown errors to Nova VerifyError
      if (error instanceof Error) {
        throw new Nova VerifyError(error.message, 'UNKNOWN_ERROR', { originalError: error });
      }
      
      throw new Nova VerifyError('Unknown error occurred', 'UNKNOWN_ERROR', { error });
    }
  }

  /**
   * Handle Axios error and convert to appropriate Nova VerifyError
   */
  public static handleAxiosError(error: any): Nova VerifyError {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      const message = data?.message || error.message || 'Request failed';
      return ErrorFactory.fromHttpStatus(status, message, data);
    } else if (error.request) {
      // Request was made but no response received
      return new NetworkError('No response received from server', { 
        request: error.request,
        config: error.config 
      });
    } else {
      // Something happened in setting up the request
      return new Nova VerifyError(error.message, 'REQUEST_SETUP_ERROR', { 
        config: error.config 
      });
    }
  }

  /**
   * Log error with context
   */
  public static logError(error: Nova VerifyError, context?: string): void {
    console.error(`[Nova Verify SDK] ${context ? `${context}: ` : ''}${error.name}: ${error.message}`, {
      code: error.code,
      timestamp: error.timestamp,
      details: error.details
    });
  }
}

// Type definitions
export interface Nova VerifyErrorJSON {
  name: string;
  message: string;
  code: string;
  details?: any;
  timestamp: string;
}