# Slash Commands - UI/UX Design Guide

## Visual Design System

### Color Scheme (VS Code Light & Dark)

#### Dark Theme (Primary)
```css
/* VS Code Dark Colors */
--bg-primary: #1e1e1e      /* Editor background */
--bg-secondary: #252526    /* Sidebar background */
--bg-tertiary: #2d2d30     /* Input background */
--text-primary: #d4d4d4    /* Primary text */
--text-secondary: #858585   /* Secondary text */
--text-muted: #6a6a6a      /* Muted text */
--accent-primary: #007acc  /* Highlight/select */
--accent-hover: #094771    /* Hover state */
--border-color: #3e3e42    /* Borders */
--error-color: #f48771     /* Errors */
--success-color: #89d185   /* Success */
```

#### Light Theme
```css
--bg-primary: #ffffff
--bg-secondary: #f3f3f3
--bg-tertiary: #f0f0f0
--text-primary: #333333
--text-secondary: #666666
--text-muted: #999999
--accent-primary: #0078d4
--accent-hover: #005a9e
--border-color: #d0d0d0
--error-color: #d13438
--success-color: #107c10
```

### Typography

```css
/* Font Stack */
--font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
  'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;

/* Monospace (for command names) */
--font-mono: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;

/* Sizes */
--font-size-xs: 12px;
--font-size-sm: 13px;
--font-size-base: 14px;
--font-size-lg: 16px;
--font-size-xl: 18px;

/* Line Heights */
--line-height-tight: 1.4;
--line-height-normal: 1.6;
--line-height-relaxed: 1.8;
```

---

## Component Design Specs

### 1. Chat Input with Slash Command Support

#### Appearance

```
┌─────────────────────────────────────────┐
│ /summarize this article about AI        │
├─────────────────────────────────────────┤
│ Type / for commands                     │
└─────────────────────────────────────────┘
```

#### States

**Idle State**
- Single line input with placeholder
- Monospace font
- Subtle border

**Focus State**
- Border color changes to accent-primary
- Cursor visible
- Ready for input

**Command Detection State**
- Shows "/" character detected
- Hint text appears below: "Type / for commands"
- Autocomplete triggers

#### Styling

```css
.slash-command-input {
  font-family: var(--font-mono);
  font-size: var(--font-size-base);
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  transition: all 200ms;
}

.slash-command-input:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(0, 120, 212, 0.1);
}

.slash-command-input::placeholder {
  color: var(--text-muted);
}
```

---

### 2. Autocomplete Dropdown

#### Appearance

```
Chat Input
┌─────────────────────────────────────────────┐
│ /sum                                        │ ← User typing
└─────────────────────────────────────────────┘
  ▼ Autocomplete appears below
┌─────────────────────────────────────────────┐
│ 🔹 summarize                                │ ← Command icon
│    Summarize content into bullet points    │ ← Description
├─────────────────────────────────────────────┤
│ 🔹 summarize-detailed                       │
│    Create detailed summary report           │
├─────────────────────────────────────────────┤
│ 🔹 summarize-short                          │
│    Quick 2-3 sentence summary              │
└─────────────────────────────────────────────┘
```

#### Interaction

- **Keyboard Navigation**: Arrow Up/Down to select
- **Selection**: Highlighted with accent-primary background
- **Confirm**: Press Enter to select
- **Close**: Press Escape or click outside
- **Preview**: Hover over command to show full prompt (optional)

#### Dimensions

```css
.slash-command-autocomplete {
  position: absolute;
  bottom: 100%;
  left: 0;
  width: 100%;
  max-height: 320px;
  overflow-y: auto;
  
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-secondary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  
  margin-bottom: 8px;
  z-index: 1000;
}

.slash-command-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 150ms;
  
  border-bottom: 1px solid var(--border-color);
}

.slash-command-item:last-child {
  border-bottom: none;
}

.slash-command-item:hover,
.slash-command-item.selected {
  background-color: var(--accent-primary);
  color: white;
}

.slash-command-item-name {
  font-family: var(--font-mono);
  font-weight: 500;
  color: var(--text-primary);
}

.slash-command-item.selected .slash-command-item-name {
  color: white;
}

.slash-command-item-desc {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.slash-command-item.selected .slash-command-item-desc {
  color: rgba(255, 255, 255, 0.7);
}
```

#### Animation

```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slash-command-autocomplete {
  animation: slideUp 150ms ease-out;
}
```

---

### 3. Command Manager

#### Layout

