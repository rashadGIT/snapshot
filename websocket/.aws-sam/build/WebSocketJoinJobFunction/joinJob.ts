/**
 * WebSocket Join Job Handler
 *
 * Associates a WebSocket connection with a specific job (room).
 * This enables job-specific broadcasting where only users viewing
 * a particular job receive relevant real-time updates.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

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

    // Update connection record with jobId (creates "room" association)
    await ddb.send(new UpdateCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId },
      UpdateExpression: 'SET jobId = :jobId, joinedJobAt = :now',
      ExpressionAttributeValues: {
        ':jobId': jobId,
        ':now': new Date().toISOString(),
      },
      // Fail if connection doesn't exist (should have been created in $connect)
      ConditionExpression: 'attribute_exists(connectionId)',
    }));

    console.log(`Connection ${connectionId} successfully joined job ${jobId}`);

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
