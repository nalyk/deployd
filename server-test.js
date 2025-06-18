// server.js – runs your fork *directly*
const deployd = require('./');           // local fork
const dashboard = require('dpd-dashboard'); // <-- ADĂUGAT

const server  = deployd({
  port: 2403,
  env : process.env.NODE_ENV || 'development',
  db  : {
    connectionString: process.env.MONGO_URL ||
         'mongodb+srv://deployd:RzGJ035A792Bt8d4@pulsmedia-mongodb-d506b061.mongo.ondigitalocean.com/deployd?tls=true&authSource=admin&retryWrites=true&w=majority'
  }
});

dashboard(server);
server.listen();
server.on('listening', () =>
  console.log('Deployd fork running on http://localhost:2403'));
server.on('error', console.error);
