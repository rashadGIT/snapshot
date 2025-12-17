/**
 * Shared TypeScript Types
 */

import type { User, Job, Assignment, Message, Upload, Rating, JobStatus, UserRole } from '@prisma/client';

export type { User, Job, Assignment, Message, Upload, Rating, JobStatus, UserRole };

/**
 * Job with relations for display
 */
export type JobWithDetails = Job & {
  requester: User;
  assignments: (Assignment & { helper: User })[];
  messages: (Message & { user: User })[];
  uploads: Upload[];
  ratings: Rating[];
};

/**
 * User with ratings for display
 */
export type UserWithRatings = User & {
  ratingsReceived: Rating[];
};

/**
 * Client-side user state
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole | null;
}

/**
 * API response types
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
