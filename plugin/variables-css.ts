// Export all local tokens, plus dependencies referenced by aliases.
export async function exportVariablesCss(api: VariablesAPI) {
  const variables = new Map<string, Variable>();
  const collections = new Map<string, VariableCollection>();
  const visit = async (variable: Variable) => {
    if (variables.has(variable.id)) return;
    variables.set(variable.id, variable);
    const collection = await api.getVariableCollectionByIdAsync(variable.variableCollectionId);
    if (!collection) throw new Error(`Brak kolekcji dla ${variable.name}.`);
    collections.set(collection.id, collection);
    for (const value of Object.values(variable.valuesByMode)) {
      if (typeof value !== 'object' || !('type' in value) || value.type !== 'VARIABLE_ALIAS') continue;
      const dependency = await api.getVariableByIdAsync(value.id);
      if (!dependency) throw new Error(`Niedostępny alias zmiennej ${variable.name}.`);
      await visit(dependency);
    }
  };
  for (const variable of await api.getLocalVariablesAsync()) await visit(variable);
  if (!variables.size) throw new Error('Brak lokalnych zmiennych. Otwórz plik źródłowy design systemu i pobierz CSS ponownie.');
  const slug = (name: string) => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'token';
  const comment = (text: string) => text.replace(/\*\//g, '* /').replace(/[\r\n]/g, ' ');
  const used = new Set<string>();
  const unique = (base: string) => { let name = base; let n = 2; while (used.has(name)) name = `${base}-${n++}`; used.add(name); return name; };
  const ordered = [...variables.values()].sort((a, b) => a.id.localeCompare(b.id));
  const names = new Map<string, string>();
  // Reserve explicit WEB names before generated names to avoid silently overriding tokens.
  for (const v of ordered) {
    const syntax = v.codeSyntax?.WEB?.trim() || '';
    const name = syntax.match(/^(--[a-zA-Z_][a-zA-Z0-9_-]*)$/)?.[1] || syntax.match(/^var\((--[a-zA-Z_][a-zA-Z0-9_-]*)\)$/)?.[1];
    if (name) {
      if (used.has(name)) throw new Error(`Powtórzona nazwa CSS ${name}. Popraw Code syntax w Figmie.`);
      used.add(name); names.set(v.id, name);
    }
  }
  for (const v of ordered) if (!names.has(v.id)) names.set(v.id, unique(`--cd-${slug(v.name)}`));
  const dimensions = new Set(['CORNER_RADIUS', 'WIDTH_HEIGHT', 'GAP', 'FONT_SIZE', 'LETTER_SPACING', 'PARAGRAPH_SPACING', 'PARAGRAPH_INDENT', 'STROKE_FLOAT']);
  const cssValue = (v: Variable, value: VariableValue): string => {
    if (typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') return `var(${names.get(value.id)})`;
    if (typeof value === 'object') {
      if (!('r' in value)) throw new Error(`Nieobsługiwany typ zmiennej ${v.name}: ${v.resolvedType}.`);
      const channel = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0');
      const alpha = 'a' in value ? value.a : 1;
      return `#${channel(value.r)}${channel(value.g)}${channel(value.b)}${alpha < 1 ? channel(alpha) : ''}`;
    }
    if (typeof value === 'number') return `${value}${v.scopes.length && v.scopes.every(s => dimensions.has(s)) ? 'px' : ''}`;
    if (typeof value === 'boolean') return value ? '1' : '0';
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\a ').replace(/\r/g, '\\d ').replace(/\0/g, '\\fffd ')}"`;
  };
  const blocks: string[] = [
    '/* FigmaJev — variables from the source Figma file. Import this stylesheet once.\n' +
    ' * Default modes apply to :root. Set mode attributes on <html> (examples below).\n' +
    ' * Dimension-only scopes use px. Other numbers are unitless; use calc(var(--token) * 1px) for lengths.\n' +
    ' * BOOLEAN: 1/0; STRING: quoted CSS string. These are tokens, not component styles.\n */'
  ];
  const attributes = new Set<string>();
  for (const collection of [...collections.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    let attribute = `data-figma-${slug(collection.name)}`; let suffix = 2;
    while (attributes.has(attribute)) attribute = `data-figma-${slug(collection.name)}-${suffix++}`;
    attributes.add(attribute);
    const modeNames = new Set<string>();
    const members = ordered.filter(v => v.variableCollectionId === collection.id).sort((a, b) => names.get(a.id)!.localeCompare(names.get(b.id)!));
    // Default first so explicit mode selectors override it.
    const modes = [...collection.modes].sort((a, b) => Number(b.modeId === collection.defaultModeId) - Number(a.modeId === collection.defaultModeId));
    for (const mode of modes) {
      let modeName = slug(mode.name); let n = 2;
      while (modeNames.has(modeName)) modeName = `${slug(mode.name)}-${n++}`;
      modeNames.add(modeName);
      const selector = `:root[${attribute}="${modeName}"]`;
      const declarations = members.map(v => {
        const value = v.valuesByMode[mode.modeId];
        if (value === undefined) throw new Error(`Brak wartości ${v.name} w trybie ${mode.name}.`);
        return `  /* ${comment(v.name)}${v.description ? ': ' + comment(v.description) : ''} */\n  ${names.get(v.id)}: ${cssValue(v, value)};`;
      });
      blocks.push(`/* ${comment(collection.name)} / ${comment(mode.name)} — <html ${attribute}="${modeName}"> */\n${mode.modeId === collection.defaultModeId ? ':root,\n' : ''}${selector} {\n${declarations.join('\n')}\n}`);
    }
  }
  return { css: blocks.join('\n\n') + '\n', count: variables.size, filename: 'figma-variables.css' };
}
