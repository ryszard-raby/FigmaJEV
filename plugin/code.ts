import { exportVariablesCss } from './variables-css';
type ContentSlot = { path: number[]; name: string; width: string; height: string; capacity: number; existingChildren?: { name: string; type: string }[]; settings?: SlotSettings; preferredValues?: InstanceSwapPreferredValue[] };
type CatalogItem = { id: string; key: string; nodeId?: string; name: string; description: string; defaultSizing?: { width: string; height: string }; slots?: ContentSlot[]; properties?: ComponentPropertyDefinitions; textTargets?: { path: number[]; name: string }[] };
type Library = { id: string; name: string; components: CatalogItem[] };
const sortComponents = (components: CatalogItem[]) => [...components].sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base', numeric: true }));
// Same input limits as server/compact-tree.mjs; renderer also counts the host.
const MAX_TREE_NODES = 256;
const MAX_TREE_LEVELS = 32;
type Tree = { type: 'container' | 'text' | 'component'; name?: string; direction?: 'HORIZONTAL' | 'VERTICAL'; primaryAlign?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'; counterAlign?: 'MIN' | 'CENTER' | 'MAX'; width: 'KEEP' | 'HUG' | 'FILL' | number; height: 'KEEP' | 'HUG' | 'FILL' | number; children?: Tree[]; slots?: { path: number[]; children: Tree[]; mode?: 'replace' }[]; text?: string; fontSize?: number; componentId?: string; properties?: Record<string, string | boolean>; textOverrides?: { path: number[]; text: string }[] };
type Snapshot = { targetId: string; nodes: any[]; parent?: { id: string; name: string; type: string; ownerName?: string; contentSlot?: ContentSlot } };
type Operation = { id: string; field: string; value: any };
type Plan = ({ mode: 'create'; tree: Tree } | { mode: 'edit'; targetId: string; operations: Operation[] } | { mode: 'insert'; targetId: string; parentId: string; children: Tree[] } | { mode: 'remove'; targetId: string; nodeId: string | null }) & { exactTree?: boolean };
let libraries: Library[] = [];
let pending: { context: Snapshot | null; catalog: CatalogItem[]; pageId: string } | null = null;
let active = false;
const SETTINGS_KEY = 'figmajev.connection.v1';
let settings: { token: string; libraryUrl: string } = { token: '', libraryUrl: '' };
let settingsWrites = Promise.resolve();
const settingsEdited = { token: false, libraryUrl: false };
const send = (type: string, data: object = {}) => figma.ui.postMessage({ type, ...data });
figma.showUI(__html__, { width: 720, height: 80, themeColors: true });

async function selection() {
  const node = figma.currentPage.selection.length === 1 ? figma.currentPage.selection[0] : null;
  send('selection', { node: node ? { id: node.id, name: node.name, type: node.type } : null, count: figma.currentPage.selection.length });
}
figma.on('selectionchange', () => { void selection(); });
figma.on('currentpagechange', () => { if (!active) { pending = null; } void selection(); });

function item(c: ComponentNode): CatalogItem {
  return { id: c.key || c.id, key: c.key, nodeId: c.id, name: c.parent?.type === 'COMPONENT_SET' ? `${c.parent.name} / ${c.name}` : c.name, description: componentDescription(c), slots: contentSlots(c) };
}

function componentDescription(component: ComponentNode): string {
  return component.description?.trim() || (component.parent?.type === 'COMPONENT_SET' ? component.parent.description?.trim() : '') || '';
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
        capacity: Math.max(0, (def?.slotSettings?.maxChildren ?? MAX_TREE_NODES + n.children.length) - n.children.length), settings: def?.slotSettings, preferredValues: def?.preferredValues });
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
      entry.description = componentDescription(component) || entry.description || '';
      entry.defaultSizing = { width: component.layoutSizingHorizontal, height: component.layoutSizingVertical };
      entry.properties = component.parent?.type === 'COMPONENT_SET' ? component.parent.componentPropertyDefinitions : component.componentPropertyDefinitions;
      entry.textTargets = [];
      function texts(n: SceneNode, path: number[]) {
        if (n.type === 'SLOT') return;
        if (n.type === 'TEXT') entry.textTargets!.push({ path, name: n.name });
        if ('children' in n) n.children.forEach((child, i) => texts(child, [...path, i]));
      }
      component.children.forEach((n, i) => texts(n, [i]));
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
  libraries.unshift({ id: 'local', name: `Ten plik (${local.size})`, components: sortComponents([...local.values()]) }, { id: 'used', name: `Użyte komponenty z bibliotek (${remote.size})`, components: sortComponents([...remote.values()]) });
  send('libraries', { libraries });
}

