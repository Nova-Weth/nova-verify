import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';

// Create a test app that mirrors the auth routes
const app = express();
app.use(express.json());

// Mock user storage (same as auth routes)
const users: Array<{
  id: number;
  email: string;
  password: string;
  stellarAddress: string;
  createdAt: string;
  twoFactorEnabled?: boolean;
  refreshTokens?: string[];
}> = [];

// Register endpoint
app.post('/api/auth/register', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('stellarAddress').isLength({ min: 56 }).withMessage('Valid Stellar address is required')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, stellarAddress } = req.body;

  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const user = {
    id: users.length + 1,
    email,
    password,
    stellarAddress,
    createdAt: new Date().toISOString()
  };

  users.push(user);

  const token = jwt.sign({ userId: user.id }, 'test-jwt-secret', { expiresIn: '1h' });
  const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, 'test-refresh-secret', { expiresIn: '7d' });

  user.refreshTokens = [refreshToken];

  res.status(201).json({
    success: true,
    token,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      stellarAddress: user.stellarAddress
    }
  });
});

// Login endpoint
app.post('/api/auth/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user.id }, 'test-jwt-secret', { expiresIn: '1h' });
  const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, 'test-refresh-secret', { expiresIn: '7d' });

  user.refreshTokens = user.refreshTokens || [];
  user.refreshTokens.push(refreshToken);

  res.json({
    success: true,
    token,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      stellarAddress: user.stellarAddress
    }
  });
});

// Refresh token endpoint
app.post('/api/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, 'test-refresh-secret') as { userId: number; type: string };

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = users.find(u => u.id === decoded.userId);
    if (!user || !user.refreshTokens?.includes(refreshToken)) {
      return res.status(401).json({ error: 'Invalid or revoked refresh token' });
    }

    const newToken = jwt.sign({ userId: user.id }, 'test-jwt-secret', { expiresIn: '1h' });
    const newRefreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, 'test-refresh-secret', { expiresIn: '7d' });

    // Rotate refresh tokens
    user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);
    user.refreshTokens.push(newRefreshToken);

    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Auth middleware protected route
const authMiddleware = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, 'test-jwt-secret') as { userId: number };
    req.user = { id: decoded.userId };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

app.get('/api/auth/me', authMiddleware, (req: any, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      stellarAddress: user.stellarAddress
    }
  });
});

app.post('/api/auth/logout', authMiddleware, (req: any, res) => {
  const { refreshToken } = req.body;
  const user = users.find(u => u.id === req.user.id);
  if (user && refreshToken) {
    user.refreshTokens = (user.refreshTokens || []).filter(t => t !== refreshToken);
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

describe('Auth Routes Integration Tests', () => {
  // Clear users before each test
  beforeEach(() => {
    users.length = 0;
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          stellarAddress: 'G'.repeat(56)
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.stellarAddress).toBe('G'.repeat(56));
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          password: 'password123',
          stellarAddress: 'G'.repeat(56)
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          stellarAddress: 'G'.repeat(56)
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 for short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: '12345',
          stellarAddress: 'G'.repeat(56)
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 for invalid stellar address length', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          stellarAddress: 'G'.repeat(30)
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 when user already exists', async () => {
      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'password123',
          stellarAddress: 'G'.repeat(56)
        });

      // Try to register again
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'password456',
          stellarAddress: 'G'.repeat(56)
        })
        .expect(400);

      expect(response.body.error).toBe('User already exists');
    });

    it('should return different tokens for different users', async () => {
      const res1 = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user1@example.com',
          password: 'password123',
          stellarAddress: 'G'.repeat(56)
        });

      const res2 = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user2@example.com',
          password: 'password456',
          stellarAddress: 'G'.repeat(56)
        });

      expect(res1.body.token).not.toBe(res2.body.token);
      expect(res1.body.user.id).not.toBe(res2.body.user.id);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Register a user first
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'login-test@example.com',
          password: 'password123',
          stellarAddress: 'G'.repeat(56)
        });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'password123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user.email).toBe('login-test@example.com');
    });

    it('should return 401 for invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return 401 for non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123'
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login-test@example.com'
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should generate a new refresh token on each login', async () => {
      const res1 = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'password123'
        });

      const res2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'password123'
        });

      // Tokens should be different for each login
      expect(res1.body.token).not.toBe(res2.body.token);
      expect(res1.body.refreshToken).not.toBe(res2.body.refreshToken);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'refresh-test@example.com',
          password: 'password123',
          stellarAddress: 'G'.repeat(56)
        });
      refreshToken = res.body.refreshToken;
    });

    it('should refresh token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.refreshToken).not.toBe(refreshToken); // Token rotated
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Refresh token is required');
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.error).toBe('Invalid refresh token');
    });

    it('should invalidate old refresh token after use', async () => {
      // Use the refresh token once
      const res1 = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      // Try to use the same (now invalid) refresh token again
      const res2 = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(res2.body.error).toBe('Invalid or revoked refresh token');
    });

    it('should allow using the new refresh token', async () => {
      const res1 = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      const newRefreshToken = res1.body.refreshToken;

      const res2 = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: newRefreshToken })
        .expect(200);

      expect(res2.body.success).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    let token: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'me-test@example.com',
          password: 'password123',
          stellarAddress: 'G'.repeat(56)
        });
      token = res.body.token;
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('me-test@example.com');
    });

    it('should return 401 with no token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should return 401 with malformed auth header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });

    it('should return 401 with expired token', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: 1 },
        'test-jwt-secret',
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error).toBe('Invalid or expired token');
    });
  });

  describe('POST /api/auth/logout', () => {
    let token: string;
    let refreshToken: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'logout-test@example.com',
          password: 'password123',
          stellarAddress: 'G'.repeat(56)
        });
      token = res.body.token;
      refreshToken = res.body.refreshToken;
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should invalidate refresh token on logout', async () => {
      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken });

      // Try to use the refresh token
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.error).toBe('Invalid or revoked refresh token');
    });
  });
});

// Edge case tests
describe('Auth Routes Edge Cases', () => {
  beforeEach(() => {
    users.length = 0;
  });

  it('should handle special characters in email', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user+tag@example.com',
        password: 'password123',
        stellarAddress: 'G'.repeat(56)
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.user.email).toBe('user+tag@example.com');
  });

  it('should handle long stellar addresses', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'stellar@example.com',
        password: 'password123',
        stellarAddress: 'G'.repeat(100)
      })
      .expect(201);

    expect(response.body.success).toBe(true);
  });

  it('should reject empty request body', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({})
      .expect(400);

    expect(response.body.errors).toBeDefined();
  });

  it('should handle concurrent registrations', async () => {
    const registrations = Array(10).fill(null).map((_, i) =>
      request(app)
        .post('/api/auth/register')
        .send({
          email: `bulk${i}@example.com`,
          password: 'password123',
          stellarAddress: 'G'.repeat(56)
        })
    );

    const results = await Promise.all(registrations);

    results.forEach((res) => {
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    expect(users.length).toBe(10);
  });

  it('should include user ID not password in token payload', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'secure@example.com',
        password: 'securePassword123',
        stellarAddress: 'G'.repeat(56)
      });

    const decoded = jwt.decode(res.body.token) as any;
    expect(decoded.userId).toBeDefined();
    expect(decoded.password).toBeUndefined();
    expect(decoded.email).toBeUndefined();
  });
});
