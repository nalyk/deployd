// Example BeforeRequest event for webhook
// Runs before any HTTP method event (GET, POST, etc.)

// Example: API key authentication
var apiKey = getHeader('x-api-key');

if (!apiKey) {
  cancel('API key required', 401);
}

// In production, validate against stored API keys
// For demo, accept any non-empty key
if (apiKey.length < 10) {
  cancel('Invalid API key', 403);
}

console.log('Authenticated request from API key:', apiKey.substring(0, 8) + '...');