async function snapshot(root: SceneNode): Promise<Snapshot> {
  const nodes: any[] = [];
  const slots = new Map<string, ContentSlot>();
  function registerSlots(instance: InstanceNode, main: ComponentNode) {
    for (const descriptor of contentSlots(main)) {
      const slot = resolveSlot(instance, descriptor.path);
      slots.set(slot.id, { ...descriptor, width: slot.layoutMode === 'NONE' ? 'HUG' : slot.layoutSizingHorizontal, height: slot.layoutMode === 'NONE' ? 'HUG' : slot.layoutSizingVertical,
        existingChildren: slot.children.map(child => ({ name: child.name, type: child.type })),
        capacity: Math.max(0, (descriptor.settings?.maxChildren ?? slot.children.length + 4) - slot.children.length) });
    }
  }
  // Selection may start at Content (or an internal frame), bypassing the
  // instance visitor. Read slot definitions from its nearest owning instance
  // without adding that instance or its other descendants to the edit scope.
  let owner: BaseNode | null = root.parent;
  while (owner && owner.type !== 'INSTANCE') owner = owner.parent;
  if (owner?.type === 'INSTANCE') {
    const main = await owner.getMainComponentAsync();
    if (main) registerSlots(owner, main);
  }
  async function visit(n: SceneNode, parentId?: string) {
    const data: any = { id: n.id, name: n.name, type: n.type, parentId, visible: n.visible, width: n.width, height: n.height };
    if (n.type === 'SLOT' && slots.has(n.id)) data.contentSlot = slots.get(n.id);
    if ('layoutMode' in n && n.layoutMode !== 'NONE') data.layout = { direction: n.layoutMode };
    if ('layoutSizingHorizontal' in n) data.sizing = Object.fromEntries((['width', 'height'] as const).map(axis => [axis, { value: n[axis === 'width' ? 'layoutSizingHorizontal' : 'layoutSizingVertical'], allowed: sizingOptions(n, axis) }]));
    if (n.type === 'TEXT') { data.text = n.characters; data.fontSize = n.fontSize === figma.mixed ? null : n.fontSize; }
    data.removable = editableParent(n.parent);
    data.insertable = n.type === 'FRAME' && editableParent(n);
    if (n.type === 'INSTANCE') {
      const main = await n.getMainComponentAsync();
      const definitions = main?.parent?.type === 'COMPONENT_SET' ? main.parent.componentPropertyDefinitions : main?.componentPropertyDefinitions;
      data.description = main ? componentDescription(main) : '';
      data.properties = Object.fromEntries(Object.entries(n.componentProperties).map(([key, value]) => [key, { ...value, description: definitions?.[key]?.description || undefined, options: definitions?.[key]?.variantOptions }]));
      data.componentKey = main?.key;
      if (main) registerSlots(n, main);
    }
    nodes.push(data);
    if ('children' in n) for (const child of n.children) await visit(child, n.id);
  }
  await visit(root);
  const parent = root.parent;
  return { targetId: root.id, nodes, ...(parent && parent.type !== 'PAGE' && parent.type !== 'DOCUMENT' ? {
    parent: { id: parent.id, name: parent.name, type: parent.type, ...(parent.type === 'SLOT' ? { ownerName: owner?.name, contentSlot: slots.get(parent.id) } : {}) }
  } : {}) };
}

function sizingOptions(n: SceneNode, axis: 'width' | 'height'): string[] {
  return (axis === 'width' ? 'layoutSizingHorizontal' in n : 'layoutSizingVertical' in n) ? ['HUG', 'FILL'] : [];
}

