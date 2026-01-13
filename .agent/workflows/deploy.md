---
description: Public Repo Synchronization & Sanitization
---

## 1. Context Assessment

- Identify which *Protocols*, *Case Studies*, or *Concepts* from the private workspace are ready for public release.
- **Criteria**: High structural value, low liability, generic applicability.
- **EXPLICIT EXCLUSIONS**:
  - **Psychology Profiles** (e.g. `Psychology_L1L5.md`) - Too personal.
  - **Risk Playbooks** (e.g. `RISK_PLAYBOOKS.md`) - Internal governance only.
  - **Private Case Studies** - Unless fully sanitized and generic (e.g. Bak Chor Mee).

## 2. Sanitization Protocol (The "Consent Wall" Rule)

- **PII Stripping**: Remove all real names (e.g., specific people, specific clients). Replace with `[Client A]`, `[Target B]`, `[Creator]`.
- **Financial Stripping**: Remove exact dollar amounts (e.g., `$4,500`). Replace with `$X` or `$High-4-Figures`.
- **Location Stripping**: Remove specific addresses or non-public venues.
- **Tone Polish**: Remove internal "Commanding Officer" harshness if it reflects poorly on optics. Maintain "Strategic Realism."

## 3. Deployment Execution

- **Target Repo**: `/Users/winstonkoh/Desktop/Athena-Public`
- **Action**: Copy *sanitized* versions of files to the target repo structure.
- **Structure Mapping**:
  - `Athena/.agent/skills/protocols/` -> `Athena-Public/docs/protocols/`
  - `Athena/Winston/profile/` -> `Athena-Public/docs/concepts/`
  - `Athena/.context/memories/case_studies/` -> `Athena-Public/docs/case-studies/`

## 4. Git Synchronization

// turbo

1. `cd /Users/winstonkoh/Desktop/Athena-Public`
2. `git add .`
3. `git commit -m "Deployment: [Summary of Changes]"`
4. `git push origin main`

## 5. Verification

- Confirm the push succeeded.
- Verify the public URL if necessary.
