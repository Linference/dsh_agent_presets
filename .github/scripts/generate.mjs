/**
 * Preset generator: rebuilds every preset directory from two single sources —
 * `.github/baseline/agent.cordis.yml` (the shared composition skeleton) and
 * `.github/presets.json` (per-preset id, metadata, persona, flags).
 *
 * The output is deterministic, so CI runs this and then `git diff --exit-code`
 * to prove the checked-in presets are exactly what these sources describe.
 * Editing a persona means editing `presets.json`, never the generated files.
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const data = JSON.parse(await readFile(join(root, '.github', 'presets.json'), 'utf8'));
const baseline = await readFile(join(root, '.github', 'baseline', 'agent.cordis.yml'), 'utf8');

const personaStart = baseline.indexOf('- id: persona');
const personaEnd = baseline.indexOf('- id: agent-instructions');
if (personaStart < 0 || personaEnd < 0 || personaEnd < personaStart) {
  throw new Error('baseline must contain a persona row followed by an agent-instructions row');
}

// readOnly presets get their shell rows hard-disabled (tool-level, not prose).
const SHELL_ROWS = [
  { id: 'tool-bash', from: "disabled: !!js process.platform === 'win32'", to: 'disabled: true' },
  { id: 'tool-pwsh', from: "disabled: !!js process.platform !== 'win32'", to: 'disabled: true' },
];

for (const preset of data.presets) {
  const dir = join(root, preset.id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  await writeFile(
    join(dir, 'preset.yml'),
    `name: ${preset.name}\ndescription: ${preset.description}\norder: ${preset.order}\n`,
  );

  let body = baseline;
  const lines = preset.persona.split('\n').map((line) => (line === '' ? '      ' : `      ${line}`));
  const personaRow = `- id: persona\n  name: '@deepseek-ai/dsh-persona'\n  config:\n    text: |-\n${lines.join('\n')}\n\n`;
  body = body.slice(0, personaStart) + personaRow + body.slice(personaEnd);

  if (preset.readOnly) {
    for (const row of SHELL_ROWS) {
      if (!body.includes(row.from)) {
        throw new Error(`${preset.id}: baseline lacks the expected "${row.id}" shell row`);
      }
      body = body.replace(row.from, row.to);
    }
  }
  await writeFile(join(dir, 'agent.cordis.yml'), body);
}
console.log(`generated ${data.presets.length} presets from .github/baseline + .github/presets.json`);
