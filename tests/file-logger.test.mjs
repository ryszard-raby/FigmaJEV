import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFileLogger } from '../server/file-logger.mjs';

test('numbered log files are overwritten, stale files cleared in place, and errors replace responses', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'figmajev-logs-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const log = createFileLogger(dir);
  const read = async name => JSON.parse(await readFile(join(dir, name), 'utf8'));
  await log('user_prompt', { prompt: 'first' }, { promptId: 'a' });
  for (const n of [1, 2]) {
    await log('request', { question: 'old' }, { promptId: 'a', requestNumber: n });
    await log('response', { answer: 'old' }, { promptId: 'a', requestNumber: n });
  }
  await log('prompt_summary', { jevRequests: 2 }, { promptId: 'a' });
  const names = await readdir(dir);
  await log('user_prompt', { prompt: 'second' }, { promptId: 'b' });
  assert.equal((await read('request-2.json')).status, 'not_called');
  assert.equal((await read('response-2.json')).status, 'not_called');
  await log('request', { question: 'new' }, { promptId: 'b', requestNumber: 1 });
  assert.equal((await read('response-1.json')).status, 'pending');
  await log('error', { status: 400, detail: 'failed' }, { promptId: 'b', requestNumber: 1 });
  assert.equal((await read('request-1.json')).payload.question, 'new');
  assert.equal((await read('response-1.json')).direction, 'error');
  assert.equal((await read('response-1.json')).payload.status, 400);
  await log('response', { answer: 'late old response' }, { promptId: 'a', requestNumber: 1 });
  assert.equal((await read('response-1.json')).promptId, 'b');
  await log('prompt_summary', { jevRequests: 1 }, { promptId: 'b' });
  assert.equal((await read('summary.json')).payload.jevRequests, 1);
  assert.deepEqual(await readdir(dir), names);
  assert.ok((await readFile(join(dir, 'request-1.json'), 'utf8')).includes('\n  "'));
});