```
┌────────────────────────────────────────────────┐
│ My Slash Commands                    [+ New]   │  ← Header
├────────────────────────────────────────────────┤
│                                                 │
│  📝 summarize                                   │  ← Command item
│     Summarize content into bullet points       │
│     Created: Nov 4, 2025         [✎] [🗑]      │  ← Actions
│                                                 │
├────────────────────────────────────────────────┤
│                                                 │
│  📝 draft-email                                 │
│     Draft professional emails                  │
│     Created: Nov 4, 2025         [✎] [🗑]      │
│                                                 │
├────────────────────────────────────────────────┤
│  No commands yet. Create one to get started →  │  ← Empty state
└────────────────────────────────────────────────┘
```

#### Styling

```css
.slash-command-manager {
  background-color: var(--bg-primary);
  border-radius: 8px;
  overflow: hidden;
}

.slash-command-manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.slash-command-manager-header h2 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.slash-command-item-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  transition: background-color 150ms;
}

.slash-command-item-container:hover {
  background-color: var(--bg-secondary);
}

.slash-command-item-container:last-child {
  border-bottom: none;
}

.slash-command-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.slash-command-item-name {
  font-family: var(--font-mono);
  font-size: var(--font-size-base);
  font-weight: 500;
  color: var(--text-primary);
}

.slash-command-item-description {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-top: 4px;
}

.slash-command-item-meta {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  margin-top: 4px;
}

.slash-command-actions {
  display: flex;
  gap: 8px;
}

.slash-command-action-btn {
  padding: 4px 8px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
  transition: color 150ms;
}

.slash-command-action-btn:hover {
  color: var(--accent-primary);
}

.slash-command-empty-state {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-secondary);
}

.slash-command-empty-state-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}
```

---

### 4. Command Creation Modal

#### Layout

```
┌─────────────────────────────────────────────────┐
│ Create New Slash Command              [×]       │  ← Header
├─────────────────────────────────────────────────┤
│                                                  │
│ Command Name                                    │
│ ┌──────────────────────────────────────────────┐│
│ │ /summarize                                   ││  ← Input
│ └──────────────────────────────────────────────┘│
│ • Alphanumeric, hyphens, and underscores only  │  ← Hint
│ • Max 32 characters                            │
│                                                  │
│ Prompt Template                                 │
│ ┌──────────────────────────────────────────────┐│
│ │ Summarize the following content in bullet   ││  ← Textarea
│ │ points:                                      ││
│ │ - Keep it concise (5-10 bullets max)        ││
│ │ - Highlight key takeaways                   ││
│ │ - Include any important numbers or dates    ││
│ │                                              ││
│ └──────────────────────────────────────────────┘│
│ Characters: 234 / 5000                          │  ← Counter
│                                                  │
│ Description (Optional)                          │
│ ┌──────────────────────────────────────────────┐│
│ │ Summarize content into bullet points        ││  ← Input
│ └──────────────────────────────────────────────┘│
│                                                  │
│ Preview                                         │
│ ┌──────────────────────────────────────────────┐│
│ │ [User's additional text will appear here]   ││  ← Live preview
│ │                                              ││
│ │ Summarize the following content in bullet   ││
│ │ points...                                   ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│                 [Cancel] [Save]                 │  ← Actions
└─────────────────────────────────────────────────┘
```

#### Styling

