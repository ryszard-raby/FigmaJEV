type CatalogItem = { id: string; key: string; nodeId?: string; name: string; description: string };
type Library = { id: string; name: string; components: CatalogItem[] };
type Tree = { type: 'container' | 'text' | 'component'; name?: string; direction?: 'HORIZONTAL' | 'VERTICAL'; gap?: number; padding?: number; children?: Tree[]; text?: string; componentId?: string };
type Snapshot = { targetId: string; nodes: any[] };
type Operation = { id: string; field: string; value: any };
type Plan = { mode: 'create'; tree: Tree } | { mode: 'edit'; targetId: string; operations: Operation[] };
let libraries: Library[] = [];
let pinned: string | null = null;
let pending: { context: Snapshot | null; catalog: CatalogItem[]; pageId: string } | null = null;
let active = false;
const send = (type: string, data: object = {}) => figma.ui.postMessage({ type, ...data });
figma.showUI(__html__, { width: 420, height: 690, themeColors: true });

async function selection() {
  const node = pinned ? await figma.getNodeByIdAsync(pinned) : figma.currentPage.selection.length === 1 ? figma.currentPage.selection[0] : null;
  if (pinned && !node) pinned = null;
  send('selection', { node: node ? { id: node.id, name: node.name, type: node.type } : null, pinned: Boolean(pinned) });
}
figma.on('selectionchange', () => { void selection(); });
figma.on('currentpagechange', () => { if (!active) { pinned = null; pending = null; } void selection(); });

function item(c: ComponentNode): CatalogItem {
  return { id: c.key || c.id, key: c.key, nodeId: c.id, name: c.parent?.type === 'COMPONENT_SET' ? `${c.parent.name} / ${c.name}` : c.name, description: c.description };
}
async function scan() {
  await figma.loadAllPagesAsync();
  const local = new Map<string, CatalogItem>();
  const remote = new Map<string, CatalogItem>();
  for (const page of figma.root.children) {
    for (const c of page.findAllWithCriteria({ types: ['COMPONENT'] })) if (!c.remote) local.set(c.key || c.id, item(c));
    for (const instance of page.findAllWithCriteria({ types: ['INSTANCE'] })) {
      const c = await instance.getMainComponentAsync();
      if (c?.remote) remote.set(c.key, item(c));
    }
  }
  libraries = libraries.filter(l => l.id !== 'local' && l.id !== 'used');
  libraries.unshift({ id: 'local', name: `Ten plik (${local.size})`, components: [...local.values()] }, { id: 'used', name: `Użyte komponenty z bibliotek (${remote.size})`, components: [...remote.values()] });
  send('libraries', { libraries });
}

async function snapshot(root: SceneNode): Promise<Snapshot> {
  const nodes: any[] = [];
  async function visit(n: SceneNode, parentId?: string) {
    if (nodes.length >= 80) throw new Error('Wybierz mniejszy element: limit kontekstu to 80 warstw.');
    const data: any = { id: n.id, name: n.name, type: n.type, parentId, visible: n.visible, width: n.width, height: n.height };
    if ('layoutMode' in n && n.layoutMode !== 'NONE') data.layout = { direction: n.layoutMode, gap: n.itemSpacing };
    if (n.type === 'TEXT') data.text = n.characters;
    if (n.type === 'INSTANCE') {
      const main = await n.getMainComponentAsync();
      const definitions = main?.parent?.type === 'COMPONENT_SET' ? main.parent.componentPropertyDefinitions : main?.componentPropertyDefinitions;
      data.properties = Object.fromEntries(Object.entries(n.componentProperties).map(([key, value]) => [key, { ...value, options: definitions?.[key]?.variantOptions }]));
      data.componentKey = main?.key;
    }
    nodes.push(data);
    if ('children' in n) for (const child of n.children) await visit(child, n.id);
  }
  await visit(root);
  return { targetId: root.id, nodes };
}

async function build(tree: Tree, catalog: CatalogItem[], parent: FrameNode, budget: { count: number }, depth = 0): Promise<SceneNode> {
  if (++budget.count > 40 || depth > 5) throw new Error('Plan przekracza limit rozmiaru.');
  if (tree.type === 'component') {
    const entry = catalog.find(c => c.id === tree.componentId);
    if (!entry) throw new Error('Komponent spoza wybranej biblioteki.');
    const local = entry.nodeId ? await figma.getNodeByIdAsync(entry.nodeId) : null;
    const component = local?.type === 'COMPONENT' ? local : await figma.importComponentByKeyAsync(entry.key);
    const instance = component.createInstance(); parent.appendChild(instance); return instance;
  }
  if (tree.type === 'text') {
    if (typeof tree.text !== 'string' || tree.text.length > 1000) throw new Error('Nieprawidłowy tekst.');
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    const text = figma.createText(); parent.appendChild(text);
    text.fontName = { family: 'Inter', style: 'Regular' }; text.characters = tree.text; text.fontSize = 16;
    return text;
  }
  if (tree.type !== 'container' || !['HORIZONTAL', 'VERTICAL'].includes(tree.direction || '') || ![0, 8, 16, 24, 32].includes(tree.gap!)) throw new Error('Nieprawidłowy kontener.');
  const frame = figma.createFrame(); parent.appendChild(frame);
  frame.name = tree.name || 'Container'; frame.layoutMode = tree.direction!; frame.itemSpacing = tree.gap!;
  frame.primaryAxisSizingMode = 'AUTO'; frame.counterAxisSizingMode = 'AUTO'; frame.fills = []; frame.clipsContent = false;
  frame.paddingTop = frame.paddingBottom = frame.paddingLeft = frame.paddingRight = depth === 0 ? 24 : 0;
  for (const child of tree.children || []) await build(child, catalog, frame, budget, depth + 1);
  return frame;
}

