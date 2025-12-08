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

    // We can use simple regex for speed and robustness against broken syntax
    // (sometimes upstream files might not fully parse if deps are missing)
    let content = fs.readFileSync(targetFile, "utf-8");

    // 1. Remove Next-Intl
    content = content.replace(/import\s+.*?from\s+['"]next-intl['"];?/gm, "");
    content = content.replace(/useTranslations\(.*?\);?/gm, "() => (key: string) => key; // Shimmed");

    // 2. Remove Billing Hooks
    content = content.replace(/import\s+.*?from\s+['"]@\/hooks\/billing['"];?/gm, "");

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
