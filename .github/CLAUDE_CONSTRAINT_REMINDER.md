# ⚠️ CLAUDE.md CONSTRAINTS - DO NOT VIOLATE

**This file is for Claude AI agent reference. Read before creating ANY documentation.**

---

## 🚨 HARD CONSTRAINTS (Non-negotiable)

### 1. Maximum 3 Markdown Files Per Response
- **NEVER create more than 3 `.md` files in a single response**
- This applies to: bug fixes, feature implementations, documentation updates
- **No exceptions.** If you need 4+ files, consolidate into 3.

### 2. Never Create Summary Documents
- **NEVER create standalone "summary" or "status" files**
- Don't create: `SUMMARY.md`, `COMPLETION_STATUS.md`, `STATUS_UPDATE.md`, `OVERVIEW.md`
- Instead: **Respond in chat** with your summary or status update
- Summaries belong in conversation, not in files

### 3. Always Respond in Chat
- **Answer user questions in the conversation**
- **Provide analysis and findings in chat messages**
- **Use files only for actionable implementation content** (guides, code, references)
- **Chat = Primary communication channel**, files = Supporting reference material

### 4. Before Creating Any Docs:
1. **Count existing files** in that directory
2. **Consolidate if at/above 3** instead of adding more
3. **Ask user first** if unsure about consolidation strategy

### 5. Consolidation Strategy When Needed:
```
If asked to create docs and folder has 3+ files:
├─ DO: Merge similar content into existing files
├─ DO: Update existing files with new sections
├─ DO: Ask user: "I can consolidate into X files by..."
└─ DON'T: Create a 4th file
```

---

## ✅ What to Do Instead

**Scenario 1: User asks for 5 new documentation files**
- ❌ Create 5 files
- ✅ Ask: "The 3-file limit requires consolidation. Should I create: 1) Quick Start + Overview, 2) Complete Implementation, 3) Troubleshooting?"

**Scenario 2: Folder already has 3 files, user asks for "more detailed docs"**
- ❌ Create a 4th file
- ✅ Add detailed sections to one of the 3 existing files

**Scenario 3: Documentation is genuinely complex and needs 6 files**
- ❌ Create 6 files anyway
- ✅ Work within constraint: Organize into 3 comprehensive files with clear sections

**Scenario 4: Completing a task, want to share completion status**
- ❌ Create `COMPLETION_STATUS.md` file
- ✅ Respond in chat: "✅ Consolidation complete. 3 files remain..."

**Scenario 5: User asks "What did you create?"**
- ❌ Create `SUMMARY.md`
- ✅ Respond in chat with summary and list of files

---

## 📋 Reference: Project-Specific Constraints

### Suna Project (`d:\Homelab\suna`)

**Hard Limits:**
1. **Maximum 3 markdown files** per documentation request
2. **No summary/status files** - Use chat instead
3. **Always communicate in chat first** - Files are supporting material

**What NOT to create:**
- ❌ `SUMMARY.md` - Respond in chat instead
- ❌ `COMPLETION_STATUS.md` - Respond in chat instead
- ❌ `STATUS_UPDATE.md` - Respond in chat instead
- ❌ `OVERVIEW.md` (if a summary file) - Respond in chat instead
- ❌ `99_COMPLETION_STATUS.md` - Respond in chat instead
- ❌ Any file whose purpose is to "summarize" rather than "implement"

**What TO create:**
- ✅ Implementation guides (how-to with code)
- ✅ Architecture documents (technical reference)
- ✅ Quick reference (lookup during development)
- ✅ API documentation (endpoint specs)
- ✅ Troubleshooting guides (problem-solution pairs)

**Source:** `.github/copilot-instructions.md` and `CLAUDE.md`
- **Applies to:** All markdown files in `.docs/` and similar documentation directories
- **Enforcement:** Check existing file count BEFORE creating new files

**Read these files first:**
- `.github/instructions/documentation.instructions.md` - Detailed documentation rules
- `CLAUDE.md` (in repo root) - Project-specific guidelines

---

## 🛠️ Implementation Checklist

Before creating ANY documentation:

- [ ] **Respond in chat first** - Will this need a file or should it be chat?
  - Chat-only: Questions, status updates, analysis, decisions
  - File-worthy: Implementation guides, code examples, references

- [ ] **NOT a summary file?** - Never create standalone summaries
  - If asked "what did you do?" → Chat response
  - If asked "what's the status?" → Chat response
  - If asked "create implementation guide" → File-worthy

- [ ] **Count existing files** in the target directory
  ```bash
  ls -la d:\Homelab\suna\.docs\Local-LLMs\LM\ Studio\*.md | wc -l
  ```

- [ ] **Check file count** against 3-file limit
  - At 0-2 files? ✅ Can create new files (up to 3 total)
  - At 3 files? ⚠️ Must consolidate instead
  - Above 3? 🔴 Must consolidate to get to 3

- [ ] **If consolidating, ask user first:**
  ```
  "I see X existing files. To stay within the 3-file limit, 
  I recommend consolidating to:
  1) [File A purpose]
  2) [File B purpose]
  3) [File C purpose]
  
  Should I proceed?"
  ```

