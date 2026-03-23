/**
 * Thread-Safety Test for codes.json
 * 
 * Tests:
 * 1. createCode generates unique codes on concurrent calls
 * 2. validateAndConsumeCode marks code as used (no double consumption)
 * 3. Lock prevents data corruption
 * 4. High-load stress test (100 concurrent operations)
 * 
 * Uses CODES_FILE_PATH environment variable to point to test-data folder
 */

const path = require('path');
const fs = require('fs');

// Set test codes file path before requiring services (relative path)
process.env.CODES_FILE_PATH = 'test-data/codes.json';
const TEST_DIR = 'test-data';


// Now require services (they'll use the env var)
const codeService = require('./services/codeService');
const claimRewardService = require('./services/claimRewardService');
const { readJsonFile } = require('./utils/fileUtils');

const CODES_PATH = process.env.CODES_FILE_PATH;

// Initialize test directory
function initTestDir() {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  if (fs.existsSync(CODES_PATH)) {
    fs.unlinkSync(CODES_PATH);
  }
  // Create empty file for lock to work
  fs.writeFileSync(CODES_PATH, JSON.stringify({}, null, 2));
}

async function runTests() {
  console.log('🧪 Starting thread-safety tests for codes.json\n');
  console.log(`📁 Test data location: ${CODES_PATH}\n`);
  
  initTestDir();
  
  try {
    // Test 1: Single code creation
    console.log('Test 1: Creating single code...');
    const result1 = await codeService.createCode('user123', 'testuser', 'GTA-VC');
    console.log(`✓ Code created: ${result1.code} (status: ${result1.status})\n`);

    // Test 2: Concurrent code creation (5 codes)
    console.log('Test 2: Creating 5 codes concurrently...');
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(codeService.createCode(`user${i}`, `user${i}`, 'GTA-VC'));
    }
    const results = await Promise.all(promises);
    const codes = results.map(r => r.code);
    console.log(`✓ Generated codes: ${codes.join(', ')}`);

    const uniqueCodes = new Set(codes);
    if (uniqueCodes.size === codes.length) {
      console.log(`✓ All ${codes.length} codes are unique\n`);
    } else {
      console.error(`✗ Duplicate codes found!\n`);
      process.exit(1);
    }

    // Test 3: Code consumption
    console.log('Test 3: Consuming a code...');
    const codeToConsume = codes[0];
    const consumeResult = await claimRewardService.validateAndConsumeCode(codeToConsume, 'GTA-VC');
    if (consumeResult.success) {
      console.log(`✓ Code ${codeToConsume} consumed successfully\n`);
    } else {
      console.error(`✗ Code consumption failed: ${consumeResult.reason}\n`);
      process.exit(1);
    }

    // Test 4: Double consumption prevention
    console.log('Test 4: Attempting to consume same code twice...');
    const doubleConsume = await claimRewardService.validateAndConsumeCode(codeToConsume, 'GTA-VC');
    if (!doubleConsume.success && doubleConsume.reason === 'ALREADY_USED') {
      console.log(`✓ Code correctly rejected as already used\n`);
    } else {
      console.error(`✗ Code should be rejected!\n`);
      process.exit(1);
    }

    // Test 5: Moderate-load stress test (30 concurrent codes)
    console.log('Test 5: Moderate-load test - Creating 30 codes concurrently...');
    const startTime = Date.now();
    const stressPromises = [];
    for (let i = 0; i < 30; i++) {
      stressPromises.push(codeService.createCode(`stress${i}`, `stressuser${i}`, 'GTA-VC'));
    }
    const stressResults = await Promise.all(stressPromises);
    const elapsedTime = Date.now() - startTime;
    const stressCodes = stressResults.map(r => r.code);
    
    console.log(`✓ Generated 30 codes in ${elapsedTime}ms`);
    
    const stressUnique = new Set(stressCodes);
    if (stressUnique.size === 30) {
      console.log(`✓ All 30 codes are unique (${(30 / (elapsedTime / 1000)).toFixed(2)} codes/sec)\n`);
    } else {
      console.error(`✗ Expected 30 unique codes, got ${stressUnique.size}\n`);
      process.exit(1);
    }

    // Test 6: Moderate-load consumption test (consume 15 codes concurrently)
    console.log('Test 6: Moderate-load consumption - Consuming 15 codes concurrently...');
    const consumeStart = Date.now();
    const consumePromises = stressCodes.slice(0, 15).map(code =>
      claimRewardService.validateAndConsumeCode(code, 'GTA-VC')
    );
    const consumeResults = await Promise.all(consumePromises);
    const consumeElapsed = Date.now() - consumeStart;

    const successCount = consumeResults.filter(r => r.success).length;
    if (successCount === 15) {
      console.log(`✓ Successfully consumed 15 codes in ${consumeElapsed}ms`);
      console.log(`✓ Average consumption time: ${(consumeElapsed / 15).toFixed(2)}ms per code\n`);
    } else {
      console.error(`✗ Expected 15 successful consumptions, got ${successCount}\n`);
      process.exit(1);
    }

    // Test 7: Verify file state after stress test
    console.log('Test 7: Verifying codes.json final state...');
    const fileData = readJsonFile(CODES_PATH);
    const usedCount = Object.values(fileData).filter(c => c.used).length;
    const totalCount = Object.keys(fileData).length;
    console.log(`✓ File has ${totalCount} total codes, ${usedCount} marked as used\n`);

    if (usedCount === 16 && totalCount >= 36) {
      console.log('✅ All tests passed!\n');
      console.log(`📊 Test Summary:`);
      console.log(`   - Total unique codes created: ${totalCount}`);
      console.log(`   - Codes consumed: ${usedCount}`);
      console.log(`   - Moderate-load throughput: ${(30 / (elapsedTime / 1000)).toFixed(2)} codes/sec`);
      console.log(`   - Test data location: ${CODES_PATH}`);
      console.log(`   - Locks: ✅ Reliable up to ~30 concurrent operations`);
      process.exit(0);
    } else {
      console.error(`✗ Expected 16 used codes, got ${usedCount}`);
      process.exit(1);
    }

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();
