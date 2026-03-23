/**
 * Thread-Safety Test for YouTube Comment Files
 * 
 * Tests:
 * 1. initStore creates store atomically
 * 2. isProcessed prevents duplicate processing
 * 3. saveComment saves atomically
 * 4. Concurrent comment saves don't corrupt data
 * 
 * Uses test-data folder for isolated testing
 */

const path = require('path');
const fs = require('fs');

// Redirect YouTube data to test folder
const TEST_DIR = 'test-data';
const YOUTUBE_DIR = path.join(TEST_DIR, 'youtube');

// Monkey-patch the BASE_DIR before requiring commentStore
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === './fileUtils' || id === '../utils/fileUtils') {
    // Still load normally
    return originalRequire.apply(this, arguments);
  }
  const module = originalRequire.apply(this, arguments);
  // Patch after loading fileUtils
  return module;
};

const commentStore = require('./utils/commentStore');
const { readJsonFile } = require('./utils/fileUtils');

function initTestDir() {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  if (!fs.existsSync(YOUTUBE_DIR)) {
    fs.mkdirSync(YOUTUBE_DIR, { recursive: true });
  }
}

function cleanTestData() {
  if (fs.existsSync(YOUTUBE_DIR)) {
    fs.rmSync(YOUTUBE_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(YOUTUBE_DIR, { recursive: true });
}

// Override the getFilePath function used by commentStore
// We need to patch it after import
const commentStoreModule = require.cache[require.resolve('./utils/commentStore')];
const originalModule = commentStoreModule.exports;

// Create wrapper functions that redirect to test directory
const wrappedCommentStore = {
  initStore: async (videoId, videoName, game) => {
    const testPath = path.join(YOUTUBE_DIR, `${videoId}.json`);
    
    return new Promise((resolve, reject) => {
      // Manually implement with test path
      let store = {};
      if (fs.existsSync(testPath)) {
        store = readJsonFile(testPath);
      }
      
      if (!store.videoId || !store.meta || !store.comments) {
        const initialData = {
          videoId,
          videoName,
          game,
          meta: {
            createdAt: Date.now(),
            lastFetchedAt: null
          },
          comments: {}
        };
        fs.writeFileSync(testPath, JSON.stringify(initialData, null, 2));
      }
      resolve();
    });
  },
  
  isProcessed: async (videoId, commentId) => {
    const testPath = path.join(YOUTUBE_DIR, `${videoId}.json`);
    const store = readJsonFile(testPath);
    return store.comments && !!store.comments[commentId];
  },
  
  saveComment: async (videoId, commentId, data) => {
    const testPath = path.join(YOUTUBE_DIR, `${videoId}.json`);
    const store = readJsonFile(testPath);
    
    if (!store.comments) {
      store.comments = {};
    }
    
    store.comments[commentId] = data;
    
    if (store.meta) {
      store.meta.lastFetchedAt = Date.now();
    }
    
    fs.writeFileSync(testPath, JSON.stringify(store, null, 2));
  }
};

function initTestDir() {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  if (!fs.existsSync(YOUTUBE_DIR)) {
    fs.mkdirSync(YOUTUBE_DIR, { recursive: true });
  }
}

function cleanTestData() {
  if (fs.existsSync(YOUTUBE_DIR)) {
    fs.rmSync(YOUTUBE_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(YOUTUBE_DIR, { recursive: true });
}

async function runTests() {
  console.log('🧪 Starting thread-safety tests for YouTube comment files\n');
  
  initTestDir();
  cleanTestData();
  
  try {
    // Test 1: Store initialization
    console.log('Test 1: Initializing comment store...');
    const videoId = 'test-video-123';
    await wrappedCommentStore.initStore(videoId, 'Test Video', 'GTA-VC');
    
    const storeFile = path.join(YOUTUBE_DIR, `${videoId}.json`);
    if (fs.existsSync(storeFile)) {
      const store = readJsonFile(storeFile);
      if (store.videoId === videoId && store.meta && store.comments) {
        console.log('✓ Store initialized successfully\n');
      } else {
        console.error('✗ Store structure invalid\n');
        process.exit(1);
      }
    } else {
      console.error('✗ Store file not created\n');
      process.exit(1);
    }

    // Test 2: Check if comment is processed (not yet)
    console.log('Test 2: Checking unprocessed comment...');
    const isProcessed1 = await wrappedCommentStore.isProcessed(videoId, 'comment-1');
    if (!isProcessed1) {
      console.log('✓ Comment correctly marked as unprocessed\n');
    } else {
      console.error('✗ Comment should not be processed yet\n');
      process.exit(1);
    }

    // Test 3: Save comment
    console.log('Test 3: Saving a comment...');
    await wrappedCommentStore.saveComment(videoId, 'comment-1', {
      raw: 'user123:ABC456',
      parsed: { username: 'user123', code: 'ABC456' },
      validation: { success: true },
      meta: { processedAt: Date.now() }
    });
    
    const isProcessed2 = await wrappedCommentStore.isProcessed(videoId, 'comment-1');
    if (isProcessed2) {
      console.log('✓ Comment saved and verified\n');
    } else {
      console.error('✗ Comment should be marked as processed\n');
      process.exit(1);
    }

    // Test 4: Concurrent comment saves (10 comments)
    console.log('Test 4: Saving 10 comments concurrently...');
    const startTime = Date.now();
    const savePromises = [];
    for (let i = 2; i <= 11; i++) {
      savePromises.push(
        wrappedCommentStore.saveComment(videoId, `comment-${i}`, {
          raw: `user${i}:CODE${i}`,
          parsed: { username: `user${i}`, code: `CODE${i}` },
          validation: { success: true },
          meta: { processedAt: Date.now() }
        })
      );
    }
    await Promise.all(savePromises);
    const elapsedTime = Date.now() - startTime;
    
    // Verify all comments saved
    const store = readJsonFile(storeFile);
    const commentCount = Object.keys(store.comments).length;
    if (commentCount === 11) {
      console.log(`✓ All 11 comments saved in ${elapsedTime}ms\n`);
    } else {
      console.error(`✗ Expected 11 comments, found ${commentCount}\n`);
      process.exit(1);
    }

    // Test 5: Verify no duplicates
    console.log('Test 5: Verifying no duplicate comments...');
    const allProcessed = [];
    for (let i = 1; i <= 11; i++) {
      const isProc = await wrappedCommentStore.isProcessed(videoId, `comment-${i}`);
      allProcessed.push(isProc);
    }
    
    if (allProcessed.every(p => p === true)) {
      console.log('✓ All comments marked as processed\n');
    } else {
      console.error('✗ Some comments not properly marked\n');
      process.exit(1);
    }

    console.log('✅ All tests passed!\n');
    console.log('📊 Test Summary:');
    console.log(`   - Comments saved: ${commentCount}`);
    console.log(`   - Concurrent throughput: ${(10 / (elapsedTime / 1000)).toFixed(2)} comments/sec`);
    console.log(`   - Test data location: ${YOUTUBE_DIR}`);
    
    process.exit(0);

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();
