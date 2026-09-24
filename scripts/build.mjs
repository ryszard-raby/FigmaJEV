import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['plugin/code.ts'], outfile: 'dist/code.js', bundle: true, target: 'es2017' });
await copyFile('plugin/ui.html', 'dist/ui.html');
console.log('Built dist/code.js and dist/ui.html');
