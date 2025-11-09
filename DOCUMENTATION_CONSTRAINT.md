# Documentation Constraint Enforcement - Quick Reference

## The Rule (Hard Limit)

```
MAXIMUM 3 MARKDOWN FILES PER REQUEST
```

This is non-negotiable across all IDEs, tools, and AI agents.

---

## System Architecture

### Four-Tier Enforcement

| Tier | Location | Scope | Status |
|------|----------|-------|--------|
| **1** | `.github/copilot-instructions.md` | Repository-wide | ✅ Active |
| **2** | `.github/instructions/documentation.instructions.md` | Markdown files only | ✅ Active |
| **3** | `CLAUDE.md` | AI agents/Claude Code | ✅ Active |
| **4** | `~/.config/github-copilot/intellij/global-copilot-instructions.md` | JetBrains global | ✅ Active |

### Why Four Tiers?

- **Redundancy** - Multiple layers ensure constraint isn't bypassed
- **IDE Coverage** - Different tools respect different files
- **Agent Recognition** - AI agents prioritize CLAUDE.md format
- **User-Level** - Global rules for all JetBrains projects

---

## Coverage by IDE

```
GitHub.com                   ✅ Tier 1, 2
VS Code                      ✅ Tier 1, 2
JetBrains IDE                ✅ Tier 1, 2, 4
Visual Studio                ✅ Tier 1
Xcode                        ✅ Tier 1
Claude Code (claude.ai/code) ✅ Tier 3
OpenAI Agents                ✅ Tier 3
GitHub Copilot CLI           ✅ Tier 1
```

---

## When Creating Documentation

### ✅ DO

- Create a maximum of **3 `.md` files** per request
- **Consolidate** when approaching the limit
- Use **clear, descriptive filenames**
- Ensure each file has **one distinct purpose**
- **Check existing file count** before creating new ones
- **Notify the user** of consolidation strategy

### ❌ DON'T

- Create 4 or more markdown files
- Duplicate information across files
- Use vague filenames (`doc1.md`, `info.md`)
- Create files without verifying total count
- Mix unrelated topics in a single file
- Ignore the hard limit

---

## File Organization Pattern

### Example: Good 3-File Structure

```
QUICK_REFERENCE.md          (2-5 min read)
├─ Problem summary
├─ Solution steps
├─ Verification checklist
└─ Common quick fixes

COMPLETE_GUIDE.md           (15-30 min read)
├─ Root cause analysis
├─ Detailed implementation
├─ Architecture explanation
└─ Best practices

TROUBLESHOOTING.md          (Reference)
├─ Common issues #1-7
├─ Debug checklist
├─ Advanced scenarios
└─ Quick command reference
```

### Example: Poor 8+ File Structure (AVOID)

```
❌ README.md
❌ GETTING_STARTED.md
❌ INSTALLATION.md
❌ CONFIGURATION.md
❌ USAGE.md
❌ TROUBLESHOOTING.md
❌ ADVANCED.md
❌ FAQ.md
❌ API_REFERENCE.md

[Too many files, overlapping content, hard to maintain]
```

---

## Consolidation Checklist

When at 3 files and need to add more content:

- [ ] Identify overlapping topics between existing files
- [ ] Check if new content fits into existing files via new section
- [ ] If truly distinct, which file can be split or reorganized?
- [ ] Can existing files be restructured to accommodate new content?
- [ ] Is this addition critical, or can it be linked elsewhere?
- [ ] Verify new total will be ≤ 3 files

---

## Quick Commands

### Check how many .md files you're creating
```bash
# Count markdown files in current plan
ls -la *.md 2>/dev/null | wc -l

# Count markdown files in docs
ls -la docs/*.md 2>/dev/null | wc -l
```

### Verify constraint files exist
```bash
# Repository constraints
cat .github/copilot-instructions.md

# Path-specific constraints
cat .github/instructions/documentation.instructions.md

# Agent constraints
cat CLAUDE.md | head -20

# Global constraints (JetBrains)
cat ~/.config/github-copilot/intellij/global-copilot-instructions.md
```

---

## Troubleshooting

### "The constraint isn't being enforced"

Check:
1. Is Copilot reading the reference files? (Check References in Chat)
2. Are you using the right IDE? (Some tiers IDE-specific)
3. Is the file in the right location?
4. Have you reloaded the workspace?

**For VS Code:** Ctrl+Shift+P → "Developer: Reload Window"
**For JetBrains:** Settings → Tools → GitHub Copilot → Restart

### "Different behavior in different IDEs"

This is expected - different IDEs prioritize different constraint files:
- **VS Code**: Loads Tier 1 + 2
- **JetBrains**: Loads Tier 1 + 2 + 4
- **Claude Code**: Loads Tier 3
- **GitHub.com**: Loads Tier 1 + 2

All tiers enforce the same rule: **Maximum 3 files**.

---

## Philosophy

> **Quality and clarity over quantity.**
> 
> 3 well-organized files with clear sections and examples beat 8 scattered files with overlapping information.
>
> When in doubt: consolidate.

---

## References

- `.github/copilot-instructions.md` - Full repository guidelines
- `.github/instructions/documentation.instructions.md` - Markdown writing rules
- `CLAUDE.md` - AI agent guidance
- [GitHub Copilot Custom Instructions Docs](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot)
- [OpenAI agents.md Standard](https://github.com/openai/agents.md)
