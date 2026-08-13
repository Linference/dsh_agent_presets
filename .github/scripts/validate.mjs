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
 *   - `.github/presets.json` to be well-formed (unique ids/orders, non-empty
 *     text fields, readOnly flags) and to cover exactly the preset dirs;
 *   - a persona row (`@deepseek-ai/dsh-persona`) with non-empty text;
 *   - readOnly presets to have both shell rows hard-disabled (no `!!js`
 *     platform switch, both `disabled: true`) — the read-only promise is
 *     enforced at the tool layer, not left to prose.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

const PRESET_ID = /^[a-z0-9][a-z0-9-]*$/;
const COMPOSITION_FILE = 'agent.cordis.yml';
const METADATA_FILE = 'preset.yml';
const PERSONA = '@deepseek-ai/dsh-persona';
const DATA_FILE = join('.github', 'presets.json');

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

/** Load and validate the single-source data file; undefined when unusable. */
function loadDataFile() {
  let data;
  try {
    data = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    const full = error instanceof Error ? error.message : String(error);
    fail(`${DATA_FILE}: cannot parse: ${full.split('\n')[0]}`);
    return undefined;
  }
  if (typeof data !== 'object' || data === null || !Array.isArray(data.presets) || data.presets.length === 0) {
    fail(`${DATA_FILE}: must be an object with a non-empty presets array`);
    return undefined;
  }
  const ids = [];
  const orders = [];
  for (const [i, p] of data.presets.entries()) {
    const label = `presets[${i}]`;
    if (typeof p !== 'object' || p === null) {
      fail(`${DATA_FILE} ${label}: not an object`);
      continue;
    }
    if (!PRESET_ID.test(String(p.id ?? ''))) fail(`${DATA_FILE} ${label}: id "${p.id}" must match ${PRESET_ID}`);
    if (text(p.name) === undefined) fail(`${DATA_FILE} ${label}: missing name`);
    if (text(p.description) === undefined) fail(`${DATA_FILE} ${label}: missing description`);
    if (text(p.persona) === undefined) fail(`${DATA_FILE} ${label}: missing persona`);
    if (!Number.isFinite(p.order)) fail(`${DATA_FILE} ${label}: order must be a finite number`);
    if (p.readOnly !== undefined && typeof p.readOnly !== 'boolean') {
      fail(`${DATA_FILE} ${label}: readOnly must be a boolean when present`);
    }
    ids.push(p.id);
    orders.push(p.order);
  }
  const dupIds = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dupIds.length > 0) fail(`${DATA_FILE}: duplicate preset id(s) ${[...new Set(dupIds)].join(', ')}`);
  const dupOrders = orders.filter((v, i) => orders.indexOf(v) !== i);
  if (dupOrders.length > 0) fail(`${DATA_FILE}: duplicate order value(s) ${[...new Set(dupOrders)].join(', ')}`);
  return data;
}

async function checkPreset(dir, id, entry) {
  const compositionPath = join(dir, COMPOSITION_FILE);

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

  // readOnly presets: shells must be hard-disabled at the tool layer.
  if (entry?.readOnly === true) {
    for (const shellId of ['tool-bash', 'tool-pwsh']) {
      const row = rows.find((r) => r.id === shellId);
      if (row === undefined) {
        fail(`${id}: readOnly preset must keep the ${shellId} row (hard-disabled)`);
      } else if (row.disabled !== true) {
        fail(`${id}: readOnly preset must set ${shellId} disabled: true (found: ${JSON.stringify(row.disabled)})`);
      }
    }
  } else {
    for (const shellId of ['tool-bash', 'tool-pwsh']) {
      const row = rows.find((r) => r.id === shellId);
      if (row?.disabled === true) {
        fail(`${id}: ${shellId} is hard-disabled but the preset is not readOnly`);
      }
    }
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

const data = loadDataFile();
const dataIds = new Set((data?.presets ?? []).map((p) => p.id));

const root = process.cwd();
const entries = await readdir(root);
const found = new Map();
let checked = 0;
for (const entry of entries) {
  if (entry.startsWith('.') || entry === 'node_modules') continue;
  const path = join(root, entry);
  if (!(await stat(path)).isDirectory()) continue;
  if (!PRESET_ID.test(entry)) continue; // Non-preset directories are skipped, same as scanRoot.
  found.set(entry, path);
  const meta = (data?.presets ?? []).find((p) => p.id === entry);
  await checkPreset(path, entry, meta);
  checked += 1;
}

if (checked === 0) {
  fail('no preset directories found (a preset id must match /^[a-z0-9][a-z0-9-]*$/)');
}

if (data !== undefined) {
  for (const id of dataIds) {
    if (!found.has(id)) fail(`${id}: listed in ${DATA_FILE} but has no directory — run \`npm run generate\``);
  }
  for (const id of found.keys()) {
    if (!dataIds.has(id)) fail(`${id}: has a directory but is not listed in ${DATA_FILE} — run \`npm run generate\``);
  }
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} problem(s) found:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`✓ all ${checked} presets pass (structure, YAML dialect, metadata, unique ids, persona, readOnly enforcement)`);
