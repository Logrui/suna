// Fetch Upstream - Ingestion Strategy
// Purpose: Manages .portkit-cache shadow repo (clone/fetch).

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const CONFIG_PATH = path.join('.portkit', 'config.json');
const CACHE_DIR = '.portkit-cache';

interface Config {
    upstream_url: string;
}

function loadConfig(): Config {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.error(`Error: Config file not found at ${CONFIG_PATH}`);
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

async function main() {
    const args = process.argv.slice(2);
    const targetRef = args[0]; // e.g., 'main', 'v1.0.0', 'sha123'

    if (!targetRef) {
        console.error("Usage: npx ts-node fetch-upstream.ts <git-ref>");
        process.exit(1);
    }

    const config = loadConfig();
    const repoUrl = config.upstream_url;

    if (!fs.existsSync(CACHE_DIR)) {
        console.log(`Cache missing. Cloning upstream from ${repoUrl}...`);
        try {
            execSync(`git clone ${repoUrl} ${CACHE_DIR}`, { stdio: 'inherit' });
        } catch (e) {
            console.error("Failed to clone upstream repository.");
            process.exit(1);
        }
    } else {
        console.log(`Cache exists. Fetching updates...`);
        try {
            execSync(`git fetch --all`, { cwd: CACHE_DIR, stdio: 'inherit' });
        } catch (e) {
            console.error("Failed to fetch updates.");
            process.exit(1);
        }
    }

    console.log(`Checking out ${targetRef}...`);
    try {
        execSync(`git checkout ${targetRef}`, { cwd: CACHE_DIR, stdio: 'inherit' });
        // Optional: Pull if it's a branch, but checkout is safer for detached refs
        try {
            execSync(`git pull origin ${targetRef}`, { cwd: CACHE_DIR, stdio: 'ignore' });
        } catch (e) {
            // Ignore pull errors (e.g. detached head, tag)
        }

        console.log(`Successfully checked out ${targetRef} in ${CACHE_DIR}`);
    } catch (e) {
        console.error(`Failed to checkout ${targetRef}`);
        process.exit(1);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
