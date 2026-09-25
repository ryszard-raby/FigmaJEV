type ContentSlot = { path: number[]; name: string; width: string; height: string; capacity: number; existingChildren?: { name: string; type: string }[]; settings?: SlotSettings; preferredValues?: InstanceSwapPreferredValue[] };
type CatalogItem = { id: string; key: string; nodeId?: string; name: string; description: string; slots?: ContentSlot[] };
type Library = { id: string; name: string; components: CatalogItem[] };
type Tree = { type: 'container' | 'text' | 'component'; name?: string; direction?: 'HORIZONTAL' | 'VERTICAL'; width: 'KEEP' | 'HUG' | 'FILL'; height: 'KEEP' | 'HUG' | 'FILL'; children?: Tree[]; slots?: { path: number[]; children: Tree[] }[]; text?: string; componentId?: string };
type Snapshot = { targetId: string; nodes: any[] };
type Operation = { id: string; field: string; value: any };
type Plan = { mode: 'create'; tree: Tree } | { mode: 'edit'; targetId: string; operations: Operation[] } | { mode: 'insert'; targetId: string; parentId: string; children: Tree[] };
let libraries: Library[] = [];
let pinned: string | null = null;
let pending: { context: Snapshot | null; catalog: CatalogItem[]; pageId: string } | null = null;
let active = false;
const SETTINGS_KEY = 'figmajev.connection.v1';
let settings: { token: string; libraryUrl: string } = { token: '', libraryUrl: '' };
let settingsWrites = Promise.resolve();
const settingsEdited = { token: false, libraryUrl: false };
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
  return { id: c.key || c.id, key: c.key, nodeId: c.id, name: c.parent?.type === 'COMPONENT_SET' ? `${c.parent.name} / ${c.name}` : c.name, description: c.description, slots: contentSlots(c) };
}

function contentSlots(root: ComponentNode): ContentSlot[] {
  const result: ContentSlot[] = [];
  const definitions = root.parent?.type === 'COMPONENT_SET' ? root.parent.componentPropertyDefinitions : root.componentPropertyDefinitions;
  function visit(n: SceneNode, path: number[]) {
    if (n.type === 'INSTANCE') return;
    if (n.type === 'SLOT') {
      // Documented by Figma; missing from the installed typings' reference union.
      const ref = (n.componentPropertyReferences as { slotContentId?: string } | null)?.slotContentId;
      if (n.name.trim().toLowerCase() !== 'content' && ref?.split('#')[0].toLowerCase() !== 'content') return;
      const def = ref ? definitions[ref] : undefined;
      result.push({ path, name: n.name, width: n.layoutMode === 'NONE' ? 'HUG' : n.layoutSizingHorizontal, height: n.layoutMode === 'NONE' ? 'HUG' : n.layoutSizingVertical,
        existingChildren: n.children.map(child => ({ name: child.name, type: child.type })),
        capacity: Math.max(0, (def?.slotSettings?.maxChildren ?? 4 + n.children.length) - n.children.length), settings: def?.slotSettings, preferredValues: def?.preferredValues });
      return;
    }
    if ('children' in n) n.children.forEach((child, index) => visit(child, [...path, index]));
  }
  root.children.forEach((n, index) => visit(n, [index]));
  return result;
}

function resolveSlot(root: InstanceNode, path: number[]): SlotNode {
  let node: SceneNode = root;
  for (const index of path) {
    if (!Number.isInteger(index) || index < 0 || !('children' in node) || !node.children[index]) throw new Error('Slot Content zmienił strukturę. Odśwież bibliotekę.');
    node = node.children[index];
  }
  if (node.type !== 'SLOT') throw new Error('Content musi być natywnym slotem Figmy, nie zwykłą ramką w instancji.');
  return node;
}

