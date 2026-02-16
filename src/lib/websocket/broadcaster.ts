/**
 * WebSocket Event Broadcaster
 *
 * Utility for broadcasting real-time events to WebSocket connections.
 * Queries DynamoDB for job-specific connections and uses API Gateway Management API
 * to send messages to connected clients.
 */

import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';

// Initialize AWS clients
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

// Environment variables
const CONNECTIONS_TABLE = 'snapspot-websocket-connections';
const WEBSOCKET_ENDPOINT = process.env.WEBSOCKET_API_ENDPOINT!; // e.g., https://abc123.execute-api.us-east-1.amazonaws.com/production

// Initialize API Gateway Management API client for sending messages
const apigwClient = new ApiGatewayManagementApiClient({
  endpoint: WEBSOCKET_ENDPOINT,
});

//
// ============================================================================
// EVENT SCHEMAS - Define all WebSocket event types
// ============================================================================
//

/**
 * UPLOAD_CREATED Event
 * Triggered when a helper uploads a new photo/video
 */
export const UploadCreatedEventSchema = z.object({
  type: z.literal('UPLOAD_CREATED'),
  payload: z.object({
    jobId: z.string().uuid(),
    upload: z.object({
      id: z.string().uuid(),
      s3Key: z.string(),
      fileName: z.string(),
      fileType: z.string(), // MIME type
      fileSize: z.number(),
      uploadedAt: z.string().datetime(), // ISO 8601
      uploadedBy: z.string(), // User name
    }),
  }),
});

/**
 * JOB_STATUS_CHANGED Event
 * Triggered when job status transitions (IN_PROGRESS, IN_REVIEW, COMPLETED)
 */
export const JobStatusChangedEventSchema = z.object({
  type: z.literal('JOB_STATUS_CHANGED'),
  payload: z.object({
    jobId: z.string().uuid(),
    status: z.enum(['IN_PROGRESS', 'IN_REVIEW', 'COMPLETED']),
    submittedAt: z.string().datetime().optional(), // When helper submitted
    completedAt: z.string().datetime().optional(), // When requester approved
  }),
});

/**
 * UPLOAD_PROGRESS Event
 * Triggered when helper starts uploading (shows "uploading..." indicator)
 */
export const UploadProgressEventSchema = z.object({
  type: z.literal('UPLOAD_PROGRESS'),
  payload: z.object({
    jobId: z.string().uuid(),
    userId: z.string().uuid(),
    userName: z.string(),
    isUploading: z.boolean(), // true = start, false = done/cancelled
  }),
});

/**
 * USER_PRESENCE Event
 * Triggered when user joins/leaves job (online/offline status)
 */
export const UserPresenceEventSchema = z.object({
  type: z.literal('USER_PRESENCE'),
  payload: z.object({
    jobId: z.string().uuid(),
    userId: z.string().uuid(),
    userName: z.string(),
    role: z.enum(['REQUESTER', 'HELPER']),
    status: z.enum(['online', 'offline']),
    timestamp: z.string().datetime(),
  }),
});

/**
 * MESSAGE_CREATED Event
 * Triggered when a message is posted to job chat
 */
export const MessageCreatedEventSchema = z.object({
  type: z.literal('MESSAGE_CREATED'),
  payload: z.object({
    jobId: z.string().uuid(),
    message: z.object({
      id: z.string().uuid(),
      content: z.string(),
      userId: z.string().uuid(),
      userName: z.string(),
      createdAt: z.string().datetime(),
    }),
  }),
});

/**
 * Union type of all possible WebSocket events
 */
export type WebSocketEvent =
  | z.infer<typeof UploadCreatedEventSchema>
  | z.infer<typeof JobStatusChangedEventSchema>
  | z.infer<typeof UploadProgressEventSchema>
  | z.infer<typeof UserPresenceEventSchema>
  | z.infer<typeof MessageCreatedEventSchema>;

//
// ============================================================================
// BROADCASTER FUNCTION
// ============================================================================
//

