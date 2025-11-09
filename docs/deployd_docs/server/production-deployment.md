<!--{
  title: 'Production Deployment Guide',
  tags: ['production', 'deployment', 'docker', 'kubernetes', 'monitoring']
}-->

## Production Deployment Guide

This modernized fork of Deployd includes comprehensive production features for cloud-native deployments. This guide covers health checks, metrics, logging, and deployment patterns for Docker and Kubernetes.

### Health Check Endpoints

Deployd automatically exposes three health check endpoints compatible with Kubernetes and Docker:

#### `GET /__health/live` - Liveness Probe

Indicates if the application is running. Returns 200 OK if the server is alive.

**Response**:
```json
{
  "status": "ok",
  "timestamp": 1699000000000
}
```

**Kubernetes Example**:
```yaml
livenessProbe:
  httpGet:
    path: /__health/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30
  timeoutSeconds: 3
  failureThreshold: 3
```

#### `GET /__health/ready` - Readiness Probe

Indicates if the application is ready to receive traffic. Checks MongoDB connection status.

**Response (Ready)**:
```json
{
  "status": "ok",
  "db": "connected",
  "timestamp": 1699000000000
}
```

**Response (Not Ready)**:
```json
{
  "status": "unavailable",
  "db": "disconnected",
  "timestamp": 1699000000000
}
```

**Kubernetes Example**:
```yaml
readinessProbe:
  httpGet:
    path: /__health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3
```

#### `GET /__health/startup` - Startup Probe

Indicates if the application has completed its startup sequence. Prevents premature traffic routing during initialization.

**Kubernetes Example**:
```yaml
startupProbe:
  httpGet:
    path: /__health/startup
    port: 3000
  initialDelaySeconds: 0
  periodSeconds: 5
  failureThreshold: 30  # 150 seconds total startup time allowed
```

**Implementation**: See lib/server.js:142-154 for health check logic.

### Prometheus Metrics

Deployd exposes application metrics in Prometheus format at `/metrics` for monitoring and alerting.

#### Available Metrics

- **http_requests_total** - Total HTTP requests (counter)
  - Labels: method, route, status_code
- **http_request_duration_seconds** - Request duration histogram
  - Labels: method, route, status_code
- **active_connections** - Current active connections (gauge)
- **mongodb_operations_total** - Total database operations (counter)
  - Labels: operation (insert, find, update, remove, count)
- **mongodb_operation_duration_seconds** - Database operation duration histogram
  - Labels: operation

#### Prometheus Configuration

Add Deployd as a scrape target:

```yaml
scrape_configs:
  - job_name: 'deployd'
    static_configs:
      - targets: ['deployd-service:3000']
    metrics_path: /metrics
    scrape_interval: 15s
```

#### Grafana Dashboard

Use these PromQL queries for monitoring:

```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status_code=~"5.."}[5m])

# P95 request latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Database operation rate
rate(mongodb_operations_total[5m])
```

**Implementation**: See lib/metrics.js for metric definitions.

### Structured Logging

Deployd uses Winston for structured JSON logging, compatible with log aggregation systems like ELK, Datadog, and CloudWatch.

#### Log Format

```json
{
  "timestamp": "2024-11-09T10:30:00.000Z",
  "level": "info",
  "message": "Server listening on port 3000",
  "service": "deployd",
  "environment": "production",
  "requestId": "req-abc123",
  "userId": "user-xyz789"
}
```

#### Log Levels

- **error**: Application errors, exceptions
- **warn**: Warning conditions (deprecations, rate limits)
- **info**: Informational messages (server startup, requests)
- **debug**: Detailed debugging information

#### Configuration

Set log level via environment variable:

```bash
LOG_LEVEL=info node production.js
```

#### Accessing Logs

**Development**:
```bash
DEBUG=* node development.js
```

**Production** (JSON format):
```bash
NODE_ENV=production node production.js | jq .
```

**Implementation**: See lib/server.js:31-42 for Winston configuration.

### Docker Deployment

#### Dockerfile Example

```dockerfile
FROM node:22-alpine

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/__health/live', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run as non-root user
USER node

# Start application
CMD ["node", "production.js"]
```

#### Docker Compose Example

```yaml
version: '3.8'
services:
  deployd:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/myapp
      - LOG_LEVEL=info
    depends_on:
      - mongo
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/__health/live')"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s

  mongo:
    image: mongo:7
    volumes:
      - mongodb_data:/data/db
    ports:
      - "27017:27017"

volumes:
  mongodb_data:
```

