/**
 * Collection validator for this repo's agent presets.
 *
 * Mirrors the mount-time rules `@deepseek-ai/dsh-agent-presets` enforces, so
 * a preset that passes here is loadable by DSH:
 *   - every directory whose name matches PRESET_ID (^[a-z0-9][a-z0-9-]*$)
 *     must carry a readable, loadable `agent.cordis.yml`;
 *   - the composition must be a top-level list of plugin rows, each row a map
 *     with a non-empty string `name`, with groups (`group: true`) recursing
 *     into their `config` lists; YAML is parsed with the loader's dialect
 *     (the one carrying `!!js`);
 *   - `preset.yml` (display metadata) may carry `name` / `description`
 *     (non-empty strings) and `order` (finite number) only.
 *
 * On top of the official rules, this collection additionally requires:
 *   - a preset.yml with a non-empty name and description per preset;
 *   - unique row ids across each composition;
 *   - a persona row (`@deepseek-ai/dsh-persona`) with non-empty text.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';

const PRESET_ID = /^[a-z0-9][a-z0-9-]*$/;
const COMPOSITION_FILE = 'agent.cordis.yml';
const METADATA_FILE = 'preset.yml';
const PERSONA = '@deepseek-ai/dsh-persona';

// The loader's own dialect: `!!js` scalars are expressions, not strings.
const jsType = new yaml.Type('tag:yaml.org,2002:js', {
  kind: 'scalar',
  resolve: () => true,
  construct(data) {
    // eslint-disable-next-line no-new-func -- the loader executes these; compiling here catches syntax errors early
    new Function(`return (${data});`);
    return data;
  },
});
const schema = yaml.DEFAULT_SCHEMA.extend([jsType]);

const problems = [];

function fail(message) {
  problems.push(message);
}

function text(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** Official entry-list shape check, mirrored from dsh-agent-presets. */
function entryListProblem(rows, at = '') {
  if (!Array.isArray(rows)) {
    return at === ''
      ? 'the composition must be a top-level list of plugin rows'
      : `group ${at} must hold a list of plugin rows`;
  }
  for (const [index, row] of rows.entries()) {
    const label = at === '' ? `row ${index + 1}` : `${at} row ${index + 1}`;
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      return `${label} is not a plugin row (expected a map with a "name")`;
    }
    const { name, group, config } = row;
    if (typeof name !== 'string' || name === '') {
      return `${label} names no plugin (a "name" string is required)`;
    }
    if (group === true) {
      const nested = entryListProblem(config, label);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}

function collectIds(rows, into = []) {
  for (const row of rows) {
    if (row && typeof row === 'object' && typeof row.id === 'string') into.push(row.id);
    if (row && row.group === true && Array.isArray(row.config)) collectIds(row.config, into);
  }
  return into;
}

async function checkPreset(dir, id) {
  const compositionPath = join(dir, COMPOSITION_FILE);

  // Composition must exist and load.
  let content;
  try {
    content = await readFile(compositionPath, 'utf8');
  } catch {
    fail(`${id}: ${COMPOSITION_FILE} is missing — the directory still occupies the id`);
    return;
  }
  let rows;
  try {
    rows = yaml.load(content, { schema });
  } catch (error) {
    const full = error instanceof Error ? error.message : String(error);
    fail(`${id}: ${COMPOSITION_FILE} is not valid YAML: ${full.replace(/\n[\s\S]*$/, '')}`);
    return;
  }
  const shape = entryListProblem(rows);
  if (shape !== undefined) {
    fail(`${id}: ${shape}`);
    return;
  }

  // Collection extras.
  const ids = collectIds(rows);
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dupes.length > 0) fail(`${id}: duplicate row id(s) ${[...new Set(dupes)].join(', ')}`);

  const persona = rows.find((row) => row.name === PERSONA);
  if (persona === undefined) {
    fail(`${id}: missing persona row (${PERSONA})`);
  } else if (text(persona.config?.text) === undefined) {
    fail(`${id}: persona row carries no non-empty config.text`);
  }

  // Display metadata (required by this collection, optional in DSH).
  let meta;
  try {
    meta = yaml.load(await readFile(join(dir, METADATA_FILE), 'utf8'));
  } catch (error) {
    const full = error instanceof Error ? error.message : String(error);
    fail(`${id}: ${METADATA_FILE} is not valid YAML: ${full.replace(/\n[\s\S]*$/, '')}`);
    return;
  }
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    fail(`${id}: ${METADATA_FILE} must be a map with name/description`);
    return;
  }
  for (const key of Object.keys(meta)) {
    if (!['name', 'description', 'order'].includes(key)) {
      fail(`${id}: ${METADATA_FILE} carries unknown key "${key}" (allowed: name, description, order)`);
    }
  }
  if (text(meta.name) === undefined) fail(`${id}: ${METADATA_FILE} needs a non-empty name`);
  if (text(meta.description) === undefined) fail(`${id}: ${METADATA_FILE} needs a non-empty description`);
  if (meta.order !== undefined && !(typeof meta.order === 'number' && Number.isFinite(meta.order))) {
    fail(`${id}: order must be a finite number`);
  }
}

const root = process.cwd();
const entries = await readdir(root);
let checked = 0;
for (const entry of entries) {
  if (entry.startsWith('.') || entry === 'node_modules') continue;
  const path = join(root, entry);
  if (!(await stat(path)).isDirectory()) continue;
  if (!PRESET_ID.test(entry)) continue; // Non-preset directories are skipped, same as scanRoot.
  await checkPreset(path, entry);
  checked += 1;
}

if (checked === 0) {
  fail('no preset directories found (a preset id must match /^[a-z0-9][a-z0-9-]*$/)');
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} problem(s) found:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`✓ all ${checked} presets pass (structure, YAML dialect, metadata, unique ids, persona)`);
