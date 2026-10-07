import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { loggedPlan } from './logged-plan.mjs';
import { readFile } from 'node:fs/promises';
import { documentationPath, saveDocumentation } from './documentation.mjs';

const token = process.env.FIGMAJEV_TOKEN;
if (!token || token.length < 20 || token === 'replace-with-a-long-random-token') throw new Error('Ustaw własny FIGMAJEV_TOKEN (min. 20 znaków) w .env.');
let busy = false;
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'GET' && req.url === '/documentation') {
    try { const text = await readFile(documentationPath, 'utf8'); res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' }); res.end(text); }
    catch { send(404, { error: 'Najpierw pobierz bibliotekę lub użyj przycisku Otwórz w GPT.' }); }
    return;
  }
  const actual = Buffer.from(req.headers.authorization || '');
  const expected = Buffer.from(`Bearer ${token}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return send(401, { error: 'Token lokalnego serwera nie pasuje. Wklej we wtyczce wartość FIGMAJEV_TOKEN z głównego pliku .env (nie FIGMA_ACCESS_TOKEN). Po zmianie .env uruchom serwer ponownie.' });
  if (req.method !== 'POST' || !['/plan', '/library', '/documentation'].includes(req.url)) return send(404, { error: 'Nieznana operacja.' });
  if (busy) return send(429, { error: 'Serwer przetwarza poprzednie żądanie.' });
  busy = true;
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  try {
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 500000) throw new Error('Dane przekraczają limit 500 kB.');
      chunks.push(chunk);
    }
    const input = JSON.parse(Buffer.concat(chunks).toString());
    if (req.url === '/documentation') { send(200, await saveDocumentation(input.catalog, input.libraryName)); return; }
    if (req.url === '/library') {
      if (!/^[a-zA-Z0-9_-]{5,100}$/.test(input.fileKey)) throw new Error('Nieprawidłowy klucz pliku Figmy.');
      if (!process.env.FIGMA_ACCESS_TOKEN) throw new Error('Ustaw FIGMA_ACCESS_TOKEN w .env serwera.');
      const response = await fetch(`https://api.figma.com/v1/files/${input.fileKey}/components`, {
        headers: { 'X-Figma-Token': process.env.FIGMA_ACCESS_TOKEN }, signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) throw new Error(`Biblioteka Figma: HTTP ${response.status}.`);
      const data = await response.json();
      if (!Array.isArray(data.meta?.components)) throw new Error('Nieprawidłowa odpowiedź biblioteki.');
      if (data.meta.components.length > 180) throw new Error('Biblioteka ma ponad 180 wariantów. Użyj mniejszej biblioteki lub instancji w pliku.');
      const components = data.meta.components.map(c => ({ id: c.key, key: c.key, name: [c.containing_frame?.name, c.name].filter(Boolean).join(' / '), description: c.description || '' })).sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base', numeric: true }));
      send(200, { components });
    } else {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(180000)]);
      send(200, await loggedPlan(input, { apiKey: process.env.TYPESAFE_API_KEY, signal }));
    }
  } catch (error) { send(400, { error: error instanceof Error ? error.message : 'Błąd serwera.' }); }
  finally { busy = false; }
});
server.requestTimeout = 30000;
server.listen(Number(process.env.PORT || 3847), '127.0.0.1', () => console.log('FigmaJev: http://localhost:3847'));
