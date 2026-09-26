import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { plan } from '../server/legacy-planner.mjs';
import { extractRequirements, requirementState } from '../server/requirements.mjs';

const debug = mock.method(console, 'debug', () => {});
function extraction(state, questions, purposes) {
  if (state.phase === 'requirements-count') return { total: String(purposes.length) };
  if (state.phase === 'requirements-grounding') {
    return Object.fromEntries(Object.keys(questions).map(key => {
      const i = Number(key.match(/\d+/)[0]);
      const index = state.sourceUnits.indexOf(purposes[i]);
      assert.ok(index >= 0);
      return [key, `s${index}`];
    }));
  }
}
const componentChoice = (state, kind) => ({ [`child${state.childIndex}`]: kind, [`text${state.childIndex}`]: 'v0', [`width${state.childIndex}`]: 'KEEP', [`height${state.childIndex}`]: 'KEEP' });

test('descendant actions satisfy ancestors and stop excess children despite oversized counts', async () => {
  const purposes = ['heading', 'login-input', 'password-input', 'cancel-action', 'login-action'];
  const catalog = [{ id: 'card', name: 'Card', slots: [{ path: [0], name: 'Content', capacity: 4, width: 'HUG', height: 'HUG' }] }, { id: 'input', name: 'Input' }, { id: 'button', name: 'Button' }];
  const result = await plan({ prompt: purposes.join(' '), catalog }, async (state, questions) => {
    const extracted = extraction(state, questions, purposes); if (extracted) return extracted;
    if (state.phase === 'requirement-claim') return { requirement: state.candidate.componentId === 'card' ? 'structural' : state.remainingRequirements[0].id };
    if (questions.count) return { count: state.currentPath === 'technical-root' ? '2' : '4', direction: 'VERTICAL', width: 'KEEP', height: 'KEEP' };
    if (state.currentPath === 'technical-root') {
      assert.equal(state.childIndex, 0, 'must never select root duplicate after Card descendants fulfill all requirements');
      return componentChoice(state, 'card');
    }
    if (state.currentPath.endsWith('Content[0]')) return componentChoice(state, ['text', 'input', 'input', 'container'][state.childIndex]);
    assert.ok(state.childIndex < 2, 'exactly two action occurrences');
    return componentChoice(state, 'button');
  });
  assert.equal(result.tree.children.length, 1);
  const content = result.tree.children[0].slots[0].children;
  assert.deepEqual(content.slice(1, 3).map(n => n.componentId), ['input', 'input']);
  assert.deepEqual(content[3].children.map(n => n.componentId), ['button', 'button']);
  assert.deepEqual(content[3].children.map(n => n.requirementId), ['r4', 'r5']);
  assert.equal(content[3].requirementId, undefined);
  assert.equal(result.tree.children[0].requirementId, undefined);
  assert.equal(result.remainingRequirements.length, 0);
  assert.equal(result.fulfilledRequirements.length, 5);
  const stop = result.trace.find(t => t.currentPath === 'technical-root' && t.reason === 'requirements-fulfilled');
  assert.equal(stop.additionalChildren, 0);
  assert.equal(stop.plannedChildren.filter(c => c.requirementId).length, 5);
  assert.ok(debug.mock.calls.some(c => c.arguments[0] === '[planner]' && JSON.parse(c.arguments[1]).reason === 'requirements-fulfilled'));
});

test('explicit quantity expands repeated purposes into distinct occurrences', async () => {
  const purposes = ['inputs', 'inputs'];
  const requirements = await extractRequirements({ prompt: 'two inputs' }, async (state, questions) => extraction(state, questions, purposes));
  assert.deepEqual(requirements.map(r => r.id), ['r1', 'r2']);
  assert.deepEqual(requirements.map(r => r.purpose), ['inputs', 'inputs']);
  const tree = { type: 'container', children: [{ type: 'component', requirementId: 'r1' }] };
  assert.deepEqual(requirementState(requirements, tree, tree, []).remainingRequirements.map(r => r.id), ['r2']);
});

test('tracking is component-agnostic, including images, icons, checkboxes and future components', async () => {
  const purposes = ['portrait', 'brand', 'consent', 'future-purpose'];
  const ids = ['image', 'icon', 'checkbox', 'unknown-design-system-component'];
  const result = await plan({ prompt: purposes.join(' '), catalog: ids.map(id => ({ id, name: id })) }, async (state, questions) => {
    const extracted = extraction(state, questions, purposes); if (extracted) return extracted;
    if (state.phase === 'requirement-claim') return { requirement: state.remainingRequirements[0].id };
    if (questions.count) return { count: '4', direction: 'VERTICAL', width: 'KEEP', height: 'KEEP' };
    return componentChoice(state, ids[state.childIndex]);
  });
  assert.deepEqual(result.tree.children.map(n => n.componentId), ids);
  assert.equal(result.remainingRequirements.length, 0);
});

test('a previously claimed requirement cannot be claimed twice while others remain', async () => {
  const purposes = ['first', 'second'];
  await assert.rejects(plan({ prompt: purposes.join(' '), catalog: [{ id: 'control', name: 'Control' }] }, async (state, questions) => {
    const extracted = extraction(state, questions, purposes); if (extracted) return extracted;
    if (state.phase === 'requirement-claim') return { requirement: 'r1' };
    if (questions.count) return { count: '2', direction: 'VERTICAL', width: 'KEEP', height: 'KEEP' };
    return componentChoice(state, 'control');
  }), /already fulfilled/);
});

test('unfulfilled purposes are reported rather than silently treated as complete', async () => {
  const result = await plan({ prompt: 'portrait', catalog: [] }, async (state, questions) => {
    const extracted = extraction(state, questions, ['portrait']); if (extracted) return extracted;
    return { count: '0', direction: 'VERTICAL', width: 'KEEP', height: 'KEEP' };
  });
  assert.equal(result.remainingRequirements.length, 1);
  assert.match(result.warnings[0], /Unfulfilled requirements/);
});

test('empty remaining requirements bypass child-count/type decisions', async () => {
  let calls = 0;
  const result = await plan({ prompt: 'No content', catalog: [] }, async () => { calls++; return { total: '0' }; });
  assert.equal(calls, 1);
  assert.equal(result.tree.children.length, 0);
  assert.equal(result.trace[0].additionalChildren, 0);
});

test('semantic components with slots still fulfill their own purpose', async () => {
  const result = await plan({ prompt: 'consent', catalog: [{ id: 'control', name: 'Consent control', slots: [{ path: [0], name: 'Content', capacity: 4, width: 'HUG', height: 'HUG' }] }] }, async (state, questions) => {
    const extracted = extraction(state, questions, ['consent']); if (extracted) return extracted;
    if (state.phase === 'requirement-claim') return { requirement: 'r1' };
    assert.equal(state.currentPath, 'technical-root', 'empty remaining requirements must stop slot expansion');
    if (questions.count) return { count: '4', direction: 'VERTICAL', width: 'KEEP', height: 'KEEP' };
    return componentChoice(state, 'control');
  });
  assert.equal(result.tree.children.length, 1);
  assert.equal(result.tree.children[0].requirementId, 'r1');
  assert.equal(result.remainingRequirements.length, 0);
});

test('invalid source spans fail before generating a partially tracked tree', async () => {
  await assert.rejects(extractRequirements({ prompt: 'two inputs' }, async state => state.phase === 'requirements-count'
    ? { total: '1' } : { start0: 's1', end0: 's0' }), /source span/);
});