```css
.slash-command-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 2000;
}

.slash-command-modal-content {
  background-color: var(--bg-primary);
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
}

.slash-command-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
}

.slash-command-modal-header h2 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.slash-command-modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 150ms;
}

.slash-command-modal-close:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.slash-command-modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.slash-command-form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.slash-command-form-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.slash-command-form-input,
.slash-command-form-textarea {
  font-family: var(--font-mono);
  font-size: var(--font-size-base);
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  transition: border-color 150ms;
}

.slash-command-form-input:focus,
.slash-command-form-textarea:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(0, 120, 212, 0.1);
}

.slash-command-form-textarea {
  resize: vertical;
  min-height: 120px;
  font-family: var(--font-mono);
}

.slash-command-form-hint {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  margin-top: -4px;
  list-style: none;
  padding: 0;
  margin: 4px 0 0 0;
}

.slash-command-form-hint li {
  margin: 2px 0;
}

.slash-command-form-hint li::before {
  content: '• ';
  color: var(--accent-primary);
}

.slash-command-char-count {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  text-align: right;
  margin-top: -4px;
}

.slash-command-modal-preview {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 12px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.slash-command-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
}

.slash-command-modal-btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms;
  border: none;
}

.slash-command-modal-btn-cancel {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.slash-command-modal-btn-cancel:hover {
  background-color: var(--border-color);
}

.slash-command-modal-btn-save {
  background-color: var(--accent-primary);
  color: white;
}

.slash-command-modal-btn-save:hover {
  background-color: var(--accent-hover);
}

.slash-command-modal-btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

## Animation Specifications

### Entrance/Exit

```css
/* Autocomplete entrance */
@keyframes autocompleteSlideUp {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slash-command-autocomplete {
  animation: autocompleteSlideUp 150ms ease-out forwards;
}

/* Modal entrance */
@keyframes modalFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes modalScaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.slash-command-modal {
  animation: modalFadeIn 200ms ease-out forwards;
}

.slash-command-modal-content {
  animation: modalScaleIn 250ms ease-out forwards;
}
```

### Micro-interactions

```css
/* Button hover */
.slash-command-action-btn:hover {
  transform: scale(1.1);
}

/* List item hover */
.slash-command-item-container:hover {
  transform: translateX(4px);
}
```

---

## Accessibility

### ARIA Labels

```tsx
<input
  aria-label="Slash command name"
  aria-describedby="command-name-hint"
  placeholder="/summarize"
/>

<div id="command-name-hint" className="slash-command-form-hint">
  {/* Hints */}
</div>

<button
  aria-label="Delete command"
  aria-description="Delete the summarize command"
>
  🗑
</button>
```

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `/` | Open autocomplete |
| Arrow Up/Down | Navigate autocomplete items |
| Enter | Select current item or send message |
| Escape | Close autocomplete or modal |
| Tab | Navigate form fields |

### Focus Management

- Modal automatically focuses input on open
- Escape button easily accessible at top-right
- Focus trap within modal
- Focus returned to trigger button on close

---

## Example Commands for Users

### 1. Summarize

```markdown
## Name
summarize

## Prompt
Summarize the following content in 5-10 bullet points. 
Highlight key takeaways and include any important numbers or dates.

## Description
Quickly summarize articles, documents, or responses
```

### 2. Draft Email

```markdown
## Name
draft-email

## Prompt
Draft a professional email for the following scenario. 
Keep it to 2-3 paragraphs, use formal tone, and include a clear call-to-action.

## Description
Compose professional emails quickly
```

### 3. Brainstorm

```markdown
## Name
brainstorm

## Prompt
Generate 10 creative ideas for the following topic. 
Be diverse, think outside the box, and explain each idea briefly.

## Description
Generate creative ideas with brainstorming prompts
```

### 4. Explain Simply

```markdown
## Name
explain-simple

## Prompt
Explain the following in simple terms that a 10-year-old could understand. 
Avoid technical jargon and use real-world examples if possible.

## Description
Simplify complex concepts
```

### 5. Code Review

```markdown
## Name
code-review

## Prompt
Review the following code. Check for:
- Bugs or logic errors
- Performance issues
- Security vulnerabilities
- Suggest improvements and refactoring opportunities

## Description
Get professional code reviews
```

### 6. Create TODO List

```markdown
## Name
create-todo

## Prompt
Create a structured TODO list for the following task. 
Break it down into smaller, actionable steps with estimated effort levels (easy/medium/hard).

## Description
Break down tasks into manageable steps
```

### 7. Fact Check

```markdown
## Name
fact-check

## Prompt
Fact-check the following information. For each claim:
- Verify if it's accurate
- Note any nuances or context
- Identify potential biases
- Suggest reliable sources

## Description
Verify and fact-check information
```

### 8. Improve Writing

```markdown
## Name
improve-writing

## Prompt
Improve the following text by:
- Enhancing clarity and readability
- Checking grammar and spelling
- Improving tone and style
- Making it more concise if possible

Show both the original and improved version.

## Description
Polish and enhance written content
```

---

## Responsive Design

### Mobile Considerations

```css
/* Mobile adjustments */
@media (max-width: 768px) {
  .slash-command-modal-content {
    width: 95%;
    max-height: 85vh;
  }
  
  .slash-command-autocomplete {
    max-height: 240px;
  }
  
  .slash-command-manager-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
}

@media (max-width: 480px) {
  .slash-command-modal-body {
    gap: 12px;
  }
  
  .slash-command-form-textarea {
    min-height: 100px;
  }
}
```

---

## Dark Mode Support

```css
/* Automatic dark mode detection */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1e1e1e;
    --text-primary: #d4d4d4;
    /* etc. */
  }
}

@media (prefers-color-scheme: light) {
  :root {
    --bg-primary: #ffffff;
    --text-primary: #333333;
    /* etc. */
  }
}
```

---

## Error States

### Visual Indicators

```css
.slash-command-form-input.error {
  border-color: var(--error-color);
  background-color: rgba(244, 135, 113, 0.1);
}

.slash-command-form-input.error:focus {
  box-shadow: 0 0 0 3px rgba(244, 135, 113, 0.15);
}

.slash-command-error-message {
  color: var(--error-color);
  font-size: var(--font-size-xs);
  margin-top: 4px;
}

.slash-command-success-message {
  color: var(--success-color);
  font-size: var(--font-size-xs);
  margin-top: 4px;
}
```