async function enrichCatalog(catalog: CatalogItem[]) {
  for (let i = 0; i < catalog.length; i += 6) {
    await Promise.all(catalog.slice(i, i + 6).map(async entry => {
      const local = entry.nodeId ? await figma.getNodeByIdAsync(entry.nodeId) : null;
      const component = local?.type === 'COMPONENT' ? local : await figma.importComponentByKeyAsync(entry.key);
      entry.nodeId = component.id; entry.slots = contentSlots(component);
    }));
  }
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
  const slots = new Map<string, ContentSlot>();
  async function visit(n: SceneNode, parentId?: string) {
    if (nodes.length >= 80) throw new Error('Wybierz mniejszy element: limit kontekstu to 80 warstw.');
    const data: any = { id: n.id, name: n.name, type: n.type, parentId, visible: n.visible, width: n.width, height: n.height };
    if (n.type === 'SLOT' && slots.has(n.id)) data.contentSlot = slots.get(n.id);
    if ('layoutMode' in n && n.layoutMode !== 'NONE') data.layout = { direction: n.layoutMode };
    if ('layoutSizingHorizontal' in n) data.sizing = Object.fromEntries((['width', 'height'] as const).map(axis => [axis, { value: n[axis === 'width' ? 'layoutSizingHorizontal' : 'layoutSizingVertical'], allowed: sizingOptions(n, axis) }]));
    if (n.type === 'TEXT') data.text = n.characters;
    if (n.type === 'INSTANCE') {
      const main = await n.getMainComponentAsync();
      const definitions = main?.parent?.type === 'COMPONENT_SET' ? main.parent.componentPropertyDefinitions : main?.componentPropertyDefinitions;
      data.properties = Object.fromEntries(Object.entries(n.componentProperties).map(([key, value]) => [key, { ...value, options: definitions?.[key]?.variantOptions }]));
      data.componentKey = main?.key;
      if (main) for (const descriptor of contentSlots(main)) {
        const slot = resolveSlot(n, descriptor.path);
        slots.set(slot.id, { ...descriptor, width: slot.layoutMode === 'NONE' ? 'HUG' : slot.layoutSizingHorizontal, height: slot.layoutMode === 'NONE' ? 'HUG' : slot.layoutSizingVertical,
          existingChildren: slot.children.map(child => ({ name: child.name, type: child.type })),
          capacity: Math.max(0, (descriptor.settings?.maxChildren ?? slot.children.length + 4) - slot.children.length) });
      }
    }
    nodes.push(data);
    if ('children' in n) for (const child of n.children) await visit(child, n.id);
  }
  await visit(root);
  return { targetId: root.id, nodes };
}

function sizingOptions(n: SceneNode, axis: 'width' | 'height'): string[] {
  if (!('layoutSizingHorizontal' in n)) return [];
  const property = axis === 'width' ? 'layoutSizingHorizontal' : 'layoutSizingVertical';
  const p = n.parent;
  const options: string[] = [];
  const hasFillChild = 'children' in n && n.children.some(child => 'layoutSizingHorizontal' in child && child[property] === 'FILL');
  if ((n.type === 'TEXT' || ('layoutMode' in n && ['HORIZONTAL', 'VERTICAL'].includes(n.layoutMode))) && !hasFillChild) options.push('HUG');
  if (p && 'layoutMode' in p && ['HORIZONTAL', 'VERTICAL'].includes(p.layoutMode) && n.layoutPositioning !== 'ABSOLUTE' && p[property] !== 'HUG') options.push('FILL');
  return options;
}

function setSizing(n: SceneNode, tree: Tree, warnings: string[]) {
  for (const axis of ['width', 'height'] as const) {
    const value = tree[axis];
    if (value === 'KEEP') continue;
    if (!['HUG', 'FILL'].includes(value)) throw new Error('Nieprawidłowy tryb rozmiaru.');
    if (!sizingOptions(n, axis).includes(value)) {
      if (tree.type === 'component' && value === 'HUG') {
        warnings.push(`${n.name}: ${axis} zachowuje rozmiar biblioteki — Hug niedostępny.`); continue;
      }
      throw new Error(`${n.name}: ${axis}=${value} jest niedostępne w tym kontenerze.`);
    }
    if ('layoutSizingHorizontal' in n) n[axis === 'width' ? 'layoutSizingHorizontal' : 'layoutSizingVertical'] = value;
  }
}

