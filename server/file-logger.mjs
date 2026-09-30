import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

export function createFileLogger(directory = resolve('logs')) {
  let currentPrompt;
  let queue = Promise.resolve();
  const write = (name, value) => writeFile(join(directory, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return (direction, payload, metadata = {}) => {
    const operation = queue.then(async () => {
      await mkdir(directory, { recursive: true });
      const entry = { timestamp: new Date().toISOString(), direction, ...metadata, payload };
      if (direction === 'user_prompt') {
        currentPrompt = metadata.promptId;
        // Keep editor tabs open, but never display previous-run answers as current.
        for (const name of await readdir(directory)) {
          const match = /^(request|response)-(\d+)\.json$/.exec(name);
          if (match) await write(name, { promptId: currentPrompt, requestNumber: Number(match[2]), status: 'not_called' });
        }
        await write('summary.json', { promptId: currentPrompt, status: 'running' });
        await write('prompt.json', entry);
        return;
      }
      // Concurrent older runs must not overwrite the latest prompt's files.
      if (currentPrompt !== undefined && metadata.promptId !== currentPrompt) return;
      if (direction === 'prompt_summary') return write('summary.json', entry);
      if (!['request', 'response', 'error'].includes(direction)) return;
      const number = metadata.requestNumber;
      if (!Number.isSafeInteger(number) || number < 1) throw new Error('Invalid log requestNumber');
      if (direction === 'request') {
        await write(`response-${number}.json`, { ...metadata, status: 'pending' });
        return write(`request-${number}.json`, entry);
      }
      return write(`response-${number}.json`, entry);
    });
    queue = operation.catch(() => {});
    return operation;
  };
}

export const logDefApi = createFileLogger();
