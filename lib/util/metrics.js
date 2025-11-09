/**
 * Production-grade Prometheus metrics for deployd
 *
 * Tracks:
 * - HTTP request duration and count
 * - Database operation duration
 * - Active connections
 * - Circuit breaker state
 * - Session count
 */

var promClient = require('prom-client');
var debug = require('debug')('metrics');

// Enable default metrics (CPU, memory, event loop lag, etc.)
var register = promClient.register;
promClient.collectDefaultMetrics({
  timeout: 10000,
  register: register
});

// HTTP Request metrics
var httpRequestDuration = new promClient.Histogram({
  name: 'deployd_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]
});

var httpRequestTotal = new promClient.Counter({
  name: 'deployd_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// Database operation metrics
var dbOperationDuration = new promClient.Histogram({
  name: 'deployd_db_operation_duration_seconds',
  help: 'Duration of database operations in seconds',
  labelNames: ['operation', 'collection'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
});

var dbOperationTotal = new promClient.Counter({
  name: 'deployd_db_operations_total',
  help: 'Total number of database operations',
  labelNames: ['operation', 'collection', 'status']
});

// Connection pool metrics
var dbConnectionsActive = new promClient.Gauge({
  name: 'deployd_db_connections_active',
  help: 'Number of active database connections'
});

// Circuit breaker metrics
var circuitBreakerState = new promClient.Gauge({
  name: 'deployd_circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 0.5=half-open)',
  labelNames: ['breaker']
});

// Session metrics
var sessionCount = new promClient.Gauge({
  name: 'deployd_sessions_active',
  help: 'Number of active sessions'
});

// WebSocket metrics
var websocketConnections = new promClient.Gauge({
  name: 'deployd_websocket_connections',
  help: 'Number of active WebSocket connections'
});

/**
 * Middleware to track HTTP requests
 */
function trackHttpRequest(req, res, next) {
  var start = process.hrtime();
  var route = extractRoute(req.url);

  // Intercept res.end to capture response
  var originalEnd = res.end;
  res.end = function() {
    var diff = process.hrtime(start);
    var duration = diff[0] + diff[1] / 1e9;

    httpRequestDuration.labels(req.method, route, res.statusCode).observe(duration);
    httpRequestTotal.labels(req.method, route, res.statusCode).inc();

    debug('HTTP %s %s %d - %dms', req.method, route, res.statusCode, (duration * 1000).toFixed(2));

    originalEnd.apply(res, arguments);
  };

  next();
}

/**
 * Extract route pattern from URL (remove IDs and query strings)
 */
function extractRoute(url) {
  // Remove query string
  var path = url.split('?')[0];

  // Replace UUIDs and MongoDB IDs with :id
  path = path.replace(/\/[0-9a-f]{24}(\/|$)/gi, '/:id$1');
  path = path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/gi, '/:id$1');

  // Limit path length
  if (path.length > 100) {
    path = path.substring(0, 100) + '...';
  }

  return path || '/';
}

/**
 * Track database operation
 */
function trackDbOperation(operation, collection) {
  var start = process.hrtime();

  return function(err) {
    var diff = process.hrtime(start);
    var duration = diff[0] + diff[1] / 1e9;

    var status = err ? 'error' : 'success';
    dbOperationDuration.labels(operation, collection).observe(duration);
    dbOperationTotal.labels(operation, collection, status).inc();

    if (err) {
      debug('DB %s on %s failed - %dms: %s', operation, collection, (duration * 1000).toFixed(2), err.message);
    } else {
      debug('DB %s on %s - %dms', operation, collection, (duration * 1000).toFixed(2));
    }
  };
}

/**
 * Update circuit breaker state
 */
function updateCircuitBreakerState(name, state) {
  var value = 0;
  if (state === 'open') value = 1;
  if (state === 'half-open') value = 0.5;
  circuitBreakerState.labels(name).set(value);
}

/**
 * Update session count
 */
function updateSessionCount(count) {
  sessionCount.set(count);
}

/**
 * Update WebSocket connection count
 */
function updateWebSocketCount(count) {
  websocketConnections.set(count);
}

/**
 * Update database connection count
 */
function updateDbConnections(active) {
  dbConnectionsActive.set(active);
}

/**
 * Get metrics in Prometheus format
 * Returns a Promise in prom-client >= 14
 */
function getMetrics() {
  return register.metrics();
}

/**
 * Get metrics in JSON format
 */
function getMetricsJSON() {
  return register.getMetricsAsJSON();
}

module.exports = {
  trackHttpRequest: trackHttpRequest,
  trackDbOperation: trackDbOperation,
  updateCircuitBreakerState: updateCircuitBreakerState,
  updateSessionCount: updateSessionCount,
  updateWebSocketCount: updateWebSocketCount,
  updateDbConnections: updateDbConnections,
  getMetrics: getMetrics,
  getMetricsJSON: getMetricsJSON,
  register: register
};
