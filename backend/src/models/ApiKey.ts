import mongoose, { Document, Schema } from 'mongoose';

/**
 * Available API key permission scopes
 */
export type ApiKeyPermission =
  | 'read:proofs'
  | 'write:proofs'
  | 'read:analytics'
  | 'read:users'
  | 'write:users'
  | 'read:webhooks'
  | 'write:webhooks'
  | 'admin';

/**
 * API Key document interface
 */
export interface IApiKey extends Document {
  id: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  ownerId: string;
  permissions: ApiKeyPermission[];
  rateLimit: number; // requests per minute
  requestCount: number;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  isRevoked: boolean;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 100,
  },
  keyHash: {
    type: String,
    required: true,
    unique: true,
  },
  keyPrefix: {
    type: String,
    required: true,
  },
  ownerId: {
    type: String,
    required: true,
    index: true,
  },
  permissions: {
    type: [String],
    required: true,
    validate: {
      validator: (perms: string[]) => perms.length > 0,
      message: 'At least one permission is required',
    },
  },
  rateLimit: {
    type: Number,
    default: 60,
    min: 1,
    max: 1000,
  },
  requestCount: {
    type: Number,
    default: 0,
  },
  lastUsedAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
  isRevoked: {
    type: Boolean,
    default: false,
    index: true,
  },
  revokedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for efficient lookups
ApiKeySchema.index({ ownerId: 1, isRevoked: 1 });
ApiKeySchema.index({ keyHash: 1 });
ApiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to update timestamps
ApiKeySchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const ApiKey = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
