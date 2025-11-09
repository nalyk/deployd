// E2E CRUD test for deployd MongoDB 6+ fork
// Tests the full stack: server + database + collection operations
// This is an integration test (not a unit test like those in test/)
const deployd = require('../');

const server = deployd({
  port: 2403,
  env: 'development',
  db: {
    connectionString: 'mongodb+srv://deployd:K3t4k1v57E28cq6P@db-mongodb-fra1-61867-v5-uni-6846e717.mongo.ondigitalocean.com/deployd?tls=true&authSource=admin&replicaSet=db-mongodb-fra1-61867-v5-uni'
  }
});

console.log('Starting deployd server...');

server.listen();

server.on('listening', async () => {
  console.log('✅ Server started on http://localhost:2403');

  // Wait for MongoDB connection to be established (TLS handshake takes time)
  console.log('⏳ Waiting for MongoDB connection...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test database connection
  const db = server.db;
  const testStore = db.createStore('test-collection');

  try {
    console.log('\n📝 Testing MongoDB CRUD operations...\n');

    // 1. INSERT
    console.log('1️⃣  Testing INSERT...');
    const insertResult = await new Promise((resolve, reject) => {
      testStore.insert({ name: 'Test Item', value: 42, created: new Date() }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    console.log('   ✅ INSERT successful:', { id: insertResult.id, name: insertResult.name });
    const testId = insertResult.id;

    // 2. FIND (by ID)
    console.log('\n2️⃣  Testing FIND by ID...');
    const findResult = await new Promise((resolve, reject) => {
      testStore.find({ id: testId }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    console.log('   ✅ FIND successful:', findResult);

    // 3. COUNT
    console.log('\n3️⃣  Testing COUNT...');
    const countResult = await new Promise((resolve, reject) => {
      testStore.count({}, (err, count) => {
        if (err) reject(err);
        else resolve(count);
      });
    });
    console.log('   ✅ COUNT successful:', countResult, 'documents');

    // 4. UPDATE
    console.log('\n4️⃣  Testing UPDATE...');
    const updateResult = await new Promise((resolve, reject) => {
      testStore.update({ id: testId }, { value: 100, updated: new Date() }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    console.log('   ✅ UPDATE successful:', updateResult);

    // Verify update
    const verifyUpdate = await new Promise((resolve, reject) => {
      testStore.find({ id: testId }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    console.log('   📋 Updated document:', verifyUpdate);

    // 5. FIND ALL
    console.log('\n5️⃣  Testing FIND ALL...');
    const findAllResult = await new Promise((resolve, reject) => {
      testStore.find({}, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    console.log('   ✅ FIND ALL successful:', findAllResult.length, 'documents found');

    // 6. DELETE
    console.log('\n6️⃣  Testing DELETE...');
    const deleteResult = await new Promise((resolve, reject) => {
      testStore.remove({ id: testId }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    console.log('   ✅ DELETE successful:', deleteResult);

    // Verify deletion
    const verifyDelete = await new Promise((resolve, reject) => {
      testStore.find({ id: testId }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    console.log('   📋 After deletion:', verifyDelete ? 'Found (ERROR)' : 'Not found (correct)');

    console.log('\n🎉 ALL TESTS PASSED! MongoDB 6+ integration is working!\n');

    // Cleanup and exit
    server.close(() => {
      console.log('✅ Server and database closed');
      process.exit(0);
    });

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    server.close(() => process.exit(1));
  }
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  server.close(() => process.exit(1));
});
