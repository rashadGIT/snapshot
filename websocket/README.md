# Snapspot WebSocket Infrastructure

AWS Serverless WebSocket API for real-time updates in Snapspot photo sharing platform.

## Architecture

- **API Gateway WebSocket API** - Manages persistent WebSocket connections
- **Lambda Functions** - Handle connection lifecycle and routing (connect, disconnect, joinJob)
- **DynamoDB Table** - Stores active connections with job associations and TTL

## Prerequisites

- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- [Node.js 20+](https://nodejs.org/)
- AWS credentials configured (`aws configure`)

## Deployment

### 1. Install Dependencies

```bash
cd websocket
npm install
```

### 2. Build Lambda Functions

```bash
npm run build
# Or use SAM:
sam build
```

### 3. Deploy to AWS

**First time deployment:**

```bash
sam deploy --guided
```

Follow the prompts:
- Stack Name: `snapspot-websocket`
- AWS Region: `us-east-1` (or your preferred region)
- Confirm changes before deploy: `Y`
- Allow SAM CLI IAM role creation: `Y`
- Save arguments to configuration file: `Y`

**Subsequent deployments:**

```bash
sam build && sam deploy
```

### 4. Get WebSocket URL

After deployment, SAM will output the WebSocket URL:

```
WebSocketURL = wss://abc123xyz.execute-api.us-east-1.amazonaws.com/production
```

**Copy this URL** and add it to your Next.js environment variables:
- In Amplify: Set `NEXT_PUBLIC_WEBSOCKET_URL` environment variable
- Locally: Add to `.env.local`

## Testing

### Test WebSocket Connection

Use `wscat` to test the connection:

```bash
npm install -g wscat

# Replace with your WebSocket URL and a valid JWT token
wscat -c "wss://your-api-id.execute-api.us-east-1.amazonaws.com/production?token=YOUR_JWT_TOKEN"
```

### Join a Job Room

After connecting, send:

```json
{
  "action": "joinJob",
  "jobId": "your-job-uuid"
}
```

## Lambda Handlers

### connect.ts
- Authenticates users via JWT token (from Cognito)
- Stores connection in DynamoDB with 24-hour TTL
- Returns 401 if token is invalid

### disconnect.ts
- Removes connection from DynamoDB on WebSocket close
- Ensures clean state

### joinJob.ts
- Associates connection with a job ID (creates "room")
- Enables job-specific message broadcasting
- Validates connection exists

## DynamoDB Table Schema

**Table Name:** `snapspot-websocket-connections`

**Primary Key:**
- `connectionId` (String, HASH)

**Global Secondary Index:**
- `jobId-index` - For querying all connections in a job room

**Attributes:**
- `connectionId` (String) - WebSocket connection ID
- `userId` (String) - Cognito user ID
- `email` (String, optional) - User email
- `jobId` (String, optional) - Associated job ID
- `connectedAt` (ISO timestamp) - Connection time
- `joinedJobAt` (ISO timestamp, optional) - Job join time
- `ttl` (Number) - Unix timestamp for automatic cleanup (24 hours)

## Monitoring

### CloudWatch Logs

Lambda logs are available in CloudWatch:
- `/aws/lambda/snapspot-websocket-WebSocketConnectFunction`
- `/aws/lambda/snapspot-websocket-WebSocketDisconnectFunction`
- `/aws/lambda/snapspot-websocket-WebSocketJoinJobFunction`

### API Gateway Metrics

Monitor in AWS Console → API Gateway → `snapspot-websocket` → Monitoring:
- Connection count
- Message count
- Integration latency
- 4XX/5XX errors

### DynamoDB Metrics

Monitor in AWS Console → DynamoDB → `snapspot-websocket-connections`:
- Item count (current active connections)
- Read/write capacity (should be 0 with on-demand billing)

## Cost Estimation

**Pay-per-use pricing:**
- API Gateway WebSocket: $1.00 per million connection-minutes + $0.25 per million messages
- Lambda: Free tier 1M requests/month (likely within free tier)
- DynamoDB: On-demand, ~$1.25 per million writes, $0.25 per million reads

**Estimated monthly cost** (10 concurrent users, 8 hours/day):
- ~$5-10/month

## Cleanup

To delete all resources:

```bash
sam delete --stack-name snapspot-websocket
```

This will remove:
- API Gateway WebSocket API
- All Lambda functions
- DynamoDB table (and all data)
- IAM roles and permissions

## Troubleshooting

### Connection fails with 401

- Check JWT token is valid (not expired)
- Verify token is from the correct Cognito User Pool
- Check CloudWatch logs for detailed error

### Messages not received

- Verify connection joined job room (sent `joinJob` message)
- Check broadcaster is using correct `WEBSOCKET_API_ENDPOINT`
- Check DynamoDB table has connection record with `jobId` set

### Lambda timeout

- Default timeout is 30 seconds (configured in template.yaml)
- Check CloudWatch logs for execution duration
- Optimize code or increase timeout if needed

## Security

- **Authentication:** JWT tokens verified using Cognito JWKS
- **Authorization:** Job access should be verified by broadcaster (not in Lambda)
- **Encryption:** WebSocket uses TLS (wss://)
- **Rate Limiting:** API Gateway throttling configured (500 burst, 1000 steady)

## Next Steps

After deploying infrastructure:
1. Update Next.js environment variables with WebSocket URL
2. Implement broadcaster utility in Next.js (`src/lib/websocket/broadcaster.ts`)
3. Add event emissions to API routes (uploads, submit, approve)
4. Create client-side React hook (`useJobWebSocket`)
5. Integrate hook into job details page

See main implementation plan for details.
