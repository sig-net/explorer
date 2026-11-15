# Step report

A subagent's whole reply is this report. Keep it short and factual. No preamble.

```
STEP: <stage>.<step>
STATUS: DONE | BLOCKED | REFUSED

SUMMARY
<two or three sentences: what now exists or what is true that was not before>

CHANGES
<every file created, changed, moved or deleted, one per line. "none" for an investigation>

EXIT CHECK
<the command or commands you ran, and the decisive lines of their output, verbatim>
<if not run: say so and why>

FINDINGS
<facts the orchestrator must know: results of an investigation, surprises, anything outside
your scope that looks wrong. Each with its evidence: a command and output, or file:line>

DEVIATIONS
<where you did something other than the step entry said, and why. "none" otherwise>

QUESTION                       (only when STATUS is BLOCKED)
<one precise question, and what you would do under each plausible answer>

REASON                         (only when STATUS is REFUSED)
<why the step is beyond you or wrongly shaped, and how you would split or reshape it>

KNOWLEDGE CORRECTIONS
wrong:   <pack, section, what it says, what is true, evidence>
missing: <what you had to find out yourself that a pack should have told you, with evidence>
unused:  <pack sections you read that did not matter for this kind of step>

NEXT
<what the next agent in this stream should know that is not in a pack yet>

CONTEXT
<comfortable | tight | summarised. "summarised" if your context was compacted at any point>
```

Rules:

- Every claim comes from something run or read in this session. Mark a belief as a belief.
- Never paste a secret or a URL that carries a key.
- "none" is a valid entry. An empty section is not.
