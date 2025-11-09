// Example POST event for webhook
// Demonstrates receiving and processing webhook data

// Validate payload
if (!body || !body.event) {
  cancel('Missing event in payload', 400);
}

// Log webhook receipt
console.log('Received webhook:', body.event);

// Process different event types
if (body.event === 'user.created') {
  // Could notify admin, send email, etc.
  console.log('New user created:', body.data);
}

// Store webhook data in a collection (optional)
// dpd.webhooks.post({
//   event: body.event,
//   data: body.data,
//   receivedAt: Date.now()
// });

// Return success response
setStatusCode(200);
setResult({
  success: true,
  event: body.event,
  processed: true,
  timestamp: Date.now()
});
