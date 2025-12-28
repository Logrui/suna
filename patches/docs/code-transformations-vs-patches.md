# Systematic Code Transformations vs Traditional Patches

## The Problem

When maintaining a fork of an actively developed upstream repository (like Suna Kortix), you often need to apply systematic changes across the codebase:

**Example: Replacing hardcoded API URLs**
- **Old pattern:** `const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';`
- **New pattern:** 
  ```typescript
  import { getApiUrl } from '@/lib/get-api-url';
  const API_URL = getApiUrl();
  ```

**Challenge:**
- Upstream constantly adds new files with the old pattern
- Upstream modifies existing files, breaking line-based patches
- You need to apply the transformation to **all files recursively**
- Traditional `.patch` files **cannot handle this**

---

## Why Traditional Patches Fail

### Problem 1: Line-Based, Not Semantic

```diff
# Traditional patch - breaks if ANYTHING changes nearby
--- a/hooks/use-agents.ts
+++ b/hooks/use-agents.ts
@@ -5,7 +5,8 @@
 import { useQuery } from '@tanstack/react-query';
 
-const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';
+import { getApiUrl } from '@/lib/get-api-url';
+const API_URL = getApiUrl();
```

**Breaks when:**
- ❌ Upstream adds/removes an import (line numbers shift)
- ❌ Upstream modifies a nearby comment
- ❌ Upstream reformats the code
- ❌ Upstream adds a new file with the same pattern (patch doesn't apply there)

### Problem 2: Maintenance Nightmare

For Suna's frontend with ~100+ files:
- Need **one patch per file** = 100+ patches
- Each upstream merge = manually check 100+ patches
- Each new upstream file = create new patch manually
- **Result:** Constant manual work

---

## ✅ Better Solutions: Code Transformation Tools

### Option 1: jscodeshift (Industry Standard)

**What it is:** Facebook's codemod tool using AST (Abstract Syntax Tree) transformations

**Advantages:**
- ✅ Semantic understanding of code structure
- ✅ Resilient to whitespace/formatting changes
- ✅ Processes entire directories recursively
- ✅ Used by React, Next.js, and major frameworks for migrations

**Setup:**

```bash
# Install
npm install -D jscodeshift @types/jscodeshift

# Run on entire frontend
npx jscodeshift -t scripts/codemods/replace-api-url.js frontend/src/

# Dry run first
npx jscodeshift -t scripts/codemods/replace-api-url.js frontend/src/ --dry --print
```

**Example Codemod:** See `.docs/examples/replace-api-url-codemod.js`

**Workflow:**
1. Pull upstream changes
2. Run codemod: `npm run codemod:api-url`
3. Verify changes: `git diff`
4. Commit and deploy

**Pros:**
- Most powerful and flexible
- Can handle complex transformations
- Well-documented, large community

**Cons:**
- Requires learning AST manipulation
- More complex to write

---

### Option 2: ast-grep (Modern, Simpler)

**What it is:** Pattern-based code search and transformation using tree-sitter

**Advantages:**
- ✅ Simpler YAML configuration (no code)
- ✅ Pattern matching with wildcards
- ✅ Built-in rules engine
- ✅ Fast, written in Rust

**Setup:**

```bash
# Install
npm install -D @ast-grep/cli

# Or use directly
npx @ast-grep/cli scan
```

**Example Config:** See `.docs/examples/.ast-grep-rules.yml`

**Usage:**

```bash
# Check what would change
ast-grep scan --rule .ast-grep-rules.yml

# Apply all changes
ast-grep scan --rule .ast-grep-rules.yml --update-all

# Interactive mode
ast-grep scan --rule .ast-grep-rules.yml --interactive
```

**Pros:**
- Easier to learn than jscodeshift
- YAML configuration
- Great for pattern-based replacements

**Cons:**
- Less flexibility than jscodeshift for complex logic
- Newer tool, smaller community

---

### Option 3: comby (Language-Agnostic)

**What it is:** Pattern-based rewriting for any language

**Advantages:**
- ✅ Works on any programming language
- ✅ Simple syntax
- ✅ Great for find-and-replace with structure

**Setup:**

```bash
# Install via cargo
cargo install comby

# Or use Docker
docker pull comby/comby
```

**Usage:**

```bash
# Pattern replacement
comby \
  'const :[var] = process.env.:[env] || :[default]' \
  'const :[var] = getApiUrl()' \
  -d frontend/src \
  -f .ts,.tsx \
  -in-place
```

**Pros:**
- Simplest syntax
- Language-agnostic
- Quick for simple patterns

**Cons:**
- Can't handle complex transformations (like adding imports)
- Less precise than AST-based tools

---

### Option 4: ESLint Auto-Fix Rules (Preventive)

**What it is:** Create custom ESLint rules that auto-fix the pattern

**Advantages:**
- ✅ Runs automatically on save / during linting
- ✅ Prevents new violations from being added
- ✅ Integrates with existing tooling

**Setup:**

Create `.eslintrc.js` rule:

```javascript
module.exports = {
  rules: {
    'no-hardcoded-api-url': {
      create(context) {
        return {
          VariableDeclarator(node) {
            if (
              node.id.name === 'API_URL' &&
              node.init?.type === 'LogicalExpression' &&
              node.init.left?.property?.name?.startsWith('NEXT_PUBLIC')
            ) {
              context.report({
                node,
                message: 'Use getApiUrl() instead of hardcoded env variable',
                fix(fixer) {
                  return fixer.replaceText(node.init, 'getApiUrl()');
                }
              });
            }
          }
        };
      }
    }
  }
};
```

Then run:
```bash
eslint --fix frontend/src/
```

**Pros:**
- Continuous enforcement
- Prevents regressions
- Familiar tooling

**Cons:**
- Requires writing ESLint plugin
- Only fixes violations during lint

---

## 🎯 Recommended Workflow for Suna

### Immediate: Use ast-grep

**Best for your use case** because:
1. Simple pattern matching
2. No complex logic needed
3. Fast, one-time transformations after upstream merges

**Setup Steps:**

1. **Create ast-grep config** in Suna repo:
   ```bash
   cd d:/Homelab/suna
   mkdir -p .ast-grep
   ```

2. **Copy example config:**
   ```bash
   cp d:/Homelab/n8n/.docs/examples/.ast-grep-rules.yml .ast-grep/rules.yml
   ```

3. **Add npm script** to `package.json`:
   ```json
   {
     "scripts": {
       "codemod:api-url": "ast-grep scan --rule .ast-grep/rules.yml --update-all"
     }
   }
   ```

4. **Add to merge workflow:**
   ```bash
   # After pulling upstream
   git pull upstream main
   npm run codemod:api-url
   git add -u
   git commit -m "chore: apply getApiUrl() transformation"
   ```

### Long-term: Add ESLint Rule

**Prevents future violations:**

1. Create custom rule in `.eslintrc.js`
2. Run on pre-commit hook
3. Catches new violations before they're committed

---

## Comparison Table

| Tool | Complexity | Power | Use Case |
|------|-----------|-------|----------|
| **Traditional Patches** | Low | Low | ❌ Single file, stable upstream |
| **ast-grep** | Low | Medium | ✅ **Pattern replacements** |
| **jscodeshift** | High | High | Complex migrations |
| **comby** | Low | Low | Simple find-replace |
| **ESLint Rules** | Medium | Medium | ✅ **Continuous enforcement** |

---

## Example Integration Script

Create `scripts/apply-patches.sh`:

```bash
#!/bin/bash
# Apply systematic transformations after upstream merge

set -e

echo "🔄 Applying code transformations..."

# 1. Replace API URL patterns
echo "  → Replacing hardcoded API URLs..."
npx @ast-grep/cli scan --rule .ast-grep/api-url.yml --update-all

# 2. Fix any ESLint violations
echo "  → Running ESLint auto-fix..."
npm run lint:fix

# 3. Format code
echo "  → Formatting code..."
npm run format

# 4. Report changes
changed_files=$(git diff --name-only | wc -l)
echo "✅ Transformation complete: $changed_files files modified"

# 5. Show summary
git diff --stat
```

---

## Conclusion

For your Suna fork:

1. **❌ Don't use** traditional `.patch` files for systematic pattern replacements
2. **✅ Do use** ast-grep for immediate one-time transformations
3. **✅ Consider** adding ESLint rules for continuous enforcement
4. **✅ Automate** the transformation in your upstream merge workflow

This approach:
- Survives upstream changes
- Applies to new files automatically
- Requires minimal maintenance
- Runs in seconds, not hours
