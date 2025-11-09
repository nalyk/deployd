<!--{
  title: 'Monitoring & Observability',
  tags: ['monitoring', 'metrics', 'logging', 'observability']
}-->

## Monitoring & Observability

This fork includes comprehensive monitoring and observability features for production deployments.

### Health Check Endpoints

Three health check endpoints following Kubernetes best practices:

#### Liveness Probe - `/__health/live`

Indicates if the application process is alive.

**When to use**: Kubernetes liveness probe, Docker healthcheck

**Response** (200 OK):
```json
{
  "status": "ok",
  "timestamp": 1699000000000
}
```

**Kubernetes**:
```yaml
livenessProbe:
  httpGet:
    path: /__health/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30
```

#### Readiness Probe - `/__health/ready`

Indicates if the application can accept traffic. Checks MongoDB connection.

**When to use**: Kubernetes readiness probe, load balancer health check

**Response Ready** (200 OK):
```json
{
  "status": "ok",
  "db": "connected",
  "timestamp": 1699000000000
}
```

**Response Not Ready** (503 Service Unavailable):
```json
{
  "status": "unavailable",
  "db": "disconnected",
  "timestamp": 1699000000000
}
```

**Kubernetes**:
```yaml
readinessProbe:
  httpGet:
    path: /__health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

#### Startup Probe - `/__health/startup`

Indicates if the application has completed initialization.

**When to use**: Kubernetes startup probe (prevents premature liveness checks)

**Kubernetes**:
```yaml
startupProbe:
  httpGet:
    path: /__health/startup
    port: 3000
  initialDelaySeconds: 0
  periodSeconds: 5
  failureThreshold: 30  # 150s total startup time
```

**Implementation**: lib/server.js:142-154

### Prometheus Metrics

Metrics endpoint at `/metrics` in Prometheus format.

#### HTTP Metrics

**http_requests_total** (Counter)
- Total number of HTTP requests
- Labels: `method`, `route`, `status_code`

```promql
# Request rate
rate(http_requests_total[5m])

# Requests by status code
sum by (status_code) (rate(http_requests_total[5m]))
```

**http_request_duration_seconds** (Histogram)
- HTTP request duration distribution
- Labels: `method`, `route`, `status_code`
- Buckets: 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10

```promql
# P95 latency
histogram_quantile(0.95,
  rate(http_request_duration_seconds_bucket[5m])
)

# P99 latency
histogram_quantile(0.99,
  rate(http_request_duration_seconds_bucket[5m])
)

# Average latency
rate(http_request_duration_seconds_sum[5m]) /
rate(http_request_duration_seconds_count[5m])
```

**active_connections** (Gauge)
- Current number of active HTTP connections

```promql
# Current connections
active_connections

# Max connections in last hour
max_over_time(active_connections[1h])
```

#### Database Metrics

**mongodb_operations_total** (Counter)
- Total database operations
- Labels: `operation` (insert, find, update, remove, count)

```promql
# Operations per second
rate(mongodb_operations_total[5m])

# Operations by type
sum by (operation) (rate(mongodb_operations_total[5m]))
```

**mongodb_operation_duration_seconds** (Histogram)
- Database operation duration
- Labels: `operation`
- Buckets: 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5

```promql
# P95 DB operation latency
histogram_quantile(0.95,
  rate(mongodb_operation_duration_seconds_bucket[5m])
)

# Slow queries (>1s)
rate(mongodb_operation_duration_seconds_bucket{le="1"}[5m])
```

**Implementation**: lib/metrics.js

#### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'deployd'
    static_configs:
      - targets: ['deployd-service:3000']
    metrics_path: /metrics
    scrape_interval: 15s
    scrape_timeout: 10s
```

#### Grafana Dashboard

Import this JSON or create panels with these queries:

**Request Rate**:
```promql
sum(rate(http_requests_total[5m]))
```

**Error Rate**:
```promql
sum(rate(http_requests_total{status_code=~"5.."}[5m])) /
sum(rate(http_requests_total[5m]))
```

**Latency (P50, P95, P99)**:
```promql
histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

**Database Operations**:
```promql
sum by (operation) (rate(mongodb_operations_total[5m]))
```

**Active Connections**:
```promql
active_connections
```

### Structured Logging

Winston-based JSON logging for production.

#### Log Format

```json
{
  "timestamp": "2024-11-09T10:30:00.000Z",
  "level": "info",
  "message": "Server listening on port 3000",
  "service": "deployd",
  "environment": "production",
  "requestId": "req-abc123-def456",
  "userId": "user-xyz789",
  "method": "GET",
  "url": "/api/todos",
  "statusCode": 200,
  "duration": 45
}
```

#### Log Levels

- **error**: Application errors, exceptions, database failures
- **warn**: Warning conditions (deprecated features, rate limits)
- **info**: Informational messages (server startup, requests)
- **debug**: Detailed debugging information

#### Configuration

```bash
# Set via environment variable
LOG_LEVEL=info node production.js