async function build(tree: Tree, catalog: CatalogItem[], parent: FrameNode | SlotNode, budget: { count: number; warnings: string[] }, depth = 0): Promise<SceneNode> {
  if (++budget.count > 40 || depth > 5) throw new Error('Plan przekracza limit rozmiaru.');
  if (tree.type === 'component') {
    const entry = catalog.find(c => c.id === tree.componentId);
    if (!entry) throw new Error('Komponent spoza wybranej biblioteki.');
    const local = entry.nodeId ? await figma.getNodeByIdAsync(entry.nodeId) : null;
    const component = local?.type === 'COMPONENT' ? local : await figma.importComponentByKeyAsync(entry.key);
    const instance = component.createInstance();
    const original = { width: instance.width, height: instance.height, horizontal: instance.layoutSizingHorizontal, vertical: instance.layoutSizingVertical };
    appendSafely(parent, instance);
    // Slots may stretch a child on insertion. Restore preserved axes before explicit sizing.
    if (tree.width === 'KEEP' || tree.height === 'KEEP') {
      instance.resize(tree.width === 'KEEP' ? original.width : instance.width, tree.height === 'KEEP' ? original.height : instance.height);
      if (tree.width === 'KEEP') instance.layoutSizingHorizontal = original.horizontal;
      if (tree.height === 'KEEP') instance.layoutSizingVertical = original.vertical;
    }
    setSizing(instance, tree, budget.warnings);
    for (const content of tree.slots || []) {
      const descriptor = entry.slots?.find(s => JSON.stringify(s.path) === JSON.stringify(content.path));
      if (!descriptor) throw new Error('Plan wskazuje slot spoza katalogu.');
      if (!Array.isArray(content.children) || content.children.length > Math.min(4, descriptor.capacity)) throw new Error('Przekroczono pojemność slotu Content.');
      const slot = resolveSlot(instance, content.path);
      const previous = slot.limitViolations || [];
      for (const child of content.children) await build(child, catalog, slot, budget, depth + 1);
      if ((slot.limitViolations || []).some(v => !previous.includes(v))) throw new Error('Zawartość narusza ograniczenia slotu Content (liczba lub typ dzieci).');
    }
    return instance;
  }
  if (tree.type === 'text') {
    if (typeof tree.text !== 'string' || tree.text.length > 1000) throw new Error('Nieprawidłowy tekst.');
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    const text = figma.createText(); appendSafely(parent, text);
    text.fontName = { family: 'Inter', style: 'Regular' }; text.characters = tree.text; text.fontSize = 16;
    setSizing(text, tree, budget.warnings); return text;
  }
  if (tree.type !== 'container' || !['HORIZONTAL', 'VERTICAL'].includes(tree.direction || '')) throw new Error('Nieprawidłowy kontener.');
  const frame = figma.createFrame(); appendSafely(parent, frame);
  frame.name = tree.name || 'Container'; frame.layoutMode = tree.direction!; frame.itemSpacing = 0;
  frame.primaryAxisSizingMode = 'AUTO'; frame.counterAxisSizingMode = 'AUTO'; frame.fills = []; frame.clipsContent = false;
  frame.paddingTop = frame.paddingBottom = frame.paddingLeft = frame.paddingRight = 0;
  setSizing(frame, tree, budget.warnings);
  for (const child of tree.children || []) await build(child, catalog, frame, budget, depth + 1);
  return frame;
}

function appendSafely(parent: FrameNode | SlotNode, child: SceneNode) {
  try { parent.appendChild(child); } catch (error) { child.remove(); throw error; }
}

