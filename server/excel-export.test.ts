import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use a temp directory so tests don't touch real exports
const testExportsDir = resolve(__dirname, '../exports_test');
const testMasterPath = resolve(testExportsDir, 'research_data_master.xlsx');

// Patch the module's paths by importing after setup
// We'll test the queue behavior by importing the real module and using a temp file.
// Since the module resolves paths at import time, we test the queue logic directly.

describe('Excel export write queue', () => {
  // Test that the enqueue pattern serializes concurrent operations
  it('serializes concurrent writes so no data is lost', async () => {
    let writeQueue: Promise<void> = Promise.resolve();
    const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
      const result = writeQueue.then(fn, fn);
      writeQueue = result.then(() => {}, () => {});
      return result;
    };

    const results: number[] = [];
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    // Simulate concurrent read-modify-write operations
    // Without serialization, these would interleave and lose data
    const op1 = enqueue(async () => {
      await delay(50); // simulate file read
      results.push(1);
      await delay(10); // simulate file write
      return true;
    });

    const op2 = enqueue(async () => {
      await delay(10);
      results.push(2);
      await delay(10);
      return true;
    });

    const op3 = enqueue(async () => {
      results.push(3);
      return true;
    });

    await Promise.all([op1, op2, op3]);

    // All three operations should complete in order
    assert.deepEqual(results, [1, 2, 3], 'Operations should execute in order');
  });

  it('continues processing after a failed operation', async () => {
    let writeQueue: Promise<void> = Promise.resolve();
    const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
      const result = writeQueue.then(fn, fn);
      writeQueue = result.then(() => {}, () => {});
      return result;
    };

    const results: string[] = [];

    const op1 = enqueue(async () => {
      results.push('first');
      return true;
    });

    const op2 = enqueue(async (): Promise<boolean> => {
      throw new Error('simulated failure');
    });

    const op3 = enqueue(async () => {
      results.push('third');
      return true;
    });

    await op1;
    await assert.rejects(op2, { message: 'simulated failure' });
    await op3;

    assert.deepEqual(results, ['first', 'third'], 'Queue should continue after failure');
  });
});

describe('Message deduplication logic', () => {
  interface Message {
    id: string;
    content: string;
    sender: string;
    timestamp: Date;
  }

  // Simulates the deduplication logic from the moderator chat page
  const addMessageWithDedup = (messages: Message[], newMsg: Message): Message[] => {
    if (messages.some(m => m.id === newMsg.id)) return messages;
    return [...messages, newMsg];
  };

  it('adds a new message', () => {
    const messages: Message[] = [];
    const msg = { id: 'msg_1', content: 'hello', sender: 'participant', timestamp: new Date() };
    const result = addMessageWithDedup(messages, msg);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'msg_1');
  });

  it('rejects a duplicate message', () => {
    const msg = { id: 'msg_1', content: 'hello', sender: 'participant', timestamp: new Date() };
    const messages: Message[] = [msg];
    const result = addMessageWithDedup(messages, msg);
    assert.equal(result.length, 1, 'Duplicate should not be added');
  });

  it('rejects duplicate even with different content (same id)', () => {
    const msg1 = { id: 'msg_1', content: 'hello', sender: 'participant', timestamp: new Date() };
    const msg2 = { id: 'msg_1', content: 'different', sender: 'moderator', timestamp: new Date() };
    const messages: Message[] = [msg1];
    const result = addMessageWithDedup(messages, msg2);
    assert.equal(result.length, 1, 'Same ID should be rejected regardless of content');
    assert.equal(result[0].content, 'hello', 'Original message should be preserved');
  });

  it('allows messages with different ids', () => {
    const msg1 = { id: 'msg_1', content: 'hello', sender: 'participant', timestamp: new Date() };
    const msg2 = { id: 'msg_2', content: 'world', sender: 'moderator', timestamp: new Date() };
    const messages: Message[] = [msg1];
    const result = addMessageWithDedup(messages, msg2);
    assert.equal(result.length, 2);
  });
});
