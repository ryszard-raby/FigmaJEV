// Compile explicit structure values to the existing renderer contract.
// Semantic hints (importance, purpose, device...) only guide component selection.
const normalize = name => name.split('#')[0].trim().toLowerCase();

const matchesComponentName = (value, component) =>
  normalize(component.name) === normalize(value) || component.name.split('/').some(part => normalize(part) === normalize(value));

export function renderNode(node, component, children, catalog = []) {
  const fail = message => { throw new Error(`${node.path}: ${message}`); };
  const sizing = axis => {
    const explicit = node.properties[axis];
    if (typeof explicit === 'number') {
      if (!Number.isFinite(explicit) || explicit <= 0) fail(`${axis}: wymiar w pikselach musi być dodatnią liczbą.`);
      return explicit;
    }
    const value = String(node.properties[axis] ?? 'KEEP').toUpperCase();
    if (!['KEEP', 'HUG', 'FILL'].includes(value)) fail(`${axis}: użyj keep, hug, fill lub dodatniej liczby pikseli.`);
    return value;
  };
  const definitions = Object.entries(component.properties || {});
  const properties = {};
  for (const [name, value] of Object.entries(node.properties)) {
    const matches = definitions.filter(([key]) => key === name || normalize(key) === normalize(name));
    const exact = matches.find(([key]) => key === name);
    const entry = exact || (matches.length === 1 ? matches[0] : undefined);
    if (!entry) continue;
    const [key, def] = entry;
    // The chosen library variant already determines VARIANT properties.
    if (def.type === 'TEXT' && typeof value === 'string') properties[key] = value;
    if (def.type === 'BOOLEAN' && typeof value === 'boolean') properties[key] = value;
    if (def.type === 'INSTANCE_SWAP' && typeof value === 'string') {
      const keyed = catalog.find(candidate => candidate.key === value);
      const named = catalog.filter(candidate => candidate.key && matchesComponentName(value, candidate));
      const replacement = keyed || (named.length === 1 ? named[0] : undefined);
      if (!replacement) fail(`${name}: nie znaleziono jednoznacznego komponentu ${JSON.stringify(value)} w katalogu.`);
      properties[key] = replacement.key;
    }
  }
  const textOverrides = [];
  if (typeof node.properties.text === 'string') {
    const text = node.properties.text;
    const textDefs = definitions.filter(([, def]) => def.type === 'TEXT');
    const named = textDefs.filter(([key]) => ['label', 'text'].includes(normalize(key)));
    const target = named.length === 1 ? named[0] : textDefs.length === 1 ? textDefs[0] : undefined;
    if (!Object.entries(properties).some(([key, value]) => component.properties[key].type === 'TEXT' && value === text)) {
      if (target) {
        if (Object.hasOwn(properties, target[0]) && properties[target[0]] !== text) fail('Sprzeczne wartości text i właściwości tekstowej.');
        properties[target[0]] = text;
      } else {
        const targets = component.textTargets || [];
        const namedTargets = targets.filter(t => ['label', 'text'].includes(normalize(t.name)));
        const layer = namedTargets.length === 1 ? namedTargets[0] : targets.length === 1 ? targets[0] : undefined;
        if (!layer) fail(`Brak jednoznacznego miejsca dla tekstu w ${component.name}. Podaj nazwę właściwości TEXT z biblioteki.`);
        textOverrides.push({ path: layer.path, text });
      }
    }
  }
  const slots = component.slots || [];
  let destination;
  if (children.length) {
    const named = slots.filter(s => normalize(s.name) === normalize(String(node.properties.slot ?? 'Content')));
    destination = named.length === 1 ? named[0] : node.properties.slot === undefined && slots.length === 1 ? slots[0] : undefined;
    if (!destination) fail(`Brak jednoznacznego slotu Content w ${component.name}. Podaj property slot z nazwą slotu.`);
  }
  return {
    type: 'component', componentId: component.id, sourcePath: node.path,
    width: sizing('width'), height: sizing('height'), properties, textOverrides,
    slots: slots.map(slot => ({ path: slot.path, mode: 'replace', children: slot === destination ? children : [] }))
  };
}
