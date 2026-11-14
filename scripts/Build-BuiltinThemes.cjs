// Built-in distribution is the same SDK payload as an imported visual package.
// No theme-specific CSS or behavior belongs in the host/runtime.
const fs = require('node:fs');
const path = require('node:path');
const { load } = require('../ThemeSDK/project.cjs');
const root = path.resolve(__dirname, '..');
const project = load(path.join(root, 'ThemeSDK/examples/orbit-modular'));
const { manifest, parts, assets } = project;
const output = path.join(root, 'Doorpi/wwwroot/themes/builtin/orbit.json');
const expected = JSON.stringify({ id: manifest.id, manifest, parts, assets }, null, 2) + '\n';
if (process.argv.includes('--check')) {
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== expected)
        throw Error('Stale Orbit distribution. Run node scripts/Build-BuiltinThemes.cjs.');
} else fs.writeFileSync(output, expected);
console.log(`Built-in Orbit: ${Object.keys(parts).length} SDK components, ${Buffer.byteLength(expected)} bytes.`);