#### Building and Running

```bash
# Build image
docker build -t deployd-app:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/myapp \
  --name deployd-app \
  deployd-app:latest

# View logs
docker logs -f deployd-app

# Check health
curl http://localhost:3000/__health/ready
```

### Kubernetes Deployment

#### Complete Deployment Manifest

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: deployd-config
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
---
apiVersion: v1
kind: Secret
metadata:
  name: deployd-secrets
type: Opaque
stringData:
  MONGODB_URI: "mongodb+srv://user:password@cluster.mongodb.net/myapp"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: deployd-app
  labels:
    app: deployd
spec:
  replicas: 3
  selector:
    matchLabels:
      app: deployd
  template:
    metadata:
      labels:
        app: deployd
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: deployd
        image: your-registry/deployd-app:latest
        ports:
        - containerPort: 3000
          name: http
        envFrom:
        - configMapRef:
            name: deployd-config
        env:
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: deployd-secrets
              key: MONGODB_URI
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /__health/live
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
          timeoutSeconds: 3
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /__health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /__health/startup
            port: 3000
          initialDelaySeconds: 0
          periodSeconds: 5
          failureThreshold: 30
---
apiVersion: v1
kind: Service
metadata:
  name: deployd-service
  labels:
    app: deployd
spec:
  selector:
    app: deployd
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: deployd-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: deployd-app
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### Deployment Commands

```bash
# Apply manifests
kubectl apply -f deployd-deployment.yaml

# Check status
kubectl get pods -l app=deployd
kubectl rollout status deployment/deployd-app

# View logs
kubectl logs -l app=deployd -f

# Check health
kubectl exec -it deployment/deployd-app -- wget -q -O- http://localhost:3000/__health/ready
```

### Graceful Shutdown

Deployd handles SIGTERM signals for zero-downtime deployments:

```javascript
// production.js
var deployd = require('deployd');

var server = deployd({
  port: process.env.PORT || 3000,
  env: 'production',
  db: {
    connectionString: process.env.MONGODB_URI
  }
});

server.listen();

// Graceful shutdown
process.on('SIGTERM', function() {
  console.log('SIGTERM received - shutting down gracefully...');

  server.close(function() {
    console.log('Server closed, exiting process');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(function() {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
});

process.on('SIGINT', function() {
  console.log('SIGINT received - shutting down...');
  server.close(function() {
    process.exit(0);
  });
});
```

**Implementation**: See lib/server.js:245-256 for graceful shutdown logic.

### Performance Tuning

#### Connection Pooling

```javascript
var server = deployd({
  db: {
    connectionString: process.env.MONGODB_URI,
    connectionOptions: {
      minPoolSize: 10,   // Minimum connections
      maxPoolSize: 100,  // Maximum connections
      maxIdleTimeMS: 30000
    }
  }
});
```

#### Router Caching

In production, router configuration is cached for performance (lib/router.js:43-48).

#### HTTP Keep-Alive

HTTP Keep-Alive is automatically enabled with 65-second timeout (lib/server.js:84-86).

### Troubleshooting

#### Common Issues

**MongoDB Connection Timeouts**:
```bash
# Check MongoDB connectivity
mongosh "$MONGODB_URI" --eval "db.runCommand({ping: 1})"

# Increase timeout
db: {
  connectionOptions: {
    serverSelectionTimeoutMS: 60000
  }
}
```

**WebSocket Connection Issues**:
```javascript
// Ensure CORS is configured
socketIo: {
  options: {
    cors: {
      origin: "https://your-domain.com",
      methods: ["GET", "POST"]
    }
  }
}
```

**High Memory Usage**:
```javascript
// Reduce connection pool size
db: {
  connectionOptions: {
    maxPoolSize: 50
  }
}
```

#### Debug Mode

```bash
# Enable all debug output
DEBUG=* node production.js

# Specific namespaces
DEBUG=db,collection,server node production.js

# Only errors
DEBUG=db:error,session:error node production.js
```

### Related Documentation

- [Building a Custom Run Script](/docs/server/run-script.md)
- [Configuration Reference](/docs/server/configuration-reference.md)
- [Monitoring & Observability](/docs/server/monitoring-observability.md)
- [Security Hardening](/docs/server/security-hardening.md)
