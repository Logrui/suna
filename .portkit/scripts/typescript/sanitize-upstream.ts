import { Project } from "ts-morph";
import * as path from "path";
import * as fs from "fs";

// Simple "Poison" patterns to remove/rewrite
// Unlike Python regex, we can potentially use AST here to be safer.
// But for "Sanitization", often removing lines is valid.

function sanitizeUpstream(targetFile: string) {
    if (!fs.existsSync(targetFile)) {
        console.error("File not found");
        process.exit(1);
    }

    // Load Rules
    const rulesPath = path.resolve(".portkit/ecosystem-rules.json");
    let deniedDeps: any[] = [];
    if (fs.existsSync(rulesPath)) {
        try {
            const rules = JSON.parse(fs.readFileSync(rulesPath, "utf-8"));
            deniedDeps = rules.denied_dependencies || [];
        } catch (e) {
            console.warn("Failed to load ecosystem rules", e);
        }
    }

    let content = fs.readFileSync(targetFile, "utf-8");

    // Dynamic Sanitization
    for (const dep of deniedDeps) {
        if (dep.action === "strip") {
            const pkg = dep.package;
            // import ... from "pkg"
            const regexImport = new RegExp(`import\\s+.*?from\\s+['"]${pkg}['"];?`, "gm");
            content = content.replace(regexImport, "");

            // import "pkg"
            const regexSideEffect = new RegExp(`import\\s+['"]${pkg}['"];?`, "gm");
            content = content.replace(regexSideEffect, "");
        }
    }

    // Write back
    fs.writeFileSync(targetFile, content, "utf-8");
    console.log(`Sanitized: ${targetFile}`);
}

const args = process.argv.slice(2);
const target = args[0]; // First arg is file

if (target) {
    sanitizeUpstream(target);
} else {
    console.error("Usage: ts-node sanitize-upstream.ts [FILE]");
    process.exit(1);
}
