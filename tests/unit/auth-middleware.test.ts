import { describe, it, expect } from 'vitest';
import {
  unauthorizedResponse,
  forbiddenResponse,
  badRequestResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/auth/middleware';

/**
 * Auth Middleware Helpers Unit Tests
 * Tests response helper functions
 */

describe('Auth Middleware Helpers', () => {
  describe('unauthorizedResponse', () => {
    it('should return 401 status', async () => {
      const response = unauthorizedResponse();

      expect(response.status).toBe(401);
    });

    it('should have default message', async () => {
      const response = unauthorizedResponse();
      const body = await response.json();

      expect(body.error).toBe('Unauthorized');
    });

    it('should accept custom message', async () => {
      const response = unauthorizedResponse('Invalid token');
      const body = await response.json();

      expect(body.error).toBe('Invalid token');
    });

    it('should return JSON response', async () => {
      const response = unauthorizedResponse();

      expect(response.headers.get('content-type')).toContain('application/json');
    });
  });

  describe('forbiddenResponse', () => {
    it('should return 403 status', async () => {
      const response = forbiddenResponse();

      expect(response.status).toBe(403);
    });

    it('should have default message', async () => {
      const response = forbiddenResponse();
      const body = await response.json();

      expect(body.error).toBe('Forbidden');
    });

    it('should accept custom message', async () => {
      const response = forbiddenResponse('Insufficient permissions');
      const body = await response.json();

      expect(body.error).toBe('Insufficient permissions');
    });

    it('should return JSON response', async () => {
      const response = forbiddenResponse();

      expect(response.headers.get('content-type')).toContain('application/json');
    });
  });

  describe('badRequestResponse', () => {
    it('should return 400 status', async () => {
      const response = badRequestResponse('Invalid input');

      expect(response.status).toBe(400);
    });

    it('should include custom message', async () => {
      const response = badRequestResponse('Missing required field: title');
      const body = await response.json();

      expect(body.error).toBe('Missing required field: title');
    });

    it('should return JSON response', async () => {
      const response = badRequestResponse('Test error');

      expect(response.headers.get('content-type')).toContain('application/json');
    });
  });

  describe('notFoundResponse', () => {
    it('should return 404 status', async () => {
      const response = notFoundResponse();

      expect(response.status).toBe(404);
    });

    it('should have default message', async () => {
      const response = notFoundResponse();
      const body = await response.json();

      expect(body.error).toBe('Not found');
    });

    it('should accept custom message', async () => {
      const response = notFoundResponse('Job not found');
      const body = await response.json();

      expect(body.error).toBe('Job not found');
    });

    it('should return JSON response', async () => {
      const response = notFoundResponse();

      expect(response.headers.get('content-type')).toContain('application/json');
    });
  });

  describe('serverErrorResponse', () => {
    it('should return 500 status', async () => {
      const response = serverErrorResponse();

      expect(response.status).toBe(500);
    });

    it('should have default message', async () => {
      const response = serverErrorResponse();
      const body = await response.json();

      expect(body.error).toBe('Internal server error');
    });

    it('should accept custom message', async () => {
      const response = serverErrorResponse('Database connection failed');
      const body = await response.json();

      expect(body.error).toBe('Database connection failed');
    });

    it('should return JSON response', async () => {
      const response = serverErrorResponse();

      expect(response.headers.get('content-type')).toContain('application/json');
    });
  });

  describe('Response helpers consistency', () => {
    it('should all return Response objects', () => {
      const responses = [
        unauthorizedResponse(),
        forbiddenResponse(),
        badRequestResponse('test'),
        notFoundResponse(),
        serverErrorResponse(),
      ];

      responses.forEach(response => {
        expect(response).toBeInstanceOf(Response);
      });
    });

    it('should all have error property in body', async () => {
      const responses = [
        unauthorizedResponse(),
        forbiddenResponse(),
        badRequestResponse('test'),
        notFoundResponse(),
        serverErrorResponse(),
      ];

      for (const response of responses) {
        const body = await response.json();
        expect(body).toHaveProperty('error');
        expect(typeof body.error).toBe('string');
      }
    });

    it('should all return JSON content type', () => {
      const responses = [
        unauthorizedResponse(),
        forbiddenResponse(),
        badRequestResponse('test'),
        notFoundResponse(),
        serverErrorResponse(),
      ];

      responses.forEach(response => {
        expect(response.headers.get('content-type')).toContain('application/json');
      });
    });

    it('should have unique status codes', () => {
      const statusCodes = [
        unauthorizedResponse().status,
        forbiddenResponse().status,
        badRequestResponse('test').status,
        notFoundResponse().status,
        serverErrorResponse().status,
      ];

      const uniqueCodes = new Set(statusCodes);
      expect(uniqueCodes.size).toBe(statusCodes.length);
    });
  });
});
