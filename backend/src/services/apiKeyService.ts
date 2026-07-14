import crypto from 'crypto';
import { ApiKey, IApiKey, ApiKeyPermission } from '../models/ApiKey';

/**
 * API Key Service - Manages API key lifecycle
 */
export class ApiKeyService {
  private readonly KEY_PREFIX = 'nv_sk_';
  private readonly KEY_LENGTH = 48; // Total raw bytes before hex encoding

  /**
   * Generate a new API key
   * Returns the raw key (only shown once) and the hashed version for storage
   */
  generateKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
    const randomBytes = crypto.randomBytes(this.KEY_LENGTH);
    const rawKey = this.KEY_PREFIX + randomBytes.toString('hex');
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 10); // "nv_sk_" + first 4 chars of key

    return { rawKey, keyHash, keyPrefix };
  }

  /**
   * Hash an API key using SHA-256
   */
  hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  /**
   * Create a new API key for a user
   */
  async createApiKey(data: {
    name: string;
    ownerId: string;
    permissions: ApiKeyPermission[];
    rateLimit?: number;
    expiresInDays?: number;
  }): Promise<{ apiKey: IApiKey; rawKey: string }> {
    const { rawKey, keyHash, keyPrefix } = this.generateKey();

    const keyId = this.generateKeyId();
    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const apiKey = new ApiKey({
      id: keyId,
      name: data.name,
      keyHash,
      keyPrefix,
      ownerId: data.ownerId,
      permissions: data.permissions,
      rateLimit: data.rateLimit || 60,
      requestCount: 0,
      lastUsedAt: null,
      expiresAt,
      isRevoked: false,
      revokedAt: null,
    });

    await apiKey.save();

    return { apiKey: apiKey.toObject(), rawKey };
  }

  /**
   * List API keys for a user (does not return keyHash)
   */
  async listApiKeys(ownerId: string): Promise<Partial<IApiKey>[]> {
    const keys = await ApiKey.find({ ownerId })
      .select('-keyHash')
      .sort({ createdAt: -1 })
      .lean();

    return keys.map((key) => ({
      ...key,
      isExpired: key.expiresAt ? new Date(key.expiresAt) < new Date() : false,
    }));
  }

  /**
   * Get a single API key by ID
   */
  async getApiKey(keyId: string, ownerId: string): Promise<IApiKey | null> {
    return ApiKey.findOne({ id: keyId, ownerId }).select('-keyHash').lean();
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string, ownerId: string): Promise<boolean> {
    const result = await ApiKey.updateOne(
      { id: keyId, ownerId, isRevoked: false },
      {
        $set: {
          isRevoked: true,
          revokedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Rotate an API key (revoke old, create new)
   */
  async rotateApiKey(
    keyId: string,
    ownerId: string
  ): Promise<{ apiKey: IApiKey; rawKey: string } | null> {
    const existingKey = await ApiKey.findOne({ id: keyId, ownerId, isRevoked: false });

    if (!existingKey) {
      return null;
    }

    // Revoke the old key
    existingKey.isRevoked = true;
    existingKey.revokedAt = new Date();
    await existingKey.save();

    // Create a new key with same permissions
    const { rawKey, keyHash, keyPrefix } = this.generateKey();
    const newKeyId = this.generateKeyId();

    const newApiKey = new ApiKey({
      id: newKeyId,
      name: `${existingKey.name} (rotated)`,
      keyHash,
      keyPrefix,
      ownerId: existingKey.ownerId,
      permissions: existingKey.permissions,
      rateLimit: existingKey.rateLimit,
      requestCount: 0,
      lastUsedAt: null,
      expiresAt: existingKey.expiresAt,
      isRevoked: false,
      revokedAt: null,
    });

    await newApiKey.save();

    return { apiKey: newApiKey.toObject(), rawKey };
  }

  /**
   * Validate an API key from the X-API-Key header
   * Returns the API key document if valid
   */
  async validateApiKey(rawKey: string): Promise<IApiKey | null> {
    if (!rawKey || !rawKey.startsWith(this.KEY_PREFIX)) {
      return null;
    }

    const keyHash = this.hashKey(rawKey);
    const apiKey = await ApiKey.findOne({ keyHash, isRevoked: false });

    if (!apiKey) {
      return null;
    }

    // Check expiration
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return null;
    }

    // Update usage metrics
    await ApiKey.updateOne(
      { id: apiKey.id },
      {
        $inc: { requestCount: 1 },
        $set: { lastUsedAt: new Date() },
      }
    );

    return apiKey;
  }

  /**
   * Check if an API key has the required permission
   */
  hasPermission(apiKey: IApiKey, permission: ApiKeyPermission): boolean {
    if (apiKey.permissions.includes('admin')) {
      return true;
    }
    return apiKey.permissions.includes(permission);
  }

  /**
   * Update API key details
   */
  async updateApiKey(
    keyId: string,
    ownerId: string,
    updates: {
      name?: string;
      permissions?: ApiKeyPermission[];
      rateLimit?: number;
    }
  ): Promise<IApiKey | null> {
    const allowedUpdates: any = {};

    if (updates.name) allowedUpdates.name = updates.name;
    if (updates.permissions) allowedUpdates.permissions = updates.permissions;
    if (updates.rateLimit) allowedUpdates.rateLimit = updates.rateLimit;

    allowedUpdates.updatedAt = new Date();

    const updated = await ApiKey.findOneAndUpdate(
      { id: keyId, ownerId, isRevoked: false },
      { $set: allowedUpdates },
      { new: true }
    )
      .select('-keyHash')
      .lean();

    return updated;
  }

  /**
   * Clean up expired and revoked keys
   */
  async cleanupKeys(olderThanDays: number = 90): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await ApiKey.deleteMany({
      $or: [
        { isRevoked: true, revokedAt: { $lt: cutoff } },
        { expiresAt: { $lt: new Date() } },
      ],
    });

    return result.deletedCount;
  }

  private generateKeyId(): string {
    return `apikey_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }
}

export const apiKeyService = new ApiKeyService();
