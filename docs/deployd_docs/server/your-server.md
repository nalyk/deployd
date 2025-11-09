<!--{
  title: 'Deploying to your own Server',
  tags: ['guide', 'deploy', 'hosting']
}-->

## Deploying to your own Server

To deploy your app on your server, or on a cloud hosting service such as EC2, Heroku, or Kubernetes, the server must support [Node.js](http://nodejs.org/) 22.x LTS or newer.

Deployd also requires a [MongoDB](http://www.mongodb.org/) 6.0+ database, which can be:
- Hosted on the same server
- External managed service (MongoDB Atlas, Azure Cosmos DB, AWS DocumentDB)
- Kubernetes-hosted MongoDB

If you have root shell access on the deployment server, you can install Deployd on it using the command `npm install -g deployd`.
Otherwise, you will need to install Deployd as a dependency of your app itself using `npm install deployd` in the root directory of your app.

You can use the `dpd` CLI to run your server; this will start up an instance of MongoDB automatically, using the "data" folder. (Requires MongoDB installed on the server)

### Modern Deployment Options

This modernized fork includes production-ready features for cloud-native deployments:

- **Health Check Endpoints**: `/__health/live`, `/__health/ready`, `/__health/startup` for Kubernetes/Docker
- **Prometheus Metrics**: `/metrics` endpoint for monitoring
- **Graceful Shutdown**: Proper SIGTERM handling for zero-downtime deployments
- **Structured Logging**: JSON-formatted logs for log aggregation systems

### Dashboard Access

To set up the dashboard on your server, type `dpd keygen` on your server's command line to create a remote access key. Type `dpd showkey` to get the key; you should store this somewhere secure.

You can then go to the `/dashboard` route on the server and type in that key to gain access.

### Server Script

Since Deployd is itself a node module, you can write your own scripts to run in production instead of using the command line interface. Read the [Building a Custom Run Script](/docs/server/run-script.md) Guide.

*Note: Some hosts do not support WebSockets, so `dpd.on()` may not work correctly on certain deployments.*

### Docker Deployment

Example Dockerfile for deploying Deployd:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "require('http').get('http://localhost:3000/__health/live')"
CMD ["node", "production.js"]
```

### Kubernetes Deployment

Example Kubernetes manifests with health checks:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: deployd-app
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: deployd
        image: your-registry/deployd-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: mongodb-secret
              key: uri
        - name: NODE_ENV
          value: "production"
        livenessProbe:
          httpGet:
            path: /__health/live
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /__health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
        startupProbe:
          httpGet:
            path: /__health/startup
            port: 3000
          initialDelaySeconds: 0
          periodSeconds: 5
          failureThreshold: 30
```

### Recommended MongoDB Hosting

For production deployments, we recommend:
- **MongoDB Atlas** - Official MongoDB cloud service with automatic backups
- **Azure Cosmos DB** - Microsoft's globally distributed database service
- **AWS DocumentDB** - Amazon's MongoDB-compatible database
- **Self-hosted MongoDB 6+** - With replica sets for high availability

All are fully compatible with this modernized fork's TLS and modern driver features.