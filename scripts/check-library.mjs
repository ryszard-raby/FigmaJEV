// Run: node --env-file=.env scripts/check-library.mjs FILE_KEY
// Prints status/count only, never credentials or library content.
const started = Date.now();
try {
  const response = await fetch('http://localhost:3847/library', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.FIGMAJEV_TOKEN}` },
    body: JSON.stringify({ fileKey: process.argv[2] }), signal: AbortSignal.timeout(40000)
  });
  const data = await response.json();
  console.log(JSON.stringify({ status: response.status, elapsedMs: Date.now() - started, error: data.error, components: data.components?.length }));
} catch (error) {
  console.log(JSON.stringify({ error: error.message, cause: error.cause?.code, elapsedMs: Date.now() - started }));
  process.exitCode = 1;
}
