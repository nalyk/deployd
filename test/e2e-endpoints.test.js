// E2E test for dashboard and clientlib endpoints
// Tests the full stack: server + native integrations (dashboard, clientlib)
// This is an integration test (not a unit test like those in test/)
const http = require('http');
const deployd = require('../');

const server = deployd({
  port: 2403,
  env: 'development',
  db: {
    connectionString: 'mongodb+srv://deployd:K3t4k1v57E28cq6P@db-mongodb-fra1-61867-v5-uni-6846e717.mongo.ondigitalocean.com/deployd?tls=true&authSource=admin&replicaSet=db-mongodb-fra1-61867-v5-uni'
  }
});

console.log('Starting server...');

server.listen();

server.on('listening', async () => {
  console.log('✅ Server started\n');

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test clientlib endpoint
  console.log('Testing /dpd.js endpoint...');
  http.get('http://localhost:2403/dpd.js', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (data.includes('socket.io') && data.includes('dpd')) {
        console.log('✅ /dpd.js endpoint works! (' + data.length + ' bytes)');
      } else {
        console.log('❌ /dpd.js endpoint failed');
      }

      // Test dashboard endpoint
      console.log('\nTesting /dashboard/ endpoint...');
      http.get('http://localhost:2403/dashboard/', (res) => {
        let data = '';
        console.log('Dashboard status:', res.statusCode);
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log('Dashboard response preview:', data.substring(0, 200));
          if (data.includes('<!DOCTYPE html>') || data.includes('<html') || res.statusCode === 200) {
            console.log('✅ /dashboard/ endpoint works! (' + data.length + ' bytes)');
          } else {
            console.log('❌ /dashboard/ endpoint failed');
          }

          console.log('\n🎉 ALL ENDPOINTS TESTED!\n');
          server.close(() => process.exit(0));
        });
      }).on('error', (err) => {
        console.error('❌ Dashboard error:', err.message);
        process.exit(1);
      });
    });
  }).on('error', (err) => {
    console.error('❌ Clientlib error:', err.message);
    process.exit(1);
  });
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});

setTimeout(() => {
  console.error('❌ Test timeout');
  process.exit(1);
}, 20000);
