// Run from any directory: node scripts/Test-FrontendIntegrity.cjs [--baseline]
// Baseline mode verifies the initial organization did not change runtime code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../Doorpi');
const frontend = path.join(root, 'Frontend');
const manifest = JSON.parse(fs.readFileSync(path.join(frontend, 'scripts/bundles.json'), 'utf8'));
const hash = text => crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
let count = 0;
for (const bundle of manifest.bundles) {
    const expected = bundle.sources.map(source =>
        fs.readFileSync(path.join(frontend, source.path), 'utf8').replace(
            /__doorpiCss\("([^"\r\n]+)"\)/g,
            (_, css) => '`' + fs.readFileSync(path.join(frontend, css), 'utf8') + '`'
        )
    ).join('');
    const actual = fs.readFileSync(path.join(root, bundle.output), 'utf8');
    if (actual !== expected) throw new Error(`Bundle does not match sources: ${bundle.output}`);
    if (actual.includes('__doorpiCss(')) throw new Error(`Unexpanded macro: ${bundle.output}`);
    new vm.Script(actual, { filename: bundle.output });
    if (process.argv.includes('--baseline') && hash(actual) !== bundle.baselineSha256) {
        throw new Error(`Runtime differs from the pre-organization baseline: ${bundle.output}`);
    }
    count++;
}
const cssManifest = JSON.parse(fs.readFileSync(path.join(frontend, 'styles/bundle.json'), 'utf8'));
const css = Buffer.concat(cssManifest.sources.map(source =>
    fs.readFileSync(path.join(frontend, 'styles', source.path))));
if (!css.equals(fs.readFileSync(path.join(root, cssManifest.output)))) {
    throw new Error('Main CSS bundle does not match sources');
}
console.log(`PASS: ${count} JS bundles match their sources, parse successfully and contain no build macros; main CSS matches.`);
if (process.argv.includes('--baseline')) console.log('PASS: all JS runtime content matches the pre-organization baseline.');
