// Scan Registry - Maintenance Tool
// Purpose: Scans codebase for @feature annotations and updates feature-registry.json.

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const REGISTRY_PATH = path.join('.portkit', 'addon-features-registry', 'feature-registry.json');

interface FeatureMap {
    [key: string]: string[];
}

interface Registry {
    metadata: { version: string; last_updated: string };
    features: {
        [key: string]: {
            status: string;
            version: string;
            files: string[];
            dependencies: string[];
            last_synced: string;
        };
    };
}

function scanFile(filePath: string, featureMap: FeatureMap) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const matches = [
            ...content.matchAll(/\/\/\s*feature-start:\s*([\w-]+)/g),
            ...content.matchAll(/#\s*feature-start:\s*([\w-]+)/g)
        ];

        for (const match of matches) {
            const feature = match[1];
            if (!featureMap[feature]) {
                featureMap[feature] = [];
            }
            // Normalize to POSIX
            const normalizedPath = filePath.split(path.sep).join('/');
            if (!featureMap[feature].includes(normalizedPath)) {
                featureMap[feature].push(normalizedPath);
            }
        }
    } catch (e) {
        // Ignore errors
    }
}

function getChangedFiles(): string[] {
    const files = new Set<string>();
    try {
        // 1. Modified tracked files
        const resMod = execSync('git diff --name-only HEAD', { encoding: 'utf-8' });
        resMod.split('\n').filter(Boolean).forEach(f => files.add(f.trim()));

        // 2. Untracked (new) files
        const resNew = execSync('git ls-files --others --exclude-standard', { encoding: 'utf-8' });
        resNew.split('\n').filter(Boolean).forEach(f => files.add(f.trim()));
    } catch (e) {
        console.error(`Warning: Could not get git status: ${e}`);
    }

    return Array.from(files).filter(f => /\.(ts|tsx|js|py|md)$/.test(f));
}

function main() {
    const args = process.argv.slice(2);
    const update = args.includes('--update');
    const audit = args.includes('--audit');

    // Parse --folder argument
    let scanFolder = '.';
    const folderIndex = args.indexOf('--folder');
    if (folderIndex !== -1 && args[folderIndex + 1]) {
        scanFolder = args[folderIndex + 1];
    }

    // Normalize path to ensure git command works well
    scanFolder = path.resolve(scanFolder);

    const featureMap: FeatureMap = {};

    try {
        // OPTIMIZATION: Use git grep to find ONLY files that contain our tags.
        // We limit search to the specified folder if provided.
        // ':/' makes path relative to repo root if using cwd, but let's be careful.
        // If we want to search a subdirectory, we pass it to git grep.

        // Relative path suitable for git grep
        const relPath = path.relative(process.cwd(), scanFolder) || '.';
        const searchPath = relPath === '.' ? '' : `${relPath}/`; // Trailing slash

        const cmd = `git grep -I -l "feature-start:" -- "${searchPath}"`;

        const result = execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }); // pipe stdout, ignore stderr (exit 1 if not found is annoying otherwise)

        const files = result.split('\n').filter(Boolean);

        for (const file of files) {
            const normalizedFile = file.trim();
            // if scanning subdirectory, git grep outputs relative path from CWD usually if run from CWD
            scanFile(normalizedFile, featureMap);
        }

    } catch (e: any) {
        // git grep returns 1 if no matches found
        if (e.status !== 1) {
            console.error(`Error running git grep: ${e}. Falling back to slow walk (not implemented in TS version yet).`);
        }
    }

    if (update) {
        let registry: Registry = { metadata: { version: '1.0', last_updated: new Date().toISOString() }, features: {} };
        if (fs.existsSync(REGISTRY_PATH)) {
            registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
        }

        for (const [feature, files] of Object.entries(featureMap)) {
            if (!registry.features[feature]) {
                registry.features[feature] = { status: 'active', version: '0.1.0', files: [], dependencies: [], last_synced: '' };
            }

            const currentFiles = new Set(registry.features[feature].files.concat(files).map(f => f.split(path.sep).join('/')));
            registry.features[feature].files = Array.from(currentFiles).sort();
            registry.features[feature].last_synced = "manual_scan_timestamp";
        }

        fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
        console.log("Registry Updated.");

    } else if (audit) {
        const changedFiles = getChangedFiles();
        const allTaggedFiles = new Set<string>();

        // We need to reload registry or scan ALL if audit is global. 
        // Audit implies checking if CHANGED files are covered. 
        // NOTE: If we only scanned a folder, we might miss tags elsewhere, but usually audit is run on repo root.
        // For robustness, audit should probably NOT limit by folder unless user intends to ONLY audit that folder.
        // But let's assume if audit is run, we used full scan or the changed files are what matters.

        // Actually, if we use featureMap from a PARTIAL scan, we might flag valid files as untagged if they are outside the scan folder.
        // However, the Python script does a FULL scan for audit.
        // Let's assume for this implementation that audit requires a full scan or relies on the registry + scan?
        // The python script does a fresh scan_file loop.

        // For safety, let's warn if folder is used with audit
        if (folderIndex !== -1) {
            console.warn("Warning: Using --folder with --audit may report false positives if untagged files are outside the folder.");
        }

        Object.values(featureMap).forEach(files => files.forEach(f => allTaggedFiles.add(f)));

        const untracked: string[] = [];
        for (const cf of changedFiles) {
            const normalizedCf = cf.split(path.sep).join('/');

            // Check if tagged (naive check: is exact path in our map?)
            // NOTE: Python used resolve(), here we use string match assuming git ls-files and git grep return canonical relative paths
            if (!allTaggedFiles.has(normalizedCf)) {
                // Double check with resolve to be sure
                const absCf = path.resolve(cf);
                let found = false;
                for (const tagged of allTaggedFiles) {
                    if (path.resolve(tagged) === absCf) {
                        found = true;
                        break;
                    }
                }
                if (!found) untracked.push(normalizedCf);
            }
        }

        if (untracked.length > 0) {
            console.log(JSON.stringify({
                status: "warning",
                message: "Found modified/new files without Feature Tags.",
                untracked_files: untracked
            }, null, 2));
            process.exit(1);
        } else {
            console.log(JSON.stringify({ status: "success", message: "All modified files are properly tagged." }, null, 2));
        }

    } else {
        console.log(JSON.stringify(featureMap, null, 2));
    }
}

main();
