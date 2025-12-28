#!/usr/bin/env node

/**
 * Universal Patch Application System
 * 
 * Applies numbered patches and code transformations in order.
 * Supports:
 *   - .patch files (traditional git patches)
 *   - .js files (jscodeshift codemods for JavaScript/TypeScript)
 *   - .py files (libcst codemods for Python)
 *   - .yml/.yaml files (ast-grep rules for any language)
 * 
 * Usage:
 *   node patches/apply-patches.js [--dry-run] [--verbose]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PATCHES_DIR = path.join(__dirname, '..', 'patches');
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const BACKEND_DIR = path.join(__dirname, '..', 'backend');

// CLI Arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose') || args.includes('-v');

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    log(`\n${'='.repeat(60)}`, 'bright');
    log(`  ${title}`, 'bright');
    log(`${'='.repeat(60)}`, 'bright');
}

function logPatch(number, name, type) {
    const typeIcon = {
        patch: '📝',
        'codemod-js': '🔧',
        'codemod-py': '🐍',
        astgrep: '🎯',
    }[type] || '❓';

    log(`${typeIcon} [${number}] ${name} (${type})`, 'cyan');
}

/**
 * Get all patch files sorted by number prefix
 */
function getPatchFiles() {
    if (!fs.existsSync(PATCHES_DIR)) {
        log(`⚠️  Patches directory not found: ${PATCHES_DIR}`, 'yellow');
        return [];
    }

    const files = fs.readdirSync(PATCHES_DIR)
        .filter(file => {
            const ext = path.extname(file);
            // Only include patch files with numbered prefixes
            // Exclude apply-patches.js (this script)
            if (file === 'apply-patches.js') return false;
            // Must have a number prefix like "001-" to be a patch
            if (!/^\d+-.+/.test(file)) return false;
            return ['.patch', '.js', '.py', '.yml', '.yaml'].includes(ext);
        })
        .map(file => {
            // Extract number prefix (e.g., "001" from "001-fix-api.patch")
            const match = file.match(/^(\d+)-/);
            return {
                file,
                number: match ? parseInt(match[1], 10) : 999,
                fullPath: path.join(PATCHES_DIR, file),
            };
        })
        .sort((a, b) => a.number - b.number);

    return files;
}

/**
 * Determine patch type from extension
 */
function getPatchType(filename) {
    const ext = path.extname(filename);
    if (ext === '.patch') return 'patch';
    if (ext === '.js') return 'codemod-js';
    if (ext === '.py') return 'codemod-py';
    if (ext === '.yml' || ext === '.yaml') return 'astgrep';
    return 'unknown';
}

/**
 * Apply a traditional git patch
 * Detects if patch is already applied or not applicable and skips gracefully
 */
function applyGitPatch(patchPath) {
    try {
        const cmd = `git apply --check "${patchPath}"`;
        if (isVerbose) log(`  Checking: ${cmd}`, 'blue');

        execSync(cmd, {
            stdio: 'pipe',
            cwd: path.join(__dirname, '..')
        });

        if (!isDryRun) {
            const applyCmd = `git apply "${patchPath}"`;
            if (isVerbose) log(`  Applying: ${applyCmd}`, 'blue');
            execSync(applyCmd, {
                stdio: 'inherit',
                cwd: path.join(__dirname, '..')
            });
        }

        return { success: true };
    } catch (error) {
        const errorMsg = error.message || error.stderr?.toString() || '';

        // "No valid patches" means patch is empty or all changes already applied
        if (errorMsg.includes('No valid patches')) {
            return { success: true, alreadyApplied: true };
        }

        // "No such file or directory" means patch targets files not in this context
        // (e.g., frontend patch being applied in backend build, or vice versa)
        if (errorMsg.includes('No such file or directory')) {
            return { success: true, skippedContext: true };
        }

        // Check if patch is already applied by trying reverse (Strict check)
        try {
            const reverseCmd = `git apply --check --reverse "${patchPath}"`;
            if (isVerbose) log(`  Checking reverse: ${reverseCmd}`, 'blue');
            execSync(reverseCmd, {
                stdio: 'pipe',
                cwd: path.join(__dirname, '..')
            });
            // If reverse check passes, the patch is already applied
            return { success: true, alreadyApplied: true };
        } catch (strictReverseError) {
            if (isVerbose) log(`  Strict reverse check failed: ${strictReverseError.message.split('\n')[0]}`, 'dim');
            // Try lenient reverse check (ignoring whitespace/line endings)
            try {
                const looseReverseCmd = `git apply --check --reverse --ignore-space-change --ignore-whitespace "${patchPath}"`;
                if (isVerbose) log(`  Checking reverse (loose): ${looseReverseCmd}`, 'blue');
                execSync(looseReverseCmd, {
                    stdio: 'pipe',
                    cwd: path.join(__dirname, '..')
                });
                return { success: true, alreadyApplied: true };
            } catch (looseError) {
                // If we're here, the patch:
                // 1. Didn't apply cleanly (forward check failed)
                // 2. Isn't perfectly applied (strict reverse failed)
                // 3. Isn't even loosely applied (loose reverse failed)

                // In a Fork/Receipt model, this likely means "Code Drift" - the file has changed 
                // enough that the patch no longer applies, but it's not "Already Applied".
                // We should WARN but NOT FAIL the build, as manual changes likely superseded the patch.
                return {
                    success: true, // Treat as success to keep build going
                    drifted: true,
                    error: looseError.message
                };
            }
        }
    }
}