/**
 * Broadcast event to all WebSocket connections subscribed to a job
 *
 * This function:
 * 1. Queries DynamoDB for all connections associated with the jobId
 * 2. Sends the event to each connection via API Gateway Management API
 * 3. Removes stale connections (410 Gone errors)
 * 4. Logs results for monitoring
 *
 * @param jobId - UUID of the job (room)
 * @param event - WebSocket event to broadcast (validated against schemas)
 *
 * @example
 * ```ts
 * await broadcastToJob(jobId, {
 *   type: 'UPLOAD_CREATED',
 *   payload: {
 *     jobId,
 *     upload: {
 *       id: upload.id,
 *       s3Key: upload.s3Key,
 *       fileName: upload.fileName,
 *       fileType: upload.fileType,
 *       fileSize: upload.fileSize,
 *       uploadedAt: upload.uploadedAt.toISOString(),
 *       uploadedBy: upload.uploader.name || 'Unknown',
 *     },
 *   },
 * });
 * ```
 */
export async function broadcastToJob(jobId: string, event: WebSocketEvent): Promise<void> {
  // Validate environment variable is set
  if (!WEBSOCKET_ENDPOINT) {
    console.error('WEBSOCKET_API_ENDPOINT environment variable not set. Cannot broadcast.');
    // Don't throw - fail gracefully so API routes still work without WebSocket
    return;
  }

  try {
    // Query DynamoDB for all connections subscribed to this job
    const result = await ddb.send(new QueryCommand({
      TableName: CONNECTIONS_TABLE,
      IndexName: 'jobId-index',
      KeyConditionExpression: 'jobId = :jobId',
      ExpressionAttributeValues: {
        ':jobId': jobId,
      },
    }));

    const connections = result.Items || [];

    // No active connections - skip broadcasting
    if (connections.length === 0) {
      console.log(`[WebSocket] No active connections for job ${jobId}. Event not broadcast.`);
      return;
    }

    console.log(`[WebSocket] Broadcasting ${event.type} to ${connections.length} connection(s) for job ${jobId}`);

    // Send message to all connections
    const sendPromises = connections.map(async (connection) => {
      const connectionId = connection.connectionId as string;

      try {
        await apigwClient.send(new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: Buffer.from(JSON.stringify(event)),
        }));

        console.log(`[WebSocket] ✓ Sent to connection ${connectionId}`);

      } catch (error: any) {
        // Handle stale connections (410 Gone = connection no longer exists)
        if (error.statusCode === 410 || error.name === 'GoneException') {
          console.log(`[WebSocket] ⚠ Stale connection detected: ${connectionId}. Removing from DynamoDB.`);

          // Remove stale connection from DynamoDB
          await ddb.send(new DeleteCommand({
            TableName: CONNECTIONS_TABLE,
            Key: { connectionId },
          }));

        } else {
          // Log other errors but don't fail the broadcast
          console.error(`[WebSocket] ✗ Failed to send to ${connectionId}:`, error);
        }
      }
    });

    // Wait for all send operations to complete (settled, not rejected)
    const results = await Promise.allSettled(sendPromises);

    // Log summary
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[WebSocket] Broadcast complete: ${successful} successful, ${failed} failed`);

  } catch (error) {
    console.error('[WebSocket] Broadcast error:', error);
    // Don't throw - fail gracefully so API routes still work
  }
}

/**
 * Helper: Validate event against schema before broadcasting
 * Useful for ensuring type safety and catching schema errors early
 */
export function validateEvent(event: unknown): WebSocketEvent {
  // Try each schema until one matches
  const schemas = [
    UploadCreatedEventSchema,
    JobStatusChangedEventSchema,
    UploadProgressEventSchema,
    UserPresenceEventSchema,
    MessageCreatedEventSchema,
  ];

  for (const schema of schemas) {
    const result = schema.safeParse(event);
    if (result.success) {
      return result.data;
    }
  }

  throw new Error('Invalid WebSocket event: does not match any known schema');
}