async function apply(plan: Plan) {
  const warnings: string[] = [];
  if (!pending || pending.pageId !== figma.currentPage.id) throw new Error('Strona uległa zmianie. Wygeneruj plan ponownie.');
  if (plan.mode === 'create') {
    if (pending.context) throw new Error('Nieprawidłowy tryb odpowiedzi.');
    const staging = figma.createFrame(); staging.visible = false; staging.name = 'FigmaJev staging';
    let complete = false;
    try {
      staging.layoutMode = 'VERTICAL'; staging.resize(640, 480);
      staging.layoutSizingHorizontal = 'HUG'; staging.layoutSizingVertical = 'FIXED';
      staging.itemSpacing = 0; staging.paddingTop = staging.paddingBottom = staging.paddingLeft = staging.paddingRight = 0;
      staging.fills = []; staging.clipsContent = false;
      const budget = { count: 1, warnings };
      if (plan.tree.type === 'container') {
        if (!['HORIZONTAL', 'VERTICAL'].includes(plan.tree.direction || '') || !['KEEP', 'HUG'].includes(plan.tree.width) || !['KEEP', 'HUG'].includes(plan.tree.height)) throw new Error('Nieprawidłowy główny kontener. Na stronie Fill jest niedostępne.');
        staging.layoutMode = plan.tree.direction!;
        setSizing(staging, plan.tree, warnings);
        for (const child of plan.tree.children || []) await build(child, pending.catalog, staging, budget, 1);
      } else {
        await build(plan.tree, pending.catalog, staging, budget, 1);
      }
      staging.name = 'FigmaJev'; staging.visible = true;
      staging.x = figma.viewport.center.x - staging.width / 2; staging.y = figma.viewport.center.y - staging.height / 2;
      figma.currentPage.selection = [staging]; figma.viewport.scrollAndZoomIntoView([staging]);
      complete = true;
    } finally { if (!complete) staging.remove(); }
  } else {
    const before = pending.context;
    if (!before || before.targetId !== plan.targetId) throw new Error('Nieprawidłowy cel edycji.');
    const root = await figma.getNodeByIdAsync(before.targetId);
    if (!root || root.type === 'PAGE' || root.type === 'DOCUMENT') throw new Error('Przypięty element został usunięty.');
    if (JSON.stringify(await snapshot(root)) !== JSON.stringify(before)) throw new Error('Element zmienił się podczas generowania. Spróbuj ponownie.');
    if (plan.mode === 'insert') {
      const descriptor = before.nodes.find(n => n.id === plan.parentId)?.contentSlot;
      const slot = await figma.getNodeByIdAsync(plan.parentId);
      if (!descriptor || !slot || slot.type !== 'SLOT') throw new Error('Wybierz instancję z natywnym slotem Content.');
      if (!Array.isArray(plan.children) || !plan.children.length || plan.children.length > Math.min(4, descriptor.capacity)) throw new Error('Nieprawidłowa liczba dzieci slotu.');
      const originalIds = new Set(slot.children.map(n => n.id));
      const previous = slot.limitViolations || [];
      try {
        const budget = { count: 0, warnings };
        for (const child of plan.children) await build(child, pending.catalog, slot, budget);
        if ((slot.limitViolations || []).some(v => !previous.includes(v))) throw new Error('Dodawanie narusza ograniczenia slotu Content.');
      } catch (error) {
        for (const child of [...slot.children]) if (!originalIds.has(child.id)) child.remove();
        throw error;
      }
      figma.commitUndo(); pending = null; return warnings;
    }
    const actions: { apply: () => void; undo: () => void }[] = [];
    for (const op of plan.operations) {
      if (!before.nodes.some(n => n.id === op.id)) throw new Error('Zmiana poza przypiętym elementem.');
      const n = await figma.getNodeByIdAsync(op.id);
      if (!n) throw new Error('Brak warstwy.');
      if (op.field === 'direction' && 'layoutMode' in n && ['HORIZONTAL', 'VERTICAL'].includes(op.value)) {
        const old = n.layoutMode; actions.push({ apply: () => { n.layoutMode = op.value; }, undo: () => { n.layoutMode = old; } });
      } else if ((op.field === 'width' || op.field === 'height') && 'layoutSizingHorizontal' in n && before.nodes.find(x => x.id === n.id).sizing?.[op.field]?.allowed.includes(op.value)) {
        const axis = op.field as 'width' | 'height';
        const property = axis === 'width' ? 'layoutSizingHorizontal' : 'layoutSizingVertical';
        const old = n[property]; const oldWidth = n.width; const oldHeight = n.height;
        if (n.type === 'TEXT') for (const font of n.getRangeAllFontNames(0, n.characters.length)) await figma.loadFontAsync(font);
        actions.push({ apply: () => {
          if (!sizingOptions(n as SceneNode, axis).includes(op.value)) throw new Error('Zmiana rozmiaru koliduje z auto layoutem.');
          n[property] = op.value;
        }, undo: () => { n.resize(oldWidth, oldHeight); n[property] = old; } });
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
  return warnings;
}

figma.ui.onmessage = async (message: any) => {
  try {
    if (message.type === 'init') {
      try {
        const saved = await figma.clientStorage.getAsync(SETTINGS_KEY);
        if (!settingsEdited.token) settings.token = typeof saved?.token === 'string' ? saved.token : '';
        if (!settingsEdited.libraryUrl) settings.libraryUrl = typeof saved?.libraryUrl === 'string' ? saved.libraryUrl : '';
        send('settings', settings);
      } catch { send('settings-error', { error: 'Nie udało się odczytać zapisanych ustawień.' }); }
      await scan(); await selection(); return;
    }
    if (message.type === 'save-settings') {
      if (typeof message.token === 'string' && message.token.length <= 4096) { settings.token = message.token.trim(); settingsEdited.token = true; }
      if (typeof message.libraryUrl === 'string' && message.libraryUrl.length <= 4096) { settings.libraryUrl = message.libraryUrl.trim(); settingsEdited.libraryUrl = true; }
      const value = { ...settings };
      settingsWrites = settingsWrites.then(() => figma.clientStorage.setAsync(SETTINGS_KEY, value)).catch(() => {
        send('settings-error', { error: 'Nie udało się zapisać ustawień na tym urządzeniu.' });
      });
      await settingsWrites; return;
    }
    if (message.type === 'scan' && !active) { await scan(); return; }
    if (message.type === 'pin' && !active) {
      pinned = pinned ? null : figma.currentPage.selection.length === 1 ? figma.currentPage.selection[0].id : null;
      await selection(); return;
    }
    if (message.type === 'library') {
      if (active) throw new Error('Zakończ generowanie przed dodaniem biblioteki.');
      const lib: Library = { id: message.fileKey, name: `Biblioteka ${message.fileKey}`, components: message.components };
      libraries = libraries.filter(l => l.id !== lib.id); libraries.push(lib); send('libraries', { libraries, selected: lib.id }); return;
    }
    if (message.type === 'prepare' && !active) {
      active = true;
      const catalog = libraries.find(l => l.id === message.libraryId)?.components;
      if (!catalog) throw new Error('Wybierz bibliotekę.');
      if (catalog.length > 180) throw new Error('Biblioteka przekracza limit 180 komponentów.');
      send('progress', { text: 'Sprawdzanie slotów Content w bibliotece…' });
      await enrichCatalog(catalog);
      const target = pinned ? await figma.getNodeByIdAsync(pinned) : null;
      if (pinned && (!target || target.type === 'PAGE' || target.type === 'DOCUMENT')) throw new Error('Przypięty element jest niedostępny.');
      const context = target ? await snapshot(target as SceneNode) : null;
      pending = { context, catalog, pageId: figma.currentPage.id }; active = true;
      send('prepared', { input: { prompt: message.prompt, catalog, context } }); return;
    }
    if (message.type === 'apply' && active) { const warnings = await apply(message.plan); active = false; send('done', { warnings }); await selection(); return; }
    if (message.type === 'cancel') { pending = null; active = false; }
  } catch (error) { active = false; pending = null; send('error', { error: error instanceof Error ? error.message : 'Błąd wtyczki.' }); }
};
