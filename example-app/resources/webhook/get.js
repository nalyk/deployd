// Example GET event for webhook
// Available variables: url, parts, query, body, this
// Available functions: setResult, getHeader, setHeader, setStatusCode

setResult({
  message: 'Webhook endpoint is active',
  method: 'GET',
  timestamp: Date.now(),
  query: query
});
