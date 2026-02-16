/**
 * WebSocket Join Job Handler
 *
 * Associates a WebSocket connection with a specific job (room).
 * This enables job-specific broadcasting where only users viewing
 * a particular job receive relevant real-time updates.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

// Initialize API Gateway Management client for broadcasting
const apiGatewayClient = new ApiGatewayManagementApiClient({
  endpoint: process.env.WEBSOCKET_API_ENDPOINT,
});

// Environment variables
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;

/**
 * Handler for WebSocket joinJob action
 *
 * Expects message body: { action: "joinJob", jobId: "uuid" }
 *
 * @param event - API Gateway WebSocket message event
 * @returns Join response (200 = success, 400 = bad request, 500 = error)
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId!;

  console.log(`Join job request from connection: ${connectionId}`);

  try {
    // Parse message body
    const body = JSON.parse(event.body || '{}');
    const { jobId } = body;

    // Validate jobId
    if (!jobId || typeof jobId !== 'string') {
      console.error('Invalid or missing jobId in request body');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing or invalid jobId parameter' })
      };
    }

    console.log(`Joining job: ${jobId}`);

    // Get current connection details to extract user info
    const getResult = await ddb.send(new GetCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId },
    }));

    const connection = getResult.Item;
    if (!connection) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Connection not found. Reconnect first.' })
      };
    }

    // Update connection record with jobId (creates "room" association)
    await ddb.send(new UpdateCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId },
      UpdateExpression: 'SET jobId = :jobId, joinedJobAt = :now',
      ExpressionAttributeValues: {
        ':jobId': jobId,
        ':now': new Date().toISOString(),
      },
      ConditionExpression: 'attribute_exists(connectionId)',
    }));

    console.log(`Connection ${connectionId} successfully joined job ${jobId}`);

    // Broadcast USER_PRESENCE event to all connections in this job
    try {
      const queryResult = await ddb.send(new QueryCommand({
        TableName: CONNECTIONS_TABLE,
        IndexName: 'jobId-index',
        KeyConditionExpression: 'jobId = :jobId',
        ExpressionAttributeValues: {
          ':jobId': jobId,
        },
      }));

      const connections = queryResult.Items || [];
      const presenceEvent = {
        type: 'USER_PRESENCE',
        payload: {
          jobId,
          userId: connection.userId,
          userName: connection.name || connection.email || 'Unknown User',
          role: connection.role || 'UNKNOWN',
          status: 'online',
          timestamp: new Date().toISOString(),
        },
      };

      const broadcastPromises = connections.map(async (conn) => {
        try {
          await apiGatewayClient.send(new PostToConnectionCommand({
            ConnectionId: conn.connectionId,
            Data: Buffer.from(JSON.stringify(presenceEvent)),
          }));
        } catch (error: any) {
          if (error.statusCode === 410) {
            // Stale connection, clean up
            console.log(`Removing stale connection: ${conn.connectionId}`);
            await ddb.send(new UpdateCommand({
              TableName: CONNECTIONS_TABLE,
              Key: { connectionId: conn.connectionId },
              UpdateExpression: 'REMOVE jobId',
            }));
          } else {
            console.error(`Failed to broadcast to ${conn.connectionId}:`, error);
          }
        }
      });

      await Promise.allSettled(broadcastPromises);
      console.log(`Broadcasted USER_PRESENCE to ${connections.length} connections`);
    } catch (broadcastError) {
      console.error('Failed to broadcast presence:', broadcastError);
      // Don't fail the joinJob request if broadcast fails
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully joined job',
        jobId,
      })
    };

  } catch (error) {
    console.error('Join job error:', error);

    // Log error details
    if (error instanceof Error) {
      console.error('Error details:', error.message);

      // Handle connection not found
      if (error.name === 'ConditionalCheckFailedException') {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Connection not found. Reconnect first.' })
        };
      }
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to join job' })
    };
  }
};
