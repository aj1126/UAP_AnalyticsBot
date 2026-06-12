const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');

function readFile(relativePath) {
    return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

function loadJson(relativePath) {
    return JSON.parse(readFile(relativePath));
}

function pathExists(relativePath) {
    return fs.existsSync(path.join(repositoryRoot, relativePath));
}

function readFileSafely(relativePath, failures) {
    try {
        return readFile(relativePath);
    } catch (error) {
        failures.push(`Unable to read ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

function main() {
    const docsSource = loadJson('docs/docs-source.json');
    const packageJson = loadJson('package.json');
    const readme = readFile('README.md');

    const failures = [];
    const architecture = readFileSafely('docs/architecture.md', failures);
    const legacyPrototype = readFileSafely('docs/legacy-prototype.md', failures);

    for (const command of docsSource.commands) {
        if (!packageJson.scripts?.[command.script]) {
            failures.push(`Missing npm script "${command.script}" referenced by docs/docs-source.json.`);
        }
    }

    for (const entry of docsSource.repoLayout) {
        if (!pathExists(entry.path)) {
            failures.push(`Repository layout entry does not exist: ${entry.path}`);
        }
    }

    for (const docPath of docsSource.requiredDocs) {
        if (!pathExists(docPath)) {
            failures.push(`Required documentation file is missing: ${docPath}`);
            continue;
        }

        if (!readme.includes(`(${docPath})`)) {
            failures.push(`README.md is missing a link to ${docPath}`);
        }
    }

    for (const marker of [
        '<!-- GENERATED:commands:START -->',
        '<!-- GENERATED:supported-file-types:START -->',
        '<!-- GENERATED:repo-layout:START -->'
    ]) {
        if (!readme.includes(marker)) {
            failures.push(`README.md is missing generated section marker: ${marker}`);
        }
    }

    if (readme.includes('pip install -r requirements.txt') || readme.includes('python ingestion.py')) {
        failures.push('README.md still contains Python prototype setup or execution guidance.');
    }

    if (!readme.includes('npm start -- /absolute/path/to/source-folder')) {
        failures.push('README.md is missing the primary Node CLI command.');
    }

    if (architecture && (!architecture.includes('## Current Implementation') || !architecture.includes('## Planned Expansion'))) {
        failures.push('docs/architecture.md must include Current Implementation and Planned Expansion sections.');
    }

    for (const diagramPath of [
        'docs/diagrams/architectureDiagram.mermaid',
        'docs/diagrams/sequenceDiagram.mermaid'
    ]) {
        if (!pathExists(diagramPath)) {
            failures.push(`Missing diagram file: ${diagramPath}`);
        }

        if (architecture && !architecture.includes(diagramPath.replace('docs/', ''))) {
            failures.push(`docs/architecture.md should reference ${diagramPath}.`);
        }
    }

    if (legacyPrototype && !legacyPrototype.includes('# Legacy Python Prototype')) {
        failures.push('docs/legacy-prototype.md is missing its expected title.');
    }

    if (failures.length > 0) {
        process.stderr.write(`Documentation validation failed:\n- ${failures.join('\n- ')}\n`);
        process.exitCode = 1;
        return;
    }

    process.stdout.write('Documentation references and structure are valid.\n');
}

main();
