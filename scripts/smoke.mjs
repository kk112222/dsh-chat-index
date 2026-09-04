// Offline smoke test: emulate the DSH browser module loader with real
// react/react-dom and confirm the bundle materializes and exposes the plugin
// face { apply, inject, name } without throwing.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const req = createRequire(import.meta.url);
const resolve = (name) => {
  // serve react/react-dom from the harness install like the shell seeds do
  try { return req.resolve(name, { paths: ['D:/deepseek/node_modules'] }); }
  catch { return req.resolve(name); }
};

let captured = null;
globalThis.window = {
  __ModuleLoader__: { load: (registration) => { captured = registration; } },
};
globalThis.document = { head: null }; // 01-style guards typeof document
globalThis.CSS = undefined;
globalThis.requestAnimationFrame = undefined; // unused at materialization

const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
// evaluate in a CommonJS-ish sandbox
const fn = new Function('window', 'require', code);
fn(globalThis.window, (spec) => {
  if (spec === 'react' || spec === 'react-dom') return req(resolve(spec));
  throw new Error('unexpected require: ' + spec);
});

if (!captured) throw new Error('bundle did not call __ModuleLoader__.load');
if (captured.id !== 'dsh-chat-index') throw new Error('bad id ' + captured.id);

const factory = captured.factory;
const exports_ = factory((spec) => {
  if (spec === 'react' || spec === 'react-dom') return req(resolve(spec));
  throw new Error('unexpected factory require: ' + spec);
});
console.log('materialized exports keys:', Object.keys(exports_));
if (typeof exports_.apply !== 'function') throw new Error('apply missing');
if (exports_.name !== 'dsh-chat-index') throw new Error('bad name ' + exports_.name);
if (!Array.isArray(exports_.inject)) throw new Error('inject missing');
console.log('smoke OK; inject =', JSON.stringify(exports_.inject));