function setSizing(n: SceneNode, tree: Tree) {
  const numeric = typeof tree.width === 'number' || typeof tree.height === 'number';
  for (const value of [tree.width, tree.height]) {
    if (typeof value === 'number' ? !Number.isFinite(value) || value <= 0 : !['KEEP', 'HUG', 'FILL'].includes(value)) throw new Error('Nieprawidłowy rozmiar: użyj keep, hug, fill lub dodatniej liczby pikseli.');
  }
  if (tree.width === 'KEEP' && tree.height === 'KEEP') return;
  if (!('layoutSizingHorizontal' in n)) throw new Error(`${n.name}: warstwa nie udostępnia rozmiarowania.`);
  const previous = { width: n.layoutSizingHorizontal, height: n.layoutSizingVertical };
  if (numeric) {
    if (typeof tree.width === 'number') n.layoutSizingHorizontal = 'FIXED';
    if (typeof tree.height === 'number') n.layoutSizingVertical = 'FIXED';
    n.resize(typeof tree.width === 'number' ? tree.width : n.width, typeof tree.height === 'number' ? tree.height : n.height);
  }
  for (const axis of ['width', 'height'] as const) {
    const value = tree[axis];
    if (value === 'KEEP' && !numeric) continue;
    // Let Figma apply its own layout rules (or return its actual API error).
    n[axis === 'width' ? 'layoutSizingHorizontal' : 'layoutSizingVertical'] = typeof value === 'number' ? 'FIXED' : value === 'KEEP' ? previous[axis] : value;
  }
}

let stopHighlight: (() => void) | null = null;
const HIGHLIGHT_DURATION_MS = 2000;

function highlightEditedNode(target: SceneNode): Promise<boolean> {
  stopHighlight?.();
  if (target.removed || !target.absoluteBoundingBox) return Promise.resolve(!target.removed);
  const page = figma.currentPage;
  return new Promise(resolve => {
    let overlay: RectangleNode | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    const finish = (completed = false) => {
      if (finished) return;
      finished = true;
      if (timer !== undefined) clearTimeout(timer);
      try { if (overlay && !overlay.removed) overlay.remove(); } catch { /* Decoration must not fail the edit. */ }
      if (stopHighlight === finish) stopHighlight = null;
      resolve(completed);
    };
    stopHighlight = finish;
    try {
      overlay = figma.createRectangle();
      page.appendChild(overlay);
      overlay.name = 'FigmaJev — temporary highlight';
      overlay.locked = true;
      overlay.fills = [{ type: 'SOLID', color: { r: 0.34, g: 0.35, b: 1 }, opacity: 0.18 }];
      overlay.strokes = [{ type: 'SOLID', color: { r: 0.34, g: 0.35, b: 1 }, opacity: 0.65 }];
      overlay.strokeWeight = 1;
      overlay.cornerRadius = 6;
      const started = Date.now();
      const tick = () => {
        try {
          if (target.removed || overlay!.removed || figma.currentPage.id !== page.id) return finish();
          const bounds = target.absoluteBoundingBox;
          const elapsed = Date.now() - started;
          if (!bounds || elapsed >= HIGHLIGHT_DURATION_MS) return finish(true);
          overlay!.resize(Math.max(0.01, bounds.width), Math.max(0.01, bounds.height));
          overlay!.x = bounds.x; overlay!.y = bounds.y;
          overlay!.opacity = Math.sin(Math.PI * elapsed / HIGHLIGHT_DURATION_MS) * (0.4 + 0.6 * Math.sin(Math.PI * elapsed / 650) ** 2);
          timer = setTimeout(tick, 40);
        } catch { finish(true); }
      };
      tick();
    } catch { finish(true); }
  });
}

figma.on('close', () => stopHighlight?.());
figma.on('currentpagechange', () => stopHighlight?.());

function editableParent(parent: BaseNode | null): boolean {
  if (!parent) return false;
  if (parent.type === 'PAGE' || parent.type === 'SECTION') return true;
  if (parent.type === 'SLOT') return true;
  if (parent.type !== 'FRAME' && parent.type !== 'GROUP') return false;
  let ancestor: BaseNode | null = parent;
  while (ancestor) {
    if (ancestor.type === 'SLOT') return true;
    if (ancestor.type === 'INSTANCE' || ancestor.type === 'COMPONENT' || ancestor.type === 'COMPONENT_SET') return false;
    ancestor = ancestor.parent;
  }
  return true;
}

async function loadTextFonts(n: TextNode) {
  const fonts = n.getRangeAllFontNames(0, n.characters.length);
  if (!fonts.length && n.fontName !== figma.mixed) fonts.push(n.fontName);
  for (const font of fonts) await figma.loadFontAsync(font);
}