# Available levels
LOG_LEVEL=error   # Only errors
LOG_LEVEL=warn    # Warnings and errors
LOG_LEVEL=info    # Info, warnings, errors (default production)
LOG_LEVEL=debug   # All logs including debug
```

**Production Configuration**:
```javascript
var winston = require('winston');

var logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  defaultMeta: {
    service: 'deployd',
    environment: process.env.NODE_ENV
  },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({filename: 'error.log', level: 'error'}),
    new winston.transports.File({filename: 'combined.log'})
  ]
});
```

**Implementation**: lib/server.js:31-42

#### Viewing Logs

**Development**:
```bash
DEBUG=* node development.js
```

**Production JSON**:
```bash
NODE_ENV=production node production.js
```

**With jq parsing**:
```bash
NODE_ENV=production node production.js | jq .
```

**Filter by level**:
```bash
node production.js | jq 'select(.level == "error")'
```

**Filter by field**:
```bash
node production.js | jq 'select(.statusCode >= 400)'
```

### Request Tracing

Every request gets a unique ID for distributed tracing.

**Request ID Format**: `req-{uuid}`

**In Logs**:
```json
{
  "requestId": "req-abc123-def456",
  "method": "POST",
  "url": "/api/todos"
}
```

**In Response Headers**:
```http
HTTP/1.1 200 OK
X-Request-ID: req-abc123-def456
```

**Trace Across Services**:
```javascript
// Forward request ID to external services
var requestId = ctx.req.headers['x-request-id'];
http.get({
  url: 'https://api.external.com/data',
  headers: {'X-Request-ID': requestId}
});
```

### Debug Logging

Use DEBUG environment variable for detailed logging:

```bash
# All debug output
DEBUG=* node server.js

# Specific modules
DEBUG=db,collection,server node server.js

# Only errors
DEBUG=db:error,session:error node server.js

# Pattern matching
DEBUG=*:error node server.js
```

**Available Namespaces**:
- `db` - Database operations
- `db:error` - Database errors
- `collection` - Collection CRUD operations
- `server` - Server lifecycle events
- `router` - Request routing
- `script` - Event script execution
- `session` - Session management
- `session:error` - Session errors
- `event` - Event resource operations
- `files` - File upload/download

### Alerting Rules

#### Prometheus Alerting

```yaml
# alerts.yml
groups:
  - name: deployd
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status_code=~"5.."}[5m]) /
          rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      # High latency
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95,
            rate(http_request_duration_seconds_bucket[5m])
          ) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High P95 latency"
          description: "P95 latency is {{ $value }}s"

      # Database unavailable
      - alert: DatabaseDown
        expr: up{job="deployd"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Deployd server is down"

      # Low database pool
      - alert: LowDatabasePool
        expr: mongodb_pool_available < 5
        for: 5m
        labels:
          severity: warning
```

### Log Aggregation

#### ELK Stack (Elasticsearch, Logstash, Kibana)

**Logstash Configuration**:
```ruby
input {
  file {
    path => "/var/log/deployd/combined.log"
    codec => "json"
  }
}

filter {
  json {
    source => "message"
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "deployd-%{+YYYY.MM.dd}"
  }
}
```

#### Datadog

```javascript
var winston = require('winston');
var DatadogWinston = require('datadog-winston');

var logger = winston.createLogger({
  transports: [
    new DatadogWinston({
      apiKey: process.env.DATADOG_API_KEY,
      hostname: process.env.HOSTNAME,
      service: 'deployd',
      ddsource: 'nodejs'
    })
  ]
});
```

#### CloudWatch Logs

```javascript
var CloudWatchTransport = require('winston-cloudwatch');

var logger = winston.createLogger({
  transports: [
    new CloudWatchTransport({
      logGroupName: '/aws/deployd',
      logStreamName: process.env.HOSTNAME,
      awsRegion: 'us-east-1'
    })
  ]
});
```

### Performance Monitoring

#### Application Performance Monitoring (APM)

**New Relic**:
```javascript
require('newrelic');
var deployd = require('deployd');
// ... rest of server code
```

**Datadog APM**:
```javascript
var tracer = require('dd-trace').init();
var deployd = require('deployd');
// ... rest of server code
```

### Related Documentation

- [Production Deployment](/docs/server/production-deployment.md)
- [Configuration Reference](/docs/server/configuration-reference.md)
- [Security Hardening](/docs/server/security-hardening.md)