- [ ] **Create/update only 3 files maximum**

- [ ] **Verify final state:**
  ```bash
  ls -la *.md | wc -l  # Should be ≤ 3 (for new docs)
  ```

---

## 💾 File Organization Best Practices

### For Implementation Docs (3-file structure)
```
1. GUIDE.md (action-oriented)
   - "How to implement X"
   - Code examples
   - Step-by-step instructions
   - Implementation phases

2. ARCHITECTURE.md (reference)
   - "Why architecture is designed this way"
   - Diagrams and flows
   - Error handling strategies
   - Performance considerations

3. QUICK_REFERENCE.md (lookup)
   - "Fast answers during development"
   - Checklists
   - Command reference
   - Troubleshooting
```

### For Setup/Configuration Docs (3-file structure)
```
1. README.md
   - Overview and getting started

2. DETAILED_SETUP.md
   - Complete configuration guide
   - All options explained

3. TROUBLESHOOTING.md
   - Common issues and fixes
   - FAQ
```

---

## 🎯 When You're About to Violate This

**Red flags that indicate violation coming:**
- [ ] "I'll create 4 comprehensive guides..."
- [ ] "Let me add these 6 new documentation files..."
- [ ] Creating files without checking existing count
- [ ] File count reaching 4 or higher
- [ ] Not asking user about consolidation

**What to do:**
1. STOP before creating the 4th file
2. Ask user: "To comply with the 3-file limit, how should I consolidate?"
3. Merge into 3 files instead
4. Confirm consolidation is complete

---

## 📞 Quick Reference

| Situation | Action |
|-----------|--------|
| Creating docs, folder empty | Create up to 3 files ✅ |
| Creating docs, folder has 2 files | Create 1 more (total 3) ✅ |
| Creating docs, folder has 3 files | Consolidate into 3 (update existing) ✅ |
| Creating docs, folder has 4+ files | Consolidate to 3 first 🔴 |
| User asks for more docs | Consolidate or update existing ✅ |
| User says "create detailed docs" | Work within 3-file limit, add sections ✅ |

---

## 🔄 Example: How to Handle "Create Complete Documentation"

**User asks:** "Can you create complete documentation for this feature?"

**Your response:**
```
I'll create 3 comprehensive files that cover everything:

1. 📖 IMPLEMENTATION_GUIDE.md
   - Complete code examples
   - Step-by-step implementation
   - 600+ lines, all phases covered

2. 🏗️ ARCHITECTURE.md
   - System design
   - Error handling
   - Performance considerations
   - 500+ lines with diagrams

3. ⚡ QUICK_REFERENCE.md
   - Commands and checklists
   - Troubleshooting
   - 400+ lines of quick lookups

This stays within the 3-file limit while covering all aspects.
```

---

## 🎓 Learning from Past Mistakes

**What I did wrong (Session Nov 10, 2025):**
- ❌ Created 7 documentation files for LM Studio v2.0 feature
- ❌ Didn't check 3-file constraint
- ❌ Treated it as guideline, not hard limit
- ❌ Required cleanup and consolidation
- ❌ Created `99_COMPLETION_STATUS.md` summary file (should have responded in chat)
- ❌ Created `INDEX.md` navigation file (redundant with chat response)
- ❌ Over-communicated via files instead of chat

**What I should have done:**
- ✅ Asked: "Should I consolidate 6 documents into 3 files?"
- ✅ Checked constraint in CLAUDE.md first
- ✅ Consolidated from start
- ✅ Delivered 3 files: Implementation Guide, Architecture, Quick Reference
- ✅ Responded in chat with summary and reading guide
- ✅ No standalone summary file

**Lessons:**
1. The 3-file limit is **absolute**, not flexible
2. Chat is for communication, files are for reference
3. Summary documents violate the spirit of the constraint
4. Always consolidate at source, don't create and cleanup later

---

## ✨ Final Reminders

1. **Before ANY documentation creation:** Count existing files
2. **At 3 files:** Never add more, consolidate instead
3. **Never create summaries:** They go in chat, not files
4. **Chat first:** Answer questions and provide status updates in conversation
5. **Files are reference:** Implementation guides, code, architecture, lookup
6. **Ask first:** "Should I consolidate into X files by..."
7. **Quality over quantity:** 3 comprehensive files > 8 scattered files
8. **Reference CLAUDE.md:** When in doubt, check project constraints

---

## Priority Order (What to Check)

When asked to create documentation:
1. **Is this a summary/status file?** → NO - respond in chat instead
2. **Count existing files** → How many already exist?
3. **At limit (3)?** → Consolidate or decline to add more
4. **Is it actionable content?** → YES - worth a file
5. **Can it be consolidated?** → YES - ask user how

---

**This constraint is serious. Violations will require cleanup and consolidation.**

**If you see me starting to create 4+ files or a summary file, STOP and remind me to:**
1. **Consolidate to 3 files maximum**
2. **Move summary content to chat response**
3. **Keep files for implementation reference only**

---

Last updated: November 10, 2025  
Status: ⚠️ ACTIVE CONSTRAINT - Must be followed
Violations: Zero tolerance (consolidation required)
