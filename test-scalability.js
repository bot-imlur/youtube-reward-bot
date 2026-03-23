/**
 * Scalability Test: Find the breaking point for concurrent operations
 * Tests with increasing load: 30, 50, 75, 100 concurrent codes
 */

const path = require('path');
const fs = require('fs');

// Set test codes file path before requiring services
process.env.CODES_FILE_PATH = 'test-data/codes.json';
const TEST_DIR = 'test-data';

const codeService = require('./services/codeService');
const { readJsonFile } = require('./utils/fileUtils');

const CODES_PATH = process.env.CODES_FILE_PATH;

function initTestDir() {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  if (fs.existsSync(CODES_PATH)) {
    fs.unlinkSync(CODES_PATH);
  }
  fs.writeFileSync(CODES_PATH, JSON.stringify({}, null, 2));
}

function cleanStaleLocks() {
  const lockFile = CODES_PATH + '.lock';
  if (fs.existsSync(lockFile)) {
    try {
      fs.unlinkSync(lockFile);
    } catch (e) {
      // Ignore
    }
  }
}

async function testConcurrency(numCodes) {
  console.log(`\n⏱️  Testing ${numCodes} concurrent code generations...`);
  const startTime = Date.now();
  
  try {
    const promises = [];
    for (let i = 0; i < numCodes; i++) {
      promises.push(codeService.createCode(`user${i}`, `user${i}`, 'GTA-VC'));
    }
    
    const results = await Promise.all(promises);
    const elapsedTime = Date.now() - startTime;
    const codes = results.map(r => r.code);
    const uniqueCodes = new Set(codes);
    
    const fileData = readJsonFile(CODES_PATH);
    const totalInFile = Object.keys(fileData).length;
    
    if (uniqueCodes.size === numCodes) {
      console.log(`✅ SUCCESS: ${numCodes} codes in ${elapsedTime}ms`);
      console.log(`   - Throughput: ${(numCodes / (elapsedTime / 1000)).toFixed(2)} codes/sec`);
      console.log(`   - Avg time/code: ${(elapsedTime / numCodes).toFixed(2)}ms`);
      console.log(`   - File contains: ${totalInFile} codes`);
      return { success: true, elapsedTime, throughput: numCodes / (elapsedTime / 1000) };
    } else {
      console.log(`❌ FAILED: Expected ${numCodes} unique codes, got ${uniqueCodes.size}`);
      return { success: false, elapsedTime };
    }
  } catch (err) {
    console.log(`❌ ERROR: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function runScalabilityTest() {
  console.log('🧪 Scalability Test: Finding Breaking Point for File Locking\n');
  console.log('📁 Test data location: ' + CODES_PATH);
  
  initTestDir();
  
  const testSizes = [30, 50, 75, 100];
  const results = [];
  
  for (const size of testSizes) {
    cleanStaleLocks();
    const result = await testConcurrency(size);
    results.push({ size, ...result });
    
    if (!result.success) {
      console.log(`\n⚠️  Breaking point found at ${size} concurrent operations`);
      break;
    }
    
    // Small delay between tests
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n\n📊 Scalability Summary:');
  console.log('═'.repeat(60));
  results.forEach(r => {
    if (r.success) {
      console.log(`${r.size.toString().padEnd(5)} ✅ ${r.elapsedTime}ms | ${r.throughput.toFixed(2)} codes/sec`);
    } else {
      console.log(`${r.size.toString().padEnd(5)} ❌ ${r.error || 'Lock timeout'}`);
    }
  });
  
  const maxSuccessful = results.filter(r => r.success).pop();
  if (maxSuccessful) {
    console.log('\n✅ Maximum reliable concurrent operations: ' + maxSuccessful.size);
  }
}

runScalabilityTest();
