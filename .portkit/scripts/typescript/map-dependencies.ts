import { Project } from "ts-morph";
import * as path from "path";
import * as fs from "fs";

function mapDependencies(targetFile: string) {
    if (!fs.existsSync(targetFile)) {
        console.error(JSON.stringify({ error: "File not found" }));
        process.exit(1);
    }

    const project = new Project({
        tsConfigFilePath: "tsconfig.json", // Assumes root execution
        skipAddingFilesFromTsConfig: true,
    });

    const sourceFile = project.addSourceFileAtPath(targetFile);

    // Resolve full import dependencies
    // Note: ts-morph has powerful referencing, but for 'Blast Radius' we mainly want imports

    const imports = sourceFile.getImportDeclarations();
    const internalDeps: string[] = [];
    const externalDeps: string[] = [];

    imports.forEach(imp => {
        const moduleSpecifier = imp.getModuleSpecifierValue();

        if (moduleSpecifier.startsWith(".") || moduleSpecifier.startsWith("@/")) {
            internalDeps.push(moduleSpecifier);
        } else {
            externalDeps.push(moduleSpecifier);
        }
    });

    // Check for dynamic imports? (Usually simpler to stick to static for v1)

    const report = {
        file: targetFile,
        dependencies: {
            internal: [...new Set(internalDeps)].sort(),
            external: [...new Set(externalDeps)].sort()
        }
    };

    console.log(JSON.stringify(report, null, 2));
}

// CLI args parsing manually to avoid heavy deps
const args = process.argv.slice(2);
const targetIndex = args.indexOf("--target");

if (targetIndex !== -1 && args[targetIndex + 1]) {
    mapDependencies(args[targetIndex + 1]);
} else {
    console.error("Usage: ts-node map-dependencies.ts --target [FILE]");
    process.exit(1);
}
