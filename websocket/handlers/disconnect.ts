/**
 * WebSocket Disconnect Handler
 *
 * Removes connection records from DynamoDB when WebSocket connection closes.
 * This ensures clean state and prevents stale connections from receiving messages.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
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
 * Handler for WebSocket $disconnect route
 *
 * @param event - API Gateway WebSocket disconnect event
 * @returns Disconnect response (200 = success, 500 = error)
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId!;

  console.log(`WebSocket disconnect: ${connectionId}`);

  try {
    // Get connection details before deleting (for presence broadcast)
    const getResult = await ddb.send(new GetCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId },
    }));

    const connection = getResult.Item;

    // Remove connection from DynamoDB
    await ddb.send(new DeleteCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId },
    }));

    console.log(`Connection removed successfully: ${connectionId}`);

    // Broadcast USER_PRESENCE offline event if user was in a job
    if (connection && connection.jobId) {
      try {
        const queryResult = await ddb.send(new QueryCommand({
          TableName: CONNECTIONS_TABLE,
          IndexName: 'jobId-index',
          KeyConditionExpression: 'jobId = :jobId',
          ExpressionAttributeValues: {
            ':jobId': connection.jobId,
          },
        }));

        const remainingConnections = queryResult.Items || [];
        const presenceEvent = {
          type: 'USER_PRESENCE',
          payload: {
            jobId: connection.jobId,
            userId: connection.userId,
            userName: connection.name || connection.email || 'Unknown User',
            role: connection.role || 'UNKNOWN',
            status: 'offline',
            timestamp: new Date().toISOString(),
          },
        };

        const broadcastPromises = remainingConnections.map(async (conn) => {
          try {
            await apiGatewayClient.send(new PostToConnectionCommand({
              ConnectionId: conn.connectionId,
              Data: Buffer.from(JSON.stringify(presenceEvent)),
            }));
          } catch (error: any) {
            if (error.statusCode === 410) {
              console.log(`Stale connection during broadcast: ${conn.connectionId}`);
            } else {
              console.error(`Failed to broadcast to ${conn.connectionId}:`, error);
            }
          }
        });

        await Promise.allSettled(broadcastPromises);
        console.log(`Broadcasted offline presence to ${remainingConnections.length} connections`);
      } catch (broadcastError) {
        console.error('Failed to broadcast offline presence:', broadcastError);
        // Don't fail the disconnect if broadcast fails
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Disconnected successfully' })
    };

  } catch (error) {
    console.error('Disconnect error:', error);

    // Log error details
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }

    // Return 500 but don't fail the disconnect
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to clean up connection' })
    };
  }
};
