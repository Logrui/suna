/**
 * jscodeshift codemod to replace hardcoded API URLs and add imports
 * File: patches/002-api-url-with-import.js
 * 
 * This codemod:
 * 1. Finds: const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';
 * 2. Adds import: import { getApiUrl } from '@/lib/get-api-url';
 * 3. Replaces with: const API_URL = getApiUrl();
 * 
 * Usage:
 *   jscodeshift -t patches/002-api-url-with-import.js frontend/src/
 */

module.exports = function transformer(fileInfo, api) {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);
    let hasChanges = false;

    // Find all variable declarations matching the pattern
    root.find(j.VariableDeclaration).forEach(path => {
        path.value.declarations.forEach(declaration => {
            // Check if it's a pattern we want to replace
            if (
                declaration.id.type === 'Identifier' &&
                (declaration.id.name === 'API_URL' ||
                    declaration.id.name === 'BACKEND_URL' ||
                    declaration.id.name === 'SUPABASE_URL') &&
                declaration.init &&
                declaration.init.type === 'LogicalExpression' &&
                declaration.init.operator === '||'
            ) {
                const memberExpr = declaration.init.left;

                // Check if it's accessing process.env.NEXT_PUBLIC_*
                if (
                    memberExpr.type === 'MemberExpression' &&
                    memberExpr.object?.type === 'MemberExpression' &&
                    memberExpr.object.object?.name === 'process' &&
                    memberExpr.object.property?.name === 'env' &&
                    memberExpr.property?.name?.startsWith('NEXT_PUBLIC_')
                ) {
                    // Replace with getApiUrl() call
                    declaration.init = j.callExpression(
                        j.identifier('getApiUrl'),
                        []
                    );

                    hasChanges = true;

                    console.log(`✓ Transformed ${declaration.id.name} in ${fileInfo.path}`);
                }
            }
        });
    });

    // If we made changes, ensure the import exists
    if (hasChanges) {
        // Check if import already exists
        const existingImport = root.find(j.ImportDeclaration, {
            source: { value: '@/lib/get-api-url' }
        });

        if (existingImport.length === 0) {
            // Create the import statement
            const importStatement = j.importDeclaration(
                [j.importSpecifier(j.identifier('getApiUrl'))],
                j.literal('@/lib/get-api-url')
            );

            // Find the first import or the start of the file
            const firstImport = root.find(j.ImportDeclaration).at(0);

            if (firstImport.length > 0) {
                // Insert before first import
                firstImport.insertBefore(importStatement);
            } else {
                // No imports exist, add at the top (after 'use client' if exists)
                const body = root.get().node.program.body;

                // Check for 'use client' directive
                let insertIndex = 0;
                if (
                    body[0]?.type === 'ExpressionStatement' &&
                    body[0]?.expression?.type === 'Literal' &&
                    body[0]?.expression?.value === 'use client'
                ) {
                    insertIndex = 1; // Insert after 'use client'
                }

                body.splice(insertIndex, 0, importStatement);
            }

            console.log(`✓ Added import in ${fileInfo.path}`);
        }
    }

    return hasChanges ? root.toSource() : null;
};
