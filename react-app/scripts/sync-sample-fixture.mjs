import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureName = 'league-six-teams.scrkpr';
const source = path.resolve(appDir, '..', 'tests', 'fixtures', fixtureName);
const samplesDir = path.join(appDir, 'public', 'samples');

mkdirSync(samplesDir, { recursive: true });
copyFileSync(source, path.join(samplesDir, fixtureName));