async function build(tree: Tree, catalog: CatalogItem[], parent: FrameNode | SlotNode, budget: { count: number; warnings: string[]; strict?: boolean }, depth = 0): Promise<SceneNode> {
  if (++budget.count > MAX_TREE_NODES + 1 || depth > MAX_TREE_LEVELS) throw new Error('Plan przekracza limit 256 elementów lub 32 poziomów.');
  if (tree.type === 'component') {
    const entry = catalog.find(c => c.id === tree.componentId);
    if (!entry) throw new Error('Komponent spoza wybranej biblioteki.');
    const local = entry.nodeId ? await figma.getNodeByIdAsync(entry.nodeId) : null;
    const component = local?.type === 'COMPONENT' ? local : await figma.importComponentByKeyAsync(entry.key);
    // Read the main component BEFORE createInstance: Figma can normalize a
    // detached/new instance to Fixed even before it reaches the target slot.
    const original = { width: component.width, height: component.height, horizontal: component.layoutSizingHorizontal, vertical: component.layoutSizingVertical };
    const instance = component.createInstance();
    appendSafely(parent, instance);
    if (tree.properties && Object.keys(tree.properties).length) {
      const properties: Record<string, string | boolean> = {};
      for (const [key, value] of Object.entries(tree.properties)) {
        const def = entry.properties?.[key];
        if (!def || !['TEXT', 'BOOLEAN', 'INSTANCE_SWAP'].includes(def.type) || (def.type === 'BOOLEAN' ? typeof value !== 'boolean' : typeof value !== 'string')) throw new Error('Nieprawidłowa właściwość resolved tree.');
        properties[key] = value;
        if (def.type === 'INSTANCE_SWAP') {
          // Resolution uses stable library keys; Figma setProperties needs a
          // ComponentNode ID from this document, including imported components.
          const swapEntry = catalog.find(c => c.key === value);
          if (!swapEntry) throw new Error(`${entry.name}: ${key} wskazuje komponent spoza katalogu.`);
          const localSwap = swapEntry.nodeId ? await figma.getNodeByIdAsync(swapEntry.nodeId) : null;
          const swap = localSwap?.type === 'COMPONENT' ? localSwap : await figma.importComponentByKeyAsync(swapEntry.key);
          properties[key] = swap.id;
        }
      }
      for (const text of instance.findAllWithCriteria({ types: ['TEXT'] })) await loadTextFonts(text);
      try { instance.setProperties(properties); }
      catch (error) { throw new Error(`${entry.name}: setProperties (${Object.keys(properties).map(key => `${key}: ${entry.properties?.[key]?.type}`).join(', ')}): ${error instanceof Error ? error.message : String(error)}`); }
    }
    for (const override of tree.textOverrides || []) {
      if (!entry.textTargets?.some(t => JSON.stringify(t.path) === JSON.stringify(override.path))) throw new Error('Warstwa tekstowa spoza katalogu.');
      let target: SceneNode = instance;
      for (const i of override.path) {
        if (!('children' in target) || !target.children[i]) throw new Error('Warstwa tekstowa zmieniła położenie.');
        target = target.children[i];
      }
      if (target.type !== 'TEXT' || typeof override.text !== 'string' || override.text.length > 1000) throw new Error('Nieprawidłowa treść tekstu.');
      await loadTextFonts(target); target.characters = override.text;
    }
    for (const content of tree.slots || []) {
      const descriptor = entry.slots?.find(s => JSON.stringify(s.path) === JSON.stringify(content.path));
      if (!descriptor) throw new Error('Plan wskazuje slot spoza katalogu.');
      if (!Array.isArray(content.children) || content.children.length > (content.mode === 'replace' ? descriptor.settings?.maxChildren ?? MAX_TREE_NODES : descriptor.capacity)) throw new Error('Przekroczono pojemność slotu Content.');
      const slot = resolveSlot(instance, content.path);
      const previous = content.mode === 'replace' ? [] : slot.limitViolations || [];
      if (content.mode === 'replace') for (const child of [...slot.children]) child.remove();
      for (const child of content.children) await build(child, catalog, slot, budget, depth + 1);
      if ((slot.limitViolations || []).some(v => !previous.includes(v))) throw new Error('Zawartość narusza ograniczenia slotu Content (liczba lub typ dzieci).');
    }
    // Apply after properties and slot contents, which can also reset sizing.
    // Fixed axes retain source dimensions; Hug/Fill derive their size in context.
    const fixedWidth = tree.width === 'KEEP' && original.horizontal === 'FIXED';
    const fixedHeight = tree.height === 'KEEP' && original.vertical === 'FIXED';
    if (fixedWidth || fixedHeight) instance.resize(fixedWidth ? original.width : instance.width, fixedHeight ? original.height : instance.height);
    if (tree.width === 'KEEP') instance.layoutSizingHorizontal = original.horizontal;
    if (tree.height === 'KEEP') instance.layoutSizingVertical = original.vertical;
    setSizing(instance, tree);
    console.log('COMPONENT SIZING', { component: entry.name, source: { width: original.horizontal, height: original.vertical }, requested: { width: tree.width, height: tree.height }, applied: { width: instance.layoutSizingHorizontal, height: instance.layoutSizingVertical } });
    return instance;
  }
  if (tree.type === 'text') {
    if (typeof tree.text !== 'string' || tree.text.length > 1000) throw new Error('Nieprawidłowy tekst.');
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    const text = figma.createText(); appendSafely(parent, text);
    text.fontName = { family: 'Inter', style: 'Regular' }; text.characters = tree.text;
    if (tree.fontSize !== undefined && (!Number.isFinite(tree.fontSize) || tree.fontSize < 1 || tree.fontSize > 300)) throw new Error('Nieprawidłowy rozmiar tekstu.');
    text.fontSize = tree.fontSize ?? 16;
    setSizing(text, tree); return text;
  }
  if (tree.type !== 'container' || !['HORIZONTAL', 'VERTICAL'].includes(tree.direction || '')) throw new Error('Nieprawidłowy kontener.');
  const frame = figma.createFrame(); appendSafely(parent, frame);
  frame.name = tree.name || 'Container'; frame.layoutMode = tree.direction!; frame.itemSpacing = 0;
  if (tree.primaryAlign) frame.primaryAxisAlignItems = tree.primaryAlign;
  if (tree.counterAlign) frame.counterAxisAlignItems = tree.counterAlign;
  frame.primaryAxisSizingMode = 'AUTO'; frame.counterAxisSizingMode = 'AUTO'; frame.fills = []; frame.clipsContent = false;
  frame.paddingTop = frame.paddingBottom = frame.paddingLeft = frame.paddingRight = 0;
  setSizing(frame, tree);
  for (const child of tree.children || []) await build(child, catalog, frame, budget, depth + 1);
  return frame;
}

