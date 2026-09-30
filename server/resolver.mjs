import { renderNode } from './structure-render-plan.mjs';
import { choice, validateAnswers } from './jev.mjs';
import { parseCompactTree, collectRequired, MAX_TREE_NODES } from './compact-tree.mjs';


const normalize = name => name.trim().toLowerCase().replace(/\s+/g, ' ');
const matchesName = (name, component) => normalize(component.name) === normalize(name) || component.name.split('/').some(part => normalize(part) === normalize(name));

export function componentCandidates(node, catalog) {
  // Name lookup only; variant/intent decisions still belong to JEV.
  const family = catalog.filter(c => matchesName(node.name, c));
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
  const { required, nodeGroups } = collectRequired(root, node => componentCandidates({ ...node, childCount: node.children.length }, input.catalog));
  console.log('INPUT TREE', JSON.stringify(input.structure));
  console.log('REQUIRED COMPONENTS', JSON.stringify(required));
  console.log('COMPONENT RESOLUTION', JSON.stringify({ elements: nodeGroups.size, decisions: required.length, reused: nodeGroups.size - required.length }));
  const questions = {};
  for (const node of required) {
    const candidates = node.candidateIds.map(id => input.catalog.find(c => c.id === id));
    if (!candidates.length) throw new Error(`${node.paths[0]}: brak komponentu dla ${node.name}.`);
    const knownFamily = candidates.every(c => matchesName(node.name, c));
    questions[node.id] = choice(
      `Select component for ${node.id}. COMPONENT NAME: ${JSON.stringify(node.name)}. INTENT: ${JSON.stringify(node.properties)}. Choose the closest available variant using its name and description. Intent describes the role, not required literal property names (e.g. heading can be implemented by a text size/weight variant). Text content and sizing are applied later by the renderer and intentionally omitted here. Missing copy or unspecified properties are not reasons to reject a component. Preserve defaults where intent is unspecified. ${knownFamily ? 'The requested component family exists. Choose one of its variants; unsupported intent hints do not invalidate the family. This decision selects a component, not whether the entire intended behavior is implemented.' : 'Return unresolved only when no offered component can serve this role.'}`,
      { ...Object.fromEntries(candidates.map(c => [c.id, `COMPONENT NAME: ${JSON.stringify(c.name)}${c.description ? `\nDESCRIPTION: ${JSON.stringify(c.description)}` : ''}`])), ...(!knownFamily ? { unresolved: 'None of the offered components can serve the requested role; not merely an imperfect variant match' } : {}) }
    );
  }
  // Definitions stay local. JEV only needs the intent and named candidates.
  const selected = await ask({ phase: 'component-resolution', requiredComponents: required.map(n => ({ id: n.id, name: n.name, properties: n.properties, childCount: n.childCount })) }, questions, decide);
  function assemble(node) {
    const id = selected[nodeGroups.get(node.path)];
    const component = input.catalog.find(c => c.id === id);
    if (!component) throw new Error(`${node.path}: JEV nie wybrał wariantu dla ${node.name} spośród dostępnych komponentów biblioteki (unresolved).`);
    return renderNode(node, component, node.children.map(assemble));
  }
  const tree = assemble(root);
  console.log('RESOLVED TREE', JSON.stringify(tree));
  return { mode: 'create', tree, exactTree: true, warnings: [], resolutionCount: required.length };
}