async function apply(plan: Plan) {
  if (!pending || pending.pageId !== figma.currentPage.id) throw new Error('Strona uległa zmianie. Wygeneruj plan ponownie.');
  if (plan.mode === 'create') {
    if (pending.context) throw new Error('Nieprawidłowy tryb odpowiedzi.');
    const staging = figma.createFrame(); staging.visible = false; staging.name = 'FigmaJev staging';
    try {
      const node = await build(plan.tree, pending.catalog, staging, { count: 0 });
      figma.currentPage.appendChild(node);
      node.x = figma.viewport.center.x - node.width / 2; node.y = figma.viewport.center.y - node.height / 2;
      figma.currentPage.selection = [node]; figma.viewport.scrollAndZoomIntoView([node]);
    } finally { staging.remove(); }
  } else {
    const before = pending.context;
    if (!before || before.targetId !== plan.targetId) throw new Error('Nieprawidłowy cel edycji.');
    const root = await figma.getNodeByIdAsync(before.targetId);
    if (!root || root.type === 'PAGE' || root.type === 'DOCUMENT') throw new Error('Przypięty element został usunięty.');
    if (JSON.stringify(await snapshot(root)) !== JSON.stringify(before)) throw new Error('Element zmienił się podczas generowania. Spróbuj ponownie.');
    const actions: { apply: () => void; undo: () => void }[] = [];
    for (const op of plan.operations) {
      if (!before.nodes.some(n => n.id === op.id)) throw new Error('Zmiana poza przypiętym elementem.');
      const n = await figma.getNodeByIdAsync(op.id);
      if (!n) throw new Error('Brak warstwy.');
      if (op.field === 'direction' && 'layoutMode' in n && ['HORIZONTAL', 'VERTICAL'].includes(op.value)) {
        const old = n.layoutMode; actions.push({ apply: () => { n.layoutMode = op.value; }, undo: () => { n.layoutMode = old; } });
      } else if (op.field === 'gap' && 'itemSpacing' in n && [0, 8, 16, 24, 32].includes(op.value)) {
        const old = n.itemSpacing; actions.push({ apply: () => { n.itemSpacing = op.value; }, undo: () => { n.itemSpacing = old; } });
      } else if (op.field === 'text' && n.type === 'TEXT' && typeof op.value === 'string') {
        const old = n.characters;
        const fonts = n.getRangeAllFontNames(0, n.characters.length);
        if (!fonts.length && n.fontName !== figma.mixed) fonts.push(n.fontName);
        for (const font of fonts) await figma.loadFontAsync(font);
        actions.push({ apply: () => { n.characters = op.value; }, undo: () => { n.characters = old; } });
      } else if (op.field.startsWith('property:') && n.type === 'INSTANCE') {
        const name = op.field.slice(9); const old = n.componentProperties[name]?.value;
        const def = before.nodes.find(x => x.id === n.id).properties?.[name];
        if (old === undefined || !def || (def.type === 'BOOLEAN' ? typeof op.value !== 'boolean' : typeof op.value !== 'string') || (def.type === 'VARIANT' && !def.options?.includes(op.value))) throw new Error('Nieprawidłowa właściwość instancji.');
        for (const text of n.findAllWithCriteria({ types: ['TEXT'] })) for (const font of text.getRangeAllFontNames(0, text.characters.length)) await figma.loadFontAsync(font);
        actions.push({ apply: () => n.setProperties({ [name]: op.value }), undo: () => n.setProperties({ [name]: old }) });
      } else throw new Error('Nieobsługiwana operacja edycji.');
    }
    const done: typeof actions = [];
    try { for (const action of actions) { done.push(action); action.apply(); } }
    catch (error) { for (const action of done.reverse()) { try { action.undo(); } catch { /* Preserve original error. */ } } throw error; }
  }
  figma.commitUndo(); pending = null;
}

figma.ui.onmessage = async (message: any) => {
  try {
    if (message.type === 'init') { await scan(); await selection(); return; }
    if (message.type === 'scan' && !active) { await scan(); return; }
    if (message.type === 'pin' && !active) {
      pinned = pinned ? null : figma.currentPage.selection.length === 1 ? figma.currentPage.selection[0].id : null;
      await selection(); return;
    }
    if (message.type === 'library' && !active) {
      const lib: Library = { id: message.fileKey, name: `Biblioteka ${message.fileKey}`, components: message.components };
      libraries = libraries.filter(l => l.id !== lib.id); libraries.push(lib); send('libraries', { libraries, selected: lib.id }); return;
    }
    if (message.type === 'prepare' && !active) {
      const catalog = libraries.find(l => l.id === message.libraryId)?.components;
      if (!catalog) throw new Error('Wybierz bibliotekę.');
      if (catalog.length > 180) throw new Error('Biblioteka przekracza limit 180 komponentów.');
      const target = pinned ? await figma.getNodeByIdAsync(pinned) : null;
      if (pinned && (!target || target.type === 'PAGE' || target.type === 'DOCUMENT')) throw new Error('Przypięty element jest niedostępny.');
      const context = target ? await snapshot(target as SceneNode) : null;
      pending = { context, catalog, pageId: figma.currentPage.id }; active = true;
      send('prepared', { input: { prompt: message.prompt, catalog, context } }); return;
    }
    if (message.type === 'apply' && active) { await apply(message.plan); active = false; send('done'); await selection(); return; }
    if (message.type === 'cancel') { pending = null; active = false; }
  } catch (error) { active = false; pending = null; send('error', { error: error instanceof Error ? error.message : 'Błąd wtyczki.' }); }
};
