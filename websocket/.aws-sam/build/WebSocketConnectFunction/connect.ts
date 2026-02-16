/**
 * WebSocket Connect Handler
 *
 * Authenticates new WebSocket connections using JWT tokens from Cognito.
 * Stores connection information in DynamoDB with TTL for automatic cleanup.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

// Environment variables
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const COGNITO_REGION = process.env.COGNITO_REGION!;
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

// JWKS endpoint for Cognito JWT verification
const JWKS = createRemoteJWKSet(
  new URL(`https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`)
);

/**
 * Handler for WebSocket $connect route
 *
 * @param event - API Gateway WebSocket connect event
 * @returns Connection response (200 = success, 401 = unauthorized)
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId!;

  console.log(`WebSocket connection attempt: ${connectionId}`);

  try {
    // Extract JWT token from query string
    const token = event.queryStringParameters?.token;

    if (!token) {
      console.error('Missing JWT token in query parameters');
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized: Missing token' })
      };
    }

    // Verify JWT token using Cognito JWKS
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`,
    });

    const userId = payload.sub!;
    const email = payload.email as string | undefined;

    console.log(`User authenticated: ${userId} (${email || 'no email'})`);

    // Store connection with TTL (24 hours from now)
    const ttl = Math.floor(Date.now() / 1000) + 86400; // 24 hours

    await ddb.send(new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: {
        connectionId,
        userId,
        email,
        connectedAt: new Date().toISOString(),
        ttl, // DynamoDB will automatically delete expired connections
      },
    }));

    console.log(`Connection stored successfully: ${connectionId} -> user ${userId}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Connected successfully' })
    };

  } catch (error) {
    console.error('Connection error:', error);

    // Log JWT verification errors specifically
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }

    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized: Invalid token' })
    };
  }
};
