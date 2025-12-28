/**
 * Codemod to replace hardcoded API_URL with getApiUrl() import
 * 
 * Usage:
 *   npx jscodeshift -t replace-api-url-codemod.js src/
 * 
 * This will:
 * 1. Find all: const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';
 * 2. Add import: import { getApiUrl } from '@/lib/get-api-url';
 * 3. Replace with: const API_URL = getApiUrl();
 */

module.exports = function transformer(fileInfo, api) {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);
    let hasChanges = false;

    // Find all variable declarations matching the pattern
    root.find(j.VariableDeclaration).forEach(path => {
        path.value.declarations.forEach(declaration => {
            // Check if it's: const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || ''
            if (
                declaration.id.name === 'API_URL' &&
                declaration.init &&
                declaration.init.type === 'LogicalExpression' &&
                declaration.init.operator === '||' &&
                declaration.init.left.type === 'MemberExpression'
            ) {
                const memberExpr = declaration.init.left;

                // Check if it's accessing process.env.NEXT_PUBLIC_BACKEND_URL
                if (
                    memberExpr.object?.object?.name === 'process' &&
                    memberExpr.object?.property?.name === 'env' &&
                    (memberExpr.property?.name === 'NEXT_PUBLIC_BACKEND_URL' ||
                        memberExpr.property?.name === 'NEXT_PUBLIC_SUPABASE_URL')
                ) {
                    // Replace with getApiUrl() call
                    declaration.init = j.callExpression(
                        j.identifier('getApiUrl'),
                        []
                    );
                    hasChanges = true;
                }
            }
        });
    });

    // If we made changes, add the import
    if (hasChanges) {
        // Check if import already exists
        const existingImport = root.find(j.ImportDeclaration, {
            source: { value: '@/lib/get-api-url' }
        });

        if (existingImport.length === 0) {
            // Add import at the top
            const importStatement = j.importDeclaration(
                [j.importSpecifier(j.identifier('getApiUrl'))],
                j.literal('@/lib/get-api-url')
            );

            // Find the first import or the start of the file
            const firstImport = root.find(j.ImportDeclaration).at(0);
            if (firstImport.length > 0) {
                firstImport.insertBefore(importStatement);
            } else {
                // No imports exist, add at the top
                root.get().node.program.body.unshift(importStatement);
            }
        }
    }

    return hasChanges ? root.toSource() : null;
};
