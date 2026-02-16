/**
 * WebSocket Disconnect Handler
 *
 * Removes connection records from DynamoDB when WebSocket connection closes.
 * This ensures clean state and prevents stale connections from receiving messages.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

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
    // Remove connection from DynamoDB
    await ddb.send(new DeleteCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId },
    }));

    console.log(`Connection removed successfully: ${connectionId}`);

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
