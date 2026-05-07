import { PubSub } from 'graphql-subscriptions';
import { proofSubscriptions, PROOF_UPDATED, PROOF_CREATED, PROOF_STATUS_CHANGED } from '../subscriptions/proofSubscription';
import { Proof, ProofStatus } from '../../types';

// Mock PubSub for testing
jest.mock('graphql-subscriptions', () => ({
  PubSub: jest.fn().mockImplementation(() => ({
    asyncIterator: jest.fn().mockReturnValue(Symbol('iterator')),
    publish: jest.fn(),
  })),
}));

// Capture the instance created when proofSubscription.ts is imported
const PubSubMock = PubSub as jest.Mock;
const pubsubInstance = PubSubMock.mock.instances[0];
const mockAsyncIterator = pubsubInstance?.asyncIterator as jest.Mock;

describe('Proof Subscriptions', () => {
  beforeEach(() => {
    if (mockAsyncIterator) {
      mockAsyncIterator.mockClear();
      mockAsyncIterator.mockReturnValue(Symbol('iterator'));
    }
  });

  describe('proofUpdated subscription', () => {
    it('should subscribe to proof updates', async () => {
      const result = proofSubscriptions.proofUpdated.subscribe(null, {});
      expect(result).toBeDefined();
    });

    it('should filter by userId when provided', async () => {
      const mockProof: Proof = {
        id: '1',
        userId: '1',
        title: 'Test Proof',
        description: 'Test Description',
        status: ProofStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = proofSubscriptions.proofUpdated.resolve(
        { proof: mockProof },
        { userId: '1' }
      );

      expect(result).toEqual(mockProof);
    });

    it('should return null when userId filter does not match', async () => {
      const mockProof: Proof = {
        id: '1',
        userId: '1',
        title: 'Test Proof',
        description: 'Test Description',
        status: ProofStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = proofSubscriptions.proofUpdated.resolve(
        { proof: mockProof },
        { userId: '2' }
      );

      expect(result).toBeNull();
    });
  });

  describe('proofCreated subscription', () => {
    it('should subscribe to proof creation', async () => {
      const result = proofSubscriptions.proofCreated.subscribe();
      expect(result).toBeDefined();
    });

    it('should resolve proof creation events', async () => {
      const mockProof: Proof = {
        id: '1',
        userId: '1',
        title: 'Test Proof',
        description: 'Test Description',
        status: ProofStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = proofSubscriptions.proofCreated.resolve({ proof: mockProof });

      expect(result).toEqual(mockProof);
    });
  });

  describe('proofStatusChanged subscription', () => {
    it('should subscribe to proof status changes', async () => {
      const result = proofSubscriptions.proofStatusChanged.subscribe(null, {});
      expect(result).toBeDefined();
    });

    it('should filter by status when provided', async () => {
      const mockProof: Proof = {
        id: '1',
        userId: '1',
        title: 'Test Proof',
        description: 'Test Description',
        status: ProofStatus.VERIFIED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = proofSubscriptions.proofStatusChanged.resolve(
        { proof: mockProof },
        { status: ProofStatus.VERIFIED }
      );

      expect(result).toEqual(mockProof);
    });

    it('should return null when status filter does not match', async () => {
      const mockProof: Proof = {
        id: '1',
        userId: '1',
        title: 'Test Proof',
        description: 'Test Description',
        status: ProofStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = proofSubscriptions.proofStatusChanged.resolve(
        { proof: mockProof },
        { status: ProofStatus.VERIFIED }
      );

      expect(result).toBeNull();
    });
  });
});