function appendSafely(parent: FrameNode | SlotNode, child: SceneNode) {
  try { parent.appendChild(child); } catch (error) { child.remove(); throw error; }
}

async function apply(plan: Plan) {
  stopHighlight?.();
  const warnings: string[] = [];
  if (!pending || pending.pageId !== figma.currentPage.id) throw new Error('Strona uległa zmianie. Wygeneruj plan ponownie.');
  if (plan.mode === 'create') {
    if (pending.context) throw new Error('Nieprawidłowy tryb odpowiedzi.');
    const staging = figma.createFrame(); staging.visible = false; staging.name = 'FigmaJev staging';
    let complete = false;
    try {
      staging.layoutMode = 'VERTICAL'; staging.resize(640, 480);
      staging.layoutSizingHorizontal = 'HUG'; staging.layoutSizingVertical = 'HUG';
      staging.itemSpacing = 0; staging.paddingTop = staging.paddingBottom = staging.paddingLeft = staging.paddingRight = 0;
      staging.fills = []; staging.clipsContent = false;
      const budget = { count: 1, warnings, strict: plan.exactTree };
      if (plan.tree.type === 'container') {
        if (!['HORIZONTAL', 'VERTICAL'].includes(plan.tree.direction || '')) throw new Error('Nieprawidłowy główny kontener.');
        staging.layoutMode = plan.tree.direction!;
        if (plan.tree.primaryAlign) staging.primaryAxisAlignItems = plan.tree.primaryAlign;
        if (plan.tree.counterAlign) staging.counterAxisAlignItems = plan.tree.counterAlign;
        setSizing(staging, plan.tree);
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
    if (!root || root.type === 'PAGE' || root.type === 'DOCUMENT') throw new Error('Wybrany element został usunięty.');
    if (JSON.stringify(await snapshot(root)) !== JSON.stringify(before)) throw new Error('Element zmienił się podczas generowania. Spróbuj ponownie.');
    if (plan.mode === 'remove') {
      if (plan.nodeId !== null) {
        const target = await figma.getNodeByIdAsync(plan.nodeId);
        if (!before.nodes.some(n => n.id === plan.nodeId && n.removable) || !target || !editableParent(target.parent)) throw new Error('Nie można usunąć tej warstwy z wybranego elementu.');
        if (target.parent?.type === 'SLOT') {
          let descriptor = before.nodes.find(n => n.id === target.parent?.id)?.contentSlot;
          // A selected slot child has its parent outside the snapshot. Resolve
          // the containing instance's slot definition before deleting it.
          if (!descriptor) {
            const slot = target.parent;
            let owner: BaseNode | null = slot.parent;
            while (owner && owner.type !== 'INSTANCE') owner = owner.parent;
            if (owner?.type !== 'INSTANCE') throw new Error('Nie można odczytać ograniczeń nadrzędnego slotu.');
            const main = await owner.getMainComponentAsync();
            if (!main) throw new Error('Nie można odczytać komponentu nadrzędnego slotu.');
            const instance = owner;
            descriptor = contentSlots(main).find(s => resolveSlot(instance, s.path).id === slot.id);
            if (!descriptor) throw new Error('Nie można odczytać ograniczeń nadrzędnego slotu.');
          }
          if (target.parent.children.length - 1 < (descriptor?.settings?.minChildren ?? 0)) throw new Error('Usunięcie naruszyłoby minimalną liczbę dzieci slotu.');
        }
        target.remove();
        figma.currentPage.selection = figma.currentPage.selection.filter(n => !n.removed);
      }
      figma.commitUndo(); pending = null; return warnings;
    }
    if (plan.mode === 'insert') {
      const descriptor = before.nodes.find(n => n.id === plan.parentId)?.contentSlot
        || (before.parent?.id === plan.parentId ? before.parent.contentSlot : undefined);
      const slot = await figma.getNodeByIdAsync(plan.parentId);
      const frameTarget = before.nodes.find(n => n.id === plan.parentId)?.insertable;
      if (!slot || !((descriptor && slot.type === 'SLOT') || (frameTarget && slot.type === 'FRAME' && editableParent(slot)))) throw new Error('Wybierz natywny slot Content lub edytowalną ramkę.');
      if (slot.type !== 'SLOT' && slot.type !== 'FRAME') throw new Error('Nieprawidłowy cel dodawania.');
      if (!Array.isArray(plan.children) || !plan.children.length || plan.children.length > Math.min(4, descriptor?.capacity ?? 4)) throw new Error('Nieprawidłowa liczba dzieci slotu.');
      const originalIds = new Set(slot.children.map(n => n.id));
      const previous = slot.type === 'SLOT' ? slot.limitViolations || [] : [];
      try {
        const budget = { count: 0, warnings, strict: plan.exactTree };
        for (const child of plan.children) await build(child, pending.catalog, slot, budget);
        if (slot.type === 'SLOT' && (slot.limitViolations || []).some(v => !previous.includes(v))) throw new Error('Dodawanie narusza ograniczenia slotu Content.');
      } catch (error) {
        for (const child of [...slot.children]) if (!originalIds.has(child.id)) child.remove();
        throw error;
      }
      figma.commitUndo(); pending = null; return warnings;
    }
    const actions: { apply: () => void; undo: () => void }[] = [];
    for (const op of plan.operations) {
      if (!before.nodes.some(n => n.id === op.id)) throw new Error('Zmiana poza wybranym elementem.');
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
          n[property] = op.value;
        }, undo: () => { n.resize(oldWidth, oldHeight); n[property] = old; } });
      } else if (op.field === 'fontSize' && n.type === 'TEXT' && Number.isFinite(op.value) && op.value >= 1 && op.value <= 300 && n.fontSize !== figma.mixed) {
        await loadTextFonts(n); const old = n.fontSize;
        actions.push({ apply: () => { n.fontSize = op.value; }, undo: () => { n.fontSize = old; } });
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
        let value = op.value;
        if (def.type === 'INSTANCE_SWAP') {
          const entry = pending.catalog.find(c => c.key === value);
          if (!entry) throw new Error(`${n.name}: ${name} wskazuje komponent spoza wybranej biblioteki.`);
          const local = entry.nodeId ? await figma.getNodeByIdAsync(entry.nodeId) : null;
          const component = local?.type === 'COMPONENT' ? local : await figma.importComponentByKeyAsync(entry.key);
          value = component.id;
        }
        for (const text of n.findAllWithCriteria({ types: ['TEXT'] })) for (const font of text.getRangeAllFontNames(0, text.characters.length)) await figma.loadFontAsync(font);
        actions.push({ apply: () => n.setProperties({ [name]: value }), undo: () => n.setProperties({ [name]: old }) });
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
    if (message.type === 'resize-ui') {
      figma.ui.resize(720, message.expanded === true ? 472 : 80);
      return;
    }
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
    if (message.type === 'export-variables' && !active) {
      active = true;
      const result = await exportVariablesCss(figma.variables);
      active = false;
      send('variables-css', result);
      return;
    }
    if (message.type === 'scan' && !active) { await scan(); return; }
    if (message.type === 'open-gpt') {
      if (typeof message.prompt !== 'string' || message.prompt.length > 8000) throw new Error('Nieprawidłowy prompt do GPT.');
      figma.openExternal(`https://chatgpt.com/?q=${encodeURIComponent(message.prompt)}`);
      return;
    }
    if (message.type === 'prepare-documentation' && !active) {
      active = true;
      const library = libraries.find(l => l.id === message.libraryId);
      if (!library?.components.length) throw new Error('Wybierz bibliotekę z komponentami.');
      await enrichCatalog(library.components);
      active = false;
      send('documentation-ready', { catalog: library.components, libraryName: library.name });
      return;
    }

    if (message.type === 'library') {
      if (active) throw new Error('Zakończ generowanie przed dodaniem biblioteki.');
      const lib: Library = { id: message.fileKey, name: `Biblioteka ${message.fileKey}`, components: sortComponents(message.components) };
      if (message.prepareDocumentation) {
        active = true;
        send('progress', { text: 'Pobieranie właściwości i wymiarów komponentów…' });
        await enrichCatalog(lib.components);
        active = false;
      }
      libraries = libraries.filter(l => l.id !== lib.id); libraries.push(lib);
      send('libraries', { libraries, selected: lib.id, documentationPending: Boolean(message.prepareDocumentation) });
      if (message.prepareDocumentation) send('documentation-ready', { catalog: lib.components, libraryName: lib.name, openGpt: false });
      return;
    }
    if (message.type === 'prepare' && !active) {
      active = true;
      const selected = [...figma.currentPage.selection];
      if (selected.length > 1) throw new Error('Zaznacz jeden element do edycji albo usuń zaznaczenie, aby utworzyć layout.');
      const target = selected[0] || null;
      const pageId = figma.currentPage.id;
      const catalog = libraries.find(l => l.id === message.libraryId)?.components;
      if (!catalog) throw new Error('Wybierz bibliotekę.');
      if (catalog.length > 180) throw new Error('Biblioteka przekracza limit 180 komponentów.');
      send('progress', { text: 'Sprawdzanie slotów Content w bibliotece…' });
      await enrichCatalog(catalog);
      if (pageId !== figma.currentPage.id) throw new Error('Strona uległa zmianie. Spróbuj ponownie.');
      const context = target ? await snapshot(target as SceneNode) : null;
      pending = { context, catalog, pageId }; active = true;
      // Run concurrently with the JEV request. Applying a response stops it immediately.
      if (target) void highlightEditedNode(target);
      send('prepared', { input: { prompt: message.prompt, structure: message.structure, catalog, context } }); return;
    }
    if (message.type === 'apply' && active) { const warnings = await apply(message.plan); active = false; console.log('RENDER RESULT', { success: true, mode: message.plan.mode, warnings }); send('done', { warnings }); await selection(); return; }
    if (message.type === 'cancel') { stopHighlight?.(); pending = null; active = false; }
  } catch (error) { stopHighlight?.(); active = false; pending = null; const detail = error instanceof Error ? error.message : 'Błąd wtyczki.'; console.log('RENDER RESULT', { success: false, error: detail }); send('error', { error: detail }); }
};
