import { choice } from './jev.mjs';

const requirementRules = 'Count semantic content/control occurrences requested by the user, not layout wrappers, containers, positioning, styles or component variants. Preserve explicit quantities. Two controls of the same type are two requirements; distinct named purposes are separate requirements. Do not invent implicit fields. For an insertion request count only the requested additions, not existing context.';

// JEV chooses typed values rather than generating prose. Ground every purpose
// in a span of the original request; occurrence IDs keep repeated items distinct.
export async function extractRequirements(input, decide) {
  const { total } = await decide({ phase: 'requirements-count', prompt: input.prompt, context: input.context }, {
    total: choice(`How many semantic element occurrences are explicitly required? ${requirementRules}`, {
      ...Object.fromEntries(Array.from({ length: 33 }, (_, i) => [String(i), `${i} semantic occurrences`])),
      overflow: 'More than 32 semantic occurrences'
    })
  });
  if (total === 'overflow') throw new Error('Request exceeds the limit of 32 semantic requirements.');
  if (!/^\d+$/.test(total) || Number(total) > 32) throw new Error('Invalid requirement count.');
  if (Number(total) === 0) return [];
  const words = input.prompt.match(/\S+/g) || [];
  const chunkSize = Math.max(1, Math.ceil(words.length / 240));
  const sourceUnits = [];
  for (let i = 0; i < words.length; i += chunkSize) sourceUnits.push(words.slice(i, i + chunkSize).join(' '));
  const criteria = Object.fromEntries(sourceUnits.map((text, i) => [`s${i}`, `${i}: ${text}`]));
  const questions = {};
  for (let i = 0; i < Number(total); i++) {
    const instruction = `Identify semantic occurrence ${i + 1} of ${total}, in request order. Expand quantities into separate occurrences before proceeding to the next purpose. ${requirementRules} Select the shortest source span identifying its purpose; repeated occurrences may share a span.`;
    questions[`start${i}`] = choice(`${instruction} Choose the START source unit.`, criteria);
    questions[`end${i}`] = choice(`${instruction} Choose the END source unit (inclusive).`, criteria);
  }
  const answers = await decide({ phase: 'requirements-grounding', prompt: input.prompt, sourceUnits, total: Number(total) }, questions);
  return Array.from({ length: Number(total) }, (_, i) => {
    const start = Number(answers[`start${i}`]?.slice(1));
    const end = Number(answers[`end${i}`]?.slice(1));
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end >= sourceUnits.length) throw new Error('Invalid requirement source span.');
    return { id: `r${i + 1}`, purpose: sourceUnits.slice(start, end + 1).join(' '), occurrence: i + 1 };
  });
}

export function plannedElements(tree, catalog = []) {
  const result = [];
  function walk(node, path) {
    result.push({ path, type: node.type, componentId: node.componentId,
      name: node.name || catalog.find(c => c.id === node.componentId)?.name,
      text: node.text, requirementId: node.requirementId });
    for (const [i, child] of (node.children || []).entries()) walk(child, `${path}/${i + 1}`);
    for (const slot of node.slots || []) for (const [i, child] of slot.children.entries()) walk(child, `${path}/Content[${slot.path.join('.')}]/${i + 1}`);
  }
  walk(tree, 'root');
  return result;
}

export function requirementState(requiredRequirements, tree, subtree, catalog) {
  const all = plannedElements(tree, catalog);
  const fulfilledIds = new Set(all.filter(n => n.type !== 'container').map(n => n.requirementId).filter(Boolean));
  return {
    requiredRequirements,
    fulfilledRequirements: requiredRequirements.filter(r => fulfilledIds.has(r.id)),
    remainingRequirements: requiredRequirements.filter(r => !fulfilledIds.has(r.id)),
    plannedChildren: plannedElements(subtree, catalog).slice(1)
  };
}

export function logPlannerStep(record) {
  console.debug('[planner]', JSON.stringify(record));
}