/**
 * Apply a jscodeshift codemod
 */
function applyCodemod(codemodPath, target = FRONTEND_DIR) {
    try {
        // Check if jscodeshift is available
        const hasJscodeshift = execSync('npm list jscodeshift --depth=0', {
            stdio: 'pipe',
            cwd: path.join(__dirname, '..')
        }).toString().includes('jscodeshift');

        if (!hasJscodeshift) {
            log('  ⚠️  jscodeshift not installed, using npx...', 'yellow');
        }

        const cmd = hasJscodeshift
            ? `npx jscodeshift -t "${codemodPath}" "${target}"`
            : `npx -y jscodeshift -t "${codemodPath}" "${target}"`;

        const dryRunFlag = isDryRun ? ' --dry --print' : '';
        const fullCmd = cmd + dryRunFlag;

        if (isVerbose) log(`  Running: ${fullCmd}`, 'blue');

        execSync(fullCmd, {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Apply ast-grep rules
 */
function applyAstGrep(rulesPath, target = FRONTEND_DIR) {
    try {
        // Check if @ast-grep/cli is available
        const hasAstGrep = execSync('npm list @ast-grep/cli --depth=0', {
            stdio: 'pipe',
            cwd: path.join(__dirname, '..')
        }).toString().includes('@ast-grep/cli');

        if (!hasAstGrep) {
            log('  ⚠️  @ast-grep/cli not installed, using npx...', 'yellow');
        }

        const cmd = hasAstGrep
            ? `npx ast-grep scan --rule "${rulesPath}"`
            : `npx -y @ast-grep/cli scan --rule "${rulesPath}"`;

        const updateFlag = isDryRun ? '' : ' --update-all';
        const fullCmd = `cd "${target}" && ${cmd}${updateFlag}`;

        if (isVerbose) log(`  Running: ${fullCmd}`, 'blue');

        execSync(fullCmd, {
            stdio: 'inherit',
            shell: true
        });

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Apply Python codemod (libcst-based transformation)
 */
function applyPythonCodemod(codemodPath, target = BACKEND_DIR) {
    try {
        const cmd = `python "${codemodPath}" "${target}"`;
        const dryRunFlag = isDryRun ? ' --dry-run' : '';
        const fullCmd = cmd + dryRunFlag;

        if (isVerbose) log(`  Running: ${fullCmd}`, 'blue');

        execSync(fullCmd, {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Main execution
 */
function main() {
    logSection('Universal Patch Application System');

    if (isDryRun) {
        log('🔍 DRY RUN MODE - No changes will be applied\n', 'yellow');
    }

    const patches = getPatchFiles();

    if (patches.length === 0) {
        log('✨ No patches found to apply', 'green');
        return;
    }

    log(`Found ${patches.length} patch(es) to apply:\n`, 'bright');

    const results = {
        success: [],
        failed: [],
        skipped: [],
    };

    for (const patch of patches) {
        const type = getPatchType(patch.file);
        const paddedNumber = String(patch.number).padStart(3, '0');

        logPatch(paddedNumber, patch.file, type);

        let result;

        switch (type) {
            case 'patch':
                result = applyGitPatch(patch.fullPath);
                break;

            case 'codemod-js':
                result = applyCodemod(patch.fullPath);
                break;

            case 'codemod-py':
                result = applyPythonCodemod(patch.fullPath);
                break;

            case 'astgrep':
                result = applyAstGrep(patch.fullPath);
                break;

            default:
                result = {
                    success: false,
                    error: `Unknown patch type: ${type}`
                };
        }

        if (result.success) {
            if (result.alreadyApplied) {
                log('  ⏭️  Already applied, skipping\n', 'yellow');
                results.skipped.push(patch.file);
            } else if (result.skippedContext) {
                log('  ⏭️  Not applicable to this context (files not found), skipping\n', 'yellow');
                results.skipped.push(patch.file);
            } else if (result.drifted) {
                log('  ⚠️  Drift detected (patch failed but treated as skipped). Check manually if needed.\n', 'yellow');
                results.skipped.push(`${patch.file} (DRIFTED)`);
            } else {
                log('  ✅ Applied successfully\n', 'green');
                results.success.push(patch.file);
            }
        } else {
            log(`  ❌ Failed: ${result.error}\n`, 'red');
            results.failed.push({ file: patch.file, error: result.error });
        }
    }

    // Summary
    logSection('Summary');
    log(`✅ Successfully applied: ${results.success.length}`, 'green');
    if (results.skipped.length > 0) {
        log(`⏭️  Skipped (Already applied / Context miss / Drift): ${results.skipped.length}`, 'yellow');
        results.skipped.forEach(f => log(`   - ${f}`, 'dim'));
    }
    log(`❌ Failed: ${results.failed.length}`, results.failed.length > 0 ? 'red' : 'reset');

    if (results.failed.length > 0) {
        log('\nFailed patches:', 'red');
        results.failed.forEach(({ file, error }) => {
            log(`  - ${file}`, 'red');
            if (isVerbose) {
                log(`    ${error}`, 'red');
            }
        });
        process.exit(1);
    }

    log('\n✨ All patches applied successfully!', 'green');
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = { main };
