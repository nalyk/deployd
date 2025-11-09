<!--{
  title: 'Event Resource',
  tags: ['resource type', 'module'],
  description: 'Create custom events at a specified URL.'
}-->

## Event Resource

**Native Resource** - Built into Deployd, no installation required.

This resource type allows you to create custom endpoints that execute event scripts without database persistence. Events are useful for:
- Webhooks and third-party API integrations
- Custom business logic and computed operations
- API proxies and data transformations
- Custom authentication endpoints

The Event resource supports `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, and `beforeRequest` events.

### Installation

**No installation required** - Event is a native resource type included in this modernized fork. Simply create an Event resource from the dashboard or add it to your `.dpd/resources/` directory.

> **Note**: This replaces the `dpd-event` npm module from the original Deployd.

### Usage

Each HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) can have its own event script that executes when the resource's route receives that type of request.

The `beforeRequest` event runs before any HTTP method event and is useful for authentication, logging, or request validation.

It is strongly recommended that you reserve the `On GET` event for operations that return a value, but don't have any side effects of modifying the database or performing some other operation.  

If your resource is called `/add-follower`, you can trigger its `POST` event from dpd.js:

    dpd.addfollower.post('320d6151a9aad8ce', {userId: '6d75e75d9bd9b8a6'}, function(result, error) {
      // Do something
    })

And over HTTP:

    POST /add-follower/320d6151a9aad8ce
    Content-Type: application/json
    {
      "userId": "6d75e75d9bd9b8a6"
    }

### Event API

In addition to the generic [custom resource event API](/docs/using-modules/reference/event-api.md), the following functions and variables are available while scripting the Event resource:


#### setResult(result) <!-- api -->

Sets the response body. The `result` argument can be a string or an object.

    // On GET /top-score
    dpd.scores.get({$limit: 1, $sort: {score: -1}, function(result) {
      setResult(result[0]);
    });

#### url <!-- api -->

The URL of the request, without the resource's base URL. If the resource is called `/add-follower` and receives a request at `/add-follower/320d6151a9aad8ce`, the `url` value will be `/320d6151a9aad8ce`.

    // On GET /statistics
    // Get the top score
    if (url === '/top-score') {
      dpd.scores.get({$limit: 1, $sort: {score: -1}, function(result) {
        setResult(result[0]);
      });
    }

#### parts <!-- api -->

An array of the parts of the url, separated by `/`. If the resource is called `/add-follower` and receives a request at `/add-follower/320d6151a9aad8ce/6d75e75d9bd9b8a6`, the `parts` value will be `['320d6151a9aad8ce', '6d75e75d9bd9b8a6']`.

    // On POST /add-score
    // Give the specified user (/add-score/:userId) 5 points
    var userId = parts[0];
    if (!userId) cancel("You must provide a user");

    dpd.users.put({id: userId}, {score: {$inc: 5}}, function(result, err) {
      if (err) cancel(err);
    });

#### query <!-- api -->

The query string object.
  
    // On GET /sum
    // Return the sum of the a and b properties (/sum?a=5&b=1)

    setResult(query.a + query.b);

#### body <!-- api -->

The body of the request.

    // On POST /sum
    // Return the sum of the a and b properties {a: 5, b: 1}

    setResult(body.a + body.b);

#### getHeader(name) <!-- api -->

Get an HTTP request header value.

    // On POST /webhook
    var apiKey = getHeader('x-api-key');
    if (!apiKey) {
      cancel('API key required', 401);
    }

#### setHeader(name, value) <!-- api -->

Set an HTTP response header.

    // On GET /data
    setHeader('Cache-Control', 'public, max-age=3600');
    setResult({data: 'cached for 1 hour'});

#### setStatusCode(statusCode) <!-- api -->

Set the HTTP response status code.

    // On POST /webhook
    if (!body.event) {
      setStatusCode(400);
      cancel('Missing event field');
    }
    setStatusCode(202);  // Accepted
    setResult({received: true});