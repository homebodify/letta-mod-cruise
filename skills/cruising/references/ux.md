# UX: decision-oriented activities

Contents: select work · frame · research · adaptive interview (three modes) · ideate · specify/test · review · revise.

## Select the useful work
Preserve the breadth of framing, research, adaptive interviews, ideation, specification,
prototype/test planning, and decision-readiness review without requiring every stage.
Read existing artifacts first. Discuss in the conversation language; shared artifacts use
English unless requested otherwise. Inspect/review does not authorize implementation.

## Frame
Capture primary user, context/device/environment, job-to-be-done, decision needed,
known evidence with sources, assumptions, risks, 2–4 testable hypotheses, validation
criteria, and the smallest useful prototype. Include secondary actors only when they
change a decision. Ask only questions that materially change the next step.

## Research
Clarify scope before broad search. Investigate competitive/prior art and conventions,
real before/during/after workflows, platform/integration constraints, and relevant
domain, regulatory, safety, security, trust, and business risks.
Consider offline work, interruptions, one-handed use, protective gear, and time pressure.
Use project docs and available search/fetch sources; cite URLs or local artifact paths.
If blocked, disclose the gap and use available alternatives; never invent findings.
Browser work uses Aside only, never Playwright or a script that invokes it.
Separate source-backed findings from assumptions and stakeholder preferences; a
stakeholder interview is not observed end-user research unless that person is an actual
user and the evidence supports that role. Report limitations and contradictory evidence.
Produce domain/users, decision, competitive landscape, workflow, constraints, evidence,
assumptions, risks, open questions, and 3–5 implications for the next prototype.
For a concrete project, preserve useful research and source notes in `docs/search/`
when artifact writing is authorized. Ask for an unclear destination; honor no-file requests.

## Adaptive interview
Choose the obvious mode and explain briefly; otherwise ask ONE mode-selection question.
Ask one plain-language question at a time, never a batch. Prefer a brief recommendation;
use AskUserQuestion when available with 2–4 practical choices plus free text.
Each round: summarize understanding, identify the next blocker, ask, update the ledger,
then decide whether to continue or move the unknown to research/prototype/test later.
Stop when asked, when the artifact is useful, when answers no longer change scope/flow/
criteria, or when testing would teach more than additional stakeholder answers.

### Discovery interview: thin context or an early idea
Work through who this serves, when/where the problem occurs, current workarounds,
friction, desired outcome, constraints/non-goals, and the first success signal.
Output a Discovery Brief covering those items and the recommended next artifact.

### Decision Trace: existing context and a next decision
Clarify what to specify, prototype, compare, defer, or test. Keep questions simple:
what must the prototype decide, where can this fail, what must users do unaided?
Internally trace actor → trigger → object → action → feedback → state change →
failure point → recovery → handoff. Use task analysis and assumption mapping, not jargon.
Maintain a ledger: Confirmed, Assumed, Risk, Decision, Deferred, Test later.
Output decision needed, workflow trace, blockers, ledger, smallest prototype, observable
behavior, success/failure signals, next step, and a validation contract with stable IDs.

### User Research Protocol: real participants
This is not a product-owner clarification session. Establish objective, participant
profile, scenario/task mission, data to capture, what not to reveal, and analysis criteria.
Produce session structure, non-leading questions, task missions, behavioral observations,
qualitative prompts, analysis plan, and relevant consent/privacy/ethical/safety notes.
Do not coach participants toward a preferred answer or present a planned test as completed.
All interview outputs include mode/reason, confirmed decisions, assumptions/risks, open
questions, what to specify now, what to test later, and a recommendation to continue or stop.
Offer authorized saves under `docs/plans/` or `docs/search/`; do not jump to implementation.

## Ideate: genuinely different concepts
Build a provisional frame if absent; resolve essential missing context one question at a time.
Generate three concepts differing in interaction paradigm, information density, entry
point, device posture, automation, or confirmation model—not cosmetic variants.
For each: name, core idea, hypothesis, what the prototype validates, failure signal,
3–7-step flow, ASCII wireframe, strengths, weaknesses, and best-fit context.
Compare learnability, efficiency, mobile fit, safety/trust, build cost, and decision evidence.
Recommend a concept or hybrid with tradeoffs, smallest prototype, and first validation task.

## Specify and plan tests
Synthesize overview/decision, evidence versus assumptions/open questions, hypotheses,
scenarios (actor, trigger, steps, expected outcome), observable criteria, edge/error
states and recovery, annotated ASCII wireframes, constraints, non-goals, and recommendation.
Define smallest prototype, version/path, mocked versus real behavior, and expansion gate.
Start with flow and ASCII, not visual polish; standalone HTML/CSS/JS may suit a small
prototype, but follow project conventions and applicable UI skills when building is approved.
Test plan: participants/roles, neutral task missions, completion/time/first-click/wrong-click/
retry/route-choice observations, qualitative prompts, and edge cases to observe.
For each hypothesis set proceed/revise/reject thresholds and explain why they are useful;
do not invent universal percentages or mistake small-sample signals for statistical proof.
Carry the same requirement IDs into `cruise_update` contracts and linked implementation checks.
Offer an authorized spec save under `docs/plans/`. No legacy UX handoff producer exists;
an explicit external JSON adapter is needed for file import, not an imaginary export command.

## Review, not rewrite
Read the artifact; identify its type. Mark Pass / Partial / Missing for decision clarity,
user/context/job, evidence separation, testable hypotheses, observable criteria, flow,
edge/recovery states, minimal prototype, behavioral/qualitative test plan, thresholds,
and artifact paths. State Ready / Needs Revision / Not Ready with blocking gaps,
smallest fixes, decision possible now, and evidence still needed. Never rubber-stamp.
Weak safety/regulatory/security/business-critical evidence must be explicit.
Do not rewrite the whole artifact or implement fixes unless requested and gated.

## Combining activities and revising
A broad request can combine frame → research → interview → hypothesis/validation frame
→ concepts → spec/test plan → review. Reuse existing results and skip irrelevant stages.
Confirm meaningful decisions; requests for a continuous pass do not waive approval gates
or interview questions. No old slash aliases, automatic retry loops, or parallel scheduler.
On revision, identify the earliest weak input: decision/context → frame; evidence →
research; workflow → interview; weak hypotheses → validation frame; wrong concept →
ideation; scope/edge/test gaps → spec. Propose a bounded repair, record changes and why,
then review again when authorized. Stop with uncertainty rather than polishing indefinitely.
