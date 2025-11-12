# /validate

Validate claims and provide credible sources with structured analysis and ratings.

## Purpose
This command systematically fact-checks and validates claims by researching them and providing evidence-based analysis. Use this when you need to verify factual statements, quantitative data, qualitative assertions, or any claim that requires validation against reliable sources.

## Instructions
- Validate each claim provided
- Research claims against credible sources
- Provide 3-5 sentence analysis for each claim with proper citations
- Rate the quality and credibility of sources used (0-10 scale)
- Format results clearly with claim numbering

## Output Format
For each claim, provide:

**Claim X of Y:** "Insert claim here"

**Analysis:** (3 to 5 sentence summary of research results with citations)

**Sources Rating:** [0-10] - (brief explanation of source quality/credibility)

## Conditional Logic

**Branch 1 - No Context Provided:**
If no additional context is provided below the instruction, validate claims from:
- The most recent user message or interaction
- Focus on both quantitative claims (numbers, statistics, metrics) and qualitative claims (descriptions, assertions, relationships)

**Branch 2 - Context Provided:**
If the user provides context through any of the following:
- Attached documents or files
- Provided text, sentences, or messages
- Current application or web browser context
- Links or URLs

Then: Analyze ONLY the provided context. Ignore previous instructions or messages in the context window and focus exclusively on validating claims within the supplied material.

## Best Practices
- Prioritize authoritative and peer-reviewed sources
- Distinguish between fact, opinion, and interpretation
- Note if claims are outdated or if supporting evidence is limited
- Be transparent about source limitations or conflicts of interest
- Provide specific citations (URLs, publications, dates) when possible
- Flag unverifiable claims clearly

## Example Output

**Claim 1 of 3:** "The Earth's average temperature has risen by approximately 1.1°C since pre-industrial times."

**Analysis:** According to NASA and the IPCC (Intergovernmental Panel on Climate Change), global average temperatures have increased by roughly 1.1°C since 1850-1900. Multiple independent datasets including NASA GISS, NOAA, and Berkeley Earth confirm this warming trend. This figure is widely accepted in climate science literature and is supported by extensive observational data.

**Sources Rating:** 9/10 - NASA and IPCC are authoritative, peer-reviewed scientific organizations with rigorous data collection standards.

---

**Claim 2 of 3:** "Company X increased revenue by 300% last quarter."

**Analysis:** While we cannot verify this without access to official financial statements, similar claims require SEC filings, quarterly earnings reports, or verified press releases. The 300% figure would represent exceptional growth and should be verified against official company documentation and industry benchmarks. Extraordinary growth claims warrant additional scrutiny.

**Sources Rating:** Pending - Requires official company financial documentation for validation.
