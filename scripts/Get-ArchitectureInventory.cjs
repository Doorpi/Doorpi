// Read-only unless --output <path> is supplied. Run from any directory.
// Literal matches are navigation aids, not a parser or a complete API contract.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const folders = [
    'Doorpi', 'Doorpi.UpdateCore', 'DoorpiUpdater', 'DoorpiInputBridge',
    'DoorpiWindowsUpdateHelper', 'Doorpi.Boot.Tests', 'Doorpi.Browser.Tests', 'scripts', 'installer', 'manifests'
].filter(folder => fs.existsSync(path.join(root, folder)));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--output')) {
    throw new Error('Usage: node scripts/Get-ArchitectureInventory.cjs [--output <path>]');
}
const discovered = spawnSync('rg', [
    '--files', ...folders,
    '-g', '!**/bin/**', '-g', '!**/obj/**', '-g', '!**/Data/**',
    '-g', '!**/node_modules/**', '-g', '!**/GoogleTokens/**',
    '-g', '!**/google-oauth.local.json'
], { cwd: root, encoding: 'utf8', windowsHide: true });
if (discovered.error) throw discovered.error;
if (discovered.status !== 0) throw new Error(discovered.stderr || 'rg failed');

const scriptManifest = JSON.parse(fs.readFileSync(path.join(root, 'Doorpi/Frontend/scripts/bundles.json'), 'utf8'));
const styleManifest = JSON.parse(fs.readFileSync(path.join(root, 'Doorpi/Frontend/styles/bundle.json'), 'utf8'));
const generated = new Set([
    ...scriptManifest.bundles.map(bundle => 'Doorpi/' + bundle.output),
    'Doorpi/' + styleManifest.output
]);
const codeExtensions = new Set([
    '.cs', '.csproj', '.xaml', '.js', '.cjs', '.css', '.html', '.ps1', '.iss',
    '.json', '.xml', '.config', '.manifest', '.props', '.targets', '.cmd', '.resx'
]);
const files = [];
const assets = [];
const literals = [];
const nativeLibraries = [];
const packageReferences = [];
const htmlResources = [];
const assetSummary = {};
const patterns = [
    ['cs-action-comparison', /\baction\s*==\s*"([^"\r\n]+)"/g, ['.cs']],
    ['cs-string-case-candidate', /\bcase\s+"([^"\r\n]+)"\s*:/g, ['.cs']],
    ['js-action-literal', /\baction\s*:\s*['"]([^'"\r\n]+)['"]/g, ['.js']],
    ['js-message-type-comparison', /\b(?:data|msg|message)\.type\s*===?\s*['"]([^'"\r\n]+)['"]/g, ['.js']]
];
function lineAt(text, offset) {
    return text.slice(0, offset).split('\n').length;
}
for (const relative of discovered.stdout.trim().split(/\r?\n/).filter(Boolean).map(file => file.replace(/\\/g, '/')).sort()) {
    const extension = path.extname(relative).toLowerCase();
    const absolute = path.join(root, relative);
    if (!codeExtensions.has(extension)) {
        const group = relative.split('/')[0] + ':' + (extension || '(no extension)');
        const summary = assetSummary[group] ||= { count: 0, bytes: 0 };
        summary.count++;
        const size = fs.statSync(absolute).size;
        summary.bytes += size;
        assets.push({ path: relative, bytes: size });
        continue;
    }
    const bytes = fs.readFileSync(absolute);
    const source = bytes.toString('utf8');
    const role = generated.has(relative) ? 'generated-runtime'
        : relative.startsWith('Doorpi/Frontend/') ? 'frontend-source'
        : relative.endsWith('.cs') ? 'native-source'
        : relative.startsWith('Doorpi/wwwroot/') || relative.startsWith('Doorpi/TrailerExtension/') ? 'runtime-not-yet-modularized'
        : 'project-build-or-native-presentation';
    files.push({ path: relative, role, bytes: bytes.length, lines: source.split('\n').length,
        sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    // Do not count authored sources and their generated runtime as separate APIs.
    if (role === 'generated-runtime') continue;
    for (const [kind, pattern, extensions] of patterns) {
        if (!extensions.includes(extension)) continue;
        for (const match of source.matchAll(pattern)) {
            literals.push({ kind, value: match[1], path: relative, line: lineAt(source, match.index) });
        }
    }
    if (extension === '.cs') {
        for (const match of source.matchAll(/\[DllImport\("([^"\r\n]+)"/g)) {
            nativeLibraries.push({ library: match[1], path: relative, line: lineAt(source, match.index) });
        }
    }
    if (extension === '.csproj') {
        for (const match of source.matchAll(/<PackageReference\b[^>]*\bInclude="([^"]+)"[^>]*\bVersion="([^"]+)"/g)) {
            packageReferences.push({ package: match[1], version: match[2], project: relative });
        }
    }
    if (extension === '.html') {
        for (const match of source.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
            htmlResources.push({ resource: match[1], path: relative, line: lineAt(source, match.index) });
        }
    }
}

const inventory = {
    schemaVersion: 1,
    generatedAtUtc: new Date().toISOString(),
    scope: folders,
    limitations: [
        'Tracked/visible project files discovered by rg; ignored files, bin/obj, user Data and credentials are excluded.',
        'Literal matches can include comments, examples and unrelated switches; dynamic actions and interpolated messages may be absent.',
        'Generated JS/CSS are hashed but not counted again as authored bridge declarations.',
        'PackageReference inventory covers literal Include/Version attributes; it is not a transitive dependency graph.',
        'HTML resources are literal script/link references in document order, not a runtime network trace.',
        'Code and configuration files are hashed; other assets are indexed by path and size without reading their content.',
        'No source, app, service or startup entry was executed to discover behavior.'
    ],
    summary: { codeFiles: files.length, assets: assets.length, scriptBundles: scriptManifest.bundles.length,
        scriptFragments: scriptManifest.bundles.reduce((count, bundle) => count + bundle.sources.length, 0),
        mainCssFragments: styleManifest.sources.length, bridgeLiteralCandidates: literals.length },
    bundles: scriptManifest.bundles.map(bundle => ({ output: 'Doorpi/' + bundle.output,
        sources: bundle.sources.map(source => ({ path: 'Doorpi/Frontend/' + source.path,
            injectedStyles: source.styles.map(style => 'Doorpi/Frontend/' + style) })) })),
    files, assets, literals, nativeLibraries, packageReferences, htmlResources, assetSummary
};
if (args.length) {
    const output = path.resolve(root, args[1]);
    if (!output.startsWith(root + path.sep)) throw new Error('Output must stay inside the workspace');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(inventory, null, 2) + '\n');
    console.log(path.relative(root, output));
}
console.log(JSON.stringify(inventory.summary, null, 2));
