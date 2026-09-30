import { renderNode } from './structure-render-plan.mjs';
import { choice, validateAnswers } from './jev.mjs';
import { parseCompactTree, collectRequired, MAX_TREE_NODES } from './compact-tree.mjs';


export function componentCandidates(node, catalog) {
  const normalize = name => name.trim().toLowerCase().replace(/\s+/g, ' ');
  const requested = normalize(node.name);
  // Name lookup only; variant/intent decisions still belong to JEV.
  const family = catalog.filter(c => normalize(c.name) === requested || c.name.split('/').some(part => normalize(part) === requested));
  const pool = family.length ? family : catalog;
  return pool.filter(c => !node.childCount || (c.slots || []).some(s => (s.settings?.maxChildren ?? MAX_TREE_NODES) >= node.childCount));
}

export async function ask(state, questions, decide) {
  if (!Object.keys(questions).length) return {};
  console.log('JEV REQUEST', JSON.stringify({ state, questions }));
  const result = await decide(state, questions);
  console.log('JEV RESPONSE', JSON.stringify(result));
  // Keep validation at this boundary as well as in the live client.
  validateAnswers(questions, Object.fromEntries(Object.entries(result).map(([k, v]) => [k, { type: 'choice', choice: v }])));
  return result;
}

export function validateCatalog(catalog) {
  if (!Array.isArray(catalog) || catalog.length > 180 || new Set(catalog.map(c => c?.id)).size !== catalog.length || catalog.some(c => !c || typeof c.id !== 'string' || typeof c.name !== 'string')) throw new Error('Nieprawidłowy katalog (maks. 180 komponentów).');
}

export async function resolveTree(input, decide) {
  validateCatalog(input.catalog);
  const root = parseCompactTree(input.structure);
  const { required, nodeGroups } = collectRequired(root);
  console.log('INPUT TREE', JSON.stringify(input.structure));
  console.log('REQUIRED COMPONENTS', JSON.stringify(required));
  const questions = {};
  for (const node of required) {
    const candidates = componentCandidates(node, input.catalog);
    if (!candidates.length) throw new Error(`${node.paths[0]}: brak komponentu dla ${node.name}.`);
    questions[node.id] = choice(
      'Choose the closest Design System component/variant for this element and its intent. Preserve library defaults for unspecified properties. Only choose a component; do not plan children or properties. Prefer a useful available variant even when it cannot implement every hint. Use unresolved only if no component is suitable.',
      { ...Object.fromEntries(candidates.map(c => [c.id, `${c.name}${c.description ? `: ${c.description}` : ''}`])), unresolved: 'No suitable Design System component' }
    );
  }
  // Definitions stay local. JEV only needs the intent and named candidates.
  const selected = await ask({ phase: 'component-resolution', requiredComponents: required.map(n => ({ id: n.id, name: n.name, properties: n.properties, childCount: n.childCount })) }, questions, decide);
  function assemble(node) {
    const id = selected[nodeGroups.get(node.path)];
    const component = input.catalog.find(c => c.id === id);
    if (!component) throw new Error(`${node.path}: brak komponentu dla ${node.name}.`);
    return renderNode(node, component, node.children.map(assemble));
  }
  const tree = assemble(root);
  console.log('RESOLVED TREE', JSON.stringify(tree));
  return { mode: 'create', tree, exactTree: true, warnings: [], resolutionCount: required.length };
}