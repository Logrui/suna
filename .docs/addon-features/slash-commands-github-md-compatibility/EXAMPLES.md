# GitHub-Compatible Slash Commands - Practical Examples

**Date**: November 12, 2025

---

## Real-World Command Examples

This guide shows how to create and use both standard and GitHub-format slash commands.

---

## Standard Commands (Direct Prompt Injection)

### Example 1: Content Summarizer

**File**: `summarize.md`

**Content**:
```
Summarize the following content in exactly 5 bullet points.
Focus on:
- Key takeaways
- Important numbers or dates
- Main conclusions
- Action items (if any)
- Broader implications

Be concise, each bullet point should be 1-2 sentences max.
```

**Usage**:
```
User input:  /summarize Here's a 10-page document about AI trends...
Agent sees: [Full prompt above]
            Here's a 10-page document about AI trends...
```

**Result**: Agent receives full prompt + user content

---

### Example 2: Simple Explanation

**File**: `explain-simple.md`

**Content**:
```
Explain the following in simple terms that a 10-year-old could understand.

Guidelines:
- Avoid technical jargon
- Use real-world analogies
- Break into simple steps
- Use examples from everyday life
- Keep sentences short and clear
```

**Usage**:
```
User input:  /explain-simple What is machine learning?
Agent sees: [Full prompt above]
           What is machine learning?
```

---

### Example 3: Email Drafter

**File**: `draft-email.md`

**Content**:
```
Draft a professional email for this scenario.

Requirements:
- Keep it to 2-3 paragraphs
- Use a formal but friendly tone
- Include a clear subject line
- Include a specific call-to-action
- Sign off professionally

Format your response as:
Subject: [subject line]

[email body]

Best regards,
[Signature]
```

**Usage**:
```
User input:  /draft-email Request a meeting with the design team
Agent sees: [Full prompt above]
           Request a meeting with the design team
```

---

## GitHub-Compatible Commands (Instruction Reference)

### Example 1: Feature Development

**File**: `feature.prompt.md`

**Content** (optional - can be blank or contain notes):
```
Guidelines for feature implementation:
- Follow component structure
- Add TypeScript types
- Include error handling
- Add unit tests
- Update documentation
```

**Usage**:
```
User input:  /feature Add dark mode toggle to settings
Agent sees: Follow instructions in feature.prompt.md

            Add dark mode toggle to settings
```

**Why GitHub-format?**
- Agent reference the external prompt from your GitHub repo
- `feature.prompt.md` likely exists in your project already
- User expects the agent to follow those guidelines
- Keeps Suna commands in sync with repo instructions

---

### Example 2: Bug Fixing

**File**: `bugfix.prompt.md`

**Content** (can reference your bug fix template):
```
Follow these steps for bug fixes:
1. Identify root cause
2. Add a regression test
3. Fix the issue
4. Verify the test passes
5. Check for side effects
6. Document the fix

Use this format in commit messages:
fix: [description] (fixes #[issue-number])
```

**Usage**:
```
User input:  /bugfix The login button timeout is too short
Agent sees: Follow instructions in bugfix.prompt.md

            The login button timeout is too short
```

---

### Example 3: Documentation

**File**: `docs.prompt.md`

**Content** (references your doc standards):
```
Documentation standards for this project:
- Use clear section headers
- Include code examples
- Add troubleshooting section
- Update table of contents
- Check for broken links
```

**Usage**:
```
User input:  /docs Write API endpoint documentation
Agent sees: Follow instructions in docs.prompt.md

            Write API endpoint documentation
```

---

### Example 4: Code Review

**File**: `review.prompt.md`

**Content**:
```
Code review checklist:
- [ ] Type safety (TypeScript)
- [ ] Performance implications
- [ ] Security considerations
- [ ] Error handling
- [ ] Test coverage
- [ ] Documentation
- [ ] Breaking changes
```

**Usage**:
```
User input:  /review Check this component implementation
Agent sees: Follow instructions in review.prompt.md

            Check this component implementation
```

---

### Example 5: Testing

**File**: `test.prompt.md`

**Content**:
```
Testing requirements:
- Unit tests for all functions
- Integration tests for workflows
- Edge cases covered
- Error scenarios tested
- Achieve 80%+ coverage
```

**Usage**:
```
User input:  /test Write tests for the auth service
Agent sees: Follow instructions in test.prompt.md

            Write tests for the auth service
```

---

## Mixed Usage Pattern

### Set Up Both Types

```
Knowledge Base/Suna/ folder:

Standard Commands (prompt templates):
├── summarize.md           (Full prompt)
├── explain-simple.md      (Full prompt)
└── draft-email.md         (Full prompt)

GitHub Commands (external references):
├── feature.prompt.md      (Reference to repo)
├── bugfix.prompt.md       (Reference to repo)
├── docs.prompt.md         (Reference to repo)
├── review.prompt.md       (Reference to repo)
└── test.prompt.md         (Reference to repo)
```

### Usage Pattern

```
User: "I need to summarize this contract"
→ Types: /summarize [content]
→ Agent receives: Full summarization prompt + content
→ Good for: Generic, reusable prompts

User: "I'm implementing a new feature"
→ Types: /feature Build user preferences panel
→ Agent receives: Reference to feature.prompt.md + request
→ Good for: Following project-specific guidelines
```

---

## Command Creation Workflow

### For Standard Commands

1. **Write a good prompt** for a general task
2. **Test it manually** in chat
3. **Refine based on results**
4. **Save as** `[name].md` in Suna folder
5. **Update summary** with concise description

### For GitHub-Format Commands

1. **Check your GitHub repo** for existing prompt files
2. **Match the naming**: If repo has `feature.prompt.md`, create same in Suna
3. **Content can be blank** (optional - for reference only)
4. **Use filename**: `[name].prompt.md` in Suna folder
5. **Update summary** with description

---

## Tips & Best Practices

### Standard Commands (`.md`)

✅ **Best for**:
- Reusable, general-purpose prompts
- Universal tasks (summarize, explain, draft)
- Prompts you want injected directly

❌ **Avoid**:
- Project-specific instructions (use GitHub-format instead)
- Large amounts of content

### GitHub-Format Commands (`.prompt.md`)

✅ **Best for**:
- Referencing external instructions
- Keeping in sync with your GitHub repo
- Project-specific workflows
- Reducing duplication

❌ **Avoid**:
- Generic tasks (use standard instead)
- When you want content injected directly

### Naming Conventions

```
✓ Good names:
- feature.prompt.md        (clear, kebab-case)
- bugfix.prompt.md         (single word)
- code-review.prompt.md    (descriptive)
- api-doc.prompt.md        (abbreviations OK)

✗ Avoid:
- FEATURE.PROMPT.MD        (uppercase - confusing)
- feature_prompt.md        (underscore not kebab-case)
- my-awesome-feature.prompt.md  (too long)
- .prompt.md               (missing command name)
```

---

## FAQ

### Q: Can I have both `feature.md` and `feature.prompt.md`?
**A**: Technically yes, but not recommended. They're different commands to the agent. Pick one format per command name.

### Q: Does the content of `.prompt.md` files matter?
**A**: No - it's ignored by the system. You could leave it blank. But we recommend adding a comment explaining why it's GitHub-format:
```
# GitHub-format command reference
# Agent will be told: "Follow instructions in feature.prompt.md"
# See: https://github.com/yourrepo/blob/main/feature.prompt.md
```

### Q: How do I sync these with my GitHub repo?
**A**: 
1. Create matching `.prompt.md` files in your repo
2. Create corresponding commands in Suna folder
3. Same filename = same instructions
4. When you update GitHub version, users get reference to it

### Q: Can I update a command?
**A**: Yes - edit the file in Knowledge Base:
1. Upload new version to Suna folder
2. React Query cache refreshes in 5 minutes
3. Or refresh browser to clear cache immediately

### Q: What if I want to embed the content in standard format?
**A**: Rename file to remove `.prompt` part:
- `feature.prompt.md` → `feature.md`
- Now the full content will be injected

### Q: Does command order matter?
**A**: No - displayed alphabetically in autocomplete. Names matter for filtering.

---

## Example Workflow

### Scenario: New Development Feature

**Step 1: Create in GitHub (optional)**
```bash
# In your repo
echo "Development guidelines..." > feature.prompt.md
git add feature.prompt.md
git commit -m "Add feature development guidelines"
```

**Step 2: Create in Suna folder**
- Upload `feature.prompt.md` to Knowledge Base/Suna/
- Set summary: "Implement a new feature"

**Step 3: Use in Chat**
```
/feature Add OAuth authentication

User sees: /feature (with GITHUB badge)
Agent receives: Follow instructions in feature.prompt.md
               
               Add OAuth authentication
```

**Step 4: Update Later**
```bash
# Update in GitHub
echo "Updated guidelines..." > feature.prompt.md

# Update in Suna folder (same name)
# Agent now references updated version
```

---

## Conclusion

- **Standard `.md` commands**: Great for reusable prompts
- **GitHub-format `.prompt.md` commands**: Great for project-specific references
- **Mix both types**: Use what's best for each workflow
- **Easy to create**: Just upload a file to Suna folder
- **Visual distinction**: GITHUB badge shows which is which

Start with a few examples and expand as you find useful patterns!
