import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({ entryPoints: ['plugin/variables-css.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { exportVariablesCss } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
const collection = { id: 'c', name: 'Theme', defaultModeId: 'light', modes: [{modeId:'dark',name:'Dark'}, {modeId:'light',name:'Light'}] };
function token(id, values, extra = {}) { return { id, name: id, variableCollectionId:'c', valuesByMode: values, scopes: [], resolvedType:'FLOAT', ...extra }; }
function api(tokens, local=tokens) { return { getLocalVariablesAsync: async()=>local, getVariableByIdAsync:async id=>tokens.find(v=>v.id===id), getVariableCollectionByIdAsync: async()=>collection }; }
test('exports modes, external alias dependencies, WEB names, dimensions and opacity', async()=>{
 const base=token('base', {light:{r:1,g:0,b:0},dark:{r:0,g:0,b:0,a:0.5}}, {resolvedType:'COLOR',codeSyntax:{WEB:'var(--brand)'}});
 const alias=token('accent',{light:{type:'VARIABLE_ALIAS',id:'base'},dark:{type:'VARIABLE_ALIAS',id:'base'}});
 const gap=token('gap',{light:8,dark:12},{scopes:['GAP']});
 const opacity=token('opacity',{light:0.5,dark:1},{scopes:['OPACITY']});
 const {css,count}=await exportVariablesCss(api([base,alias,gap,opacity],[alias,gap,opacity]));
 assert.equal(count,4); assert.match(css,/--cd-accent: var\(--brand\)/);
 assert.match(css,/--brand: #00000080;/);
 assert.match(css,/--brand: #ff0000;/);
 assert.match(css,/--cd-gap: 8px/); assert.match(css,/--cd-opacity: 0.5;/);
 assert.ok(css.indexOf(':root,')<css.indexOf(':root[data-cd-theme="dark"]'));
});
test('protects CSS comments and strings, resolves generated name collisions', async()=>{
 const values={light:'hello"; color:red; /*',dark:'bye'};
 const a=token('a',values,{name:'A/B',description:'*/ injected',resolvedType:'STRING'});
 const b=token('b',values,{name:'A B',resolvedType:'STRING'});
 const {css}=await exportVariablesCss(api([a,b]));
 assert.ok(css.includes('* / injected')); assert.ok(css.includes('--cd-a-b-2:'));
 assert.ok(css.includes('hello\\"; color:red; /*'));
});
test('fails clearly on missing dependencies, empty collections and duplicate WEB names',async()=>{
 await assert.rejects(exportVariablesCss(api([])),/Brak lokalnych/);
 await assert.rejects(exportVariablesCss(api([token('a',{light:{type:'VARIABLE_ALIAS',id:'missing'}})])),/Niedostępny alias/);
 const a=token('a',{light:1,dark:2},{codeSyntax:{WEB:'--same'}});
 const b=token('b',{light:1,dark:2},{codeSyntax:{WEB:'--same'}});
 await assert.rejects(exportVariablesCss(api([a,b])),/Powtórzona nazwa CSS/);
});
