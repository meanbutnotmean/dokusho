import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist', 'safari');
const fflatePath = path.join(root, 'node_modules', 'fflate', 'umd', 'index.js');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, 'extension'), output, { recursive: true });
await cp(fflatePath, path.join(output, 'fflate.js'));
const options = path.join(output, 'options.html');
const html = await readFile(options, 'utf8');
await writeFile(options, html.replace('<script src="options.js"></script>', '<script src="fflate.js"></script>\n    <script src="options.js"></script>'));
console.log(`Safari extension source built at ${output}`);
