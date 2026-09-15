import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContract, contractHash, reviseContract, evaluateRun } from '../src/core/contracts.mjs';

const contract = () => ({
  schema_version: 1, goal: 'Correct the calculator', intent: 'implement', risk: 'low',
  requirements: [{ id: 'sum', text: 'Adds two values' }],
  checks: [{ id: 'sum-test', label: 'Addition test', bin: 'node', args: ['--test', 'sum.test.mjs'], requirement_ids: ['sum'], assertion: { type: 'exit_code' } }],
});
const run = (input = contract()) => {
  const normalized = validateContract(input);
  const hash = contractHash(normalized);
  return { id: 'run-1', contract: normalized, contract_version: 1, contract_hash: hash, approval: { contract_hash: hash, source: 'request' }, evidence: [], blockers: [], phase: 'planned' };
};
const proof = (state, checkId = 'sum-test', overrides = {}) => ({
  id: `evidence-${checkId}`, check_id: checkId,
  requirement_ids: state.contract.checks.find(check => check.id === checkId)?.requirement_ids ?? [],
  contract_hash: state.contract_hash, fingerprint: 'snapshot-1', status: 'passed',
  assertion_evaluated: true, artifact_path: 'artifacts/result.json', exit_code: 0, ...overrides,
});
const evaluate = state => evaluateRun(state, 'snapshot-1');

test('normalizes defaults with stable hashes independent of object key insertion order', () => {
  const input = contract();
  const normalized = validateContract(input);
  assert.equal(normalized.requirements[0].required, true);
  assert.equal(normalized.checks[0].required, true);
  assert.equal(normalized.checks[0].timeout_ms, 120000);
  assert.deepEqual(normalized.non_goals, []);
  assert.deepEqual(normalized.constraints, []);
  assert.equal(contractHash(input), contractHash(Object.fromEntries(Object.entries(normalized).reverse())));
  assert.equal(contractHash(input).length, 64);
  normalized.checks[0].args.push('different');
  assert.equal(input.checks[0].args.length, 2);
});

test('rejects empty implementation requirements and malformed contract fields', () => {
  const mutations = [
    c => { c.requirements = []; }, c => { c.requirements = null; },
    c => { c.schema_version = '1'; }, c => { c.goal = ' '; },
    c => { c.intent = 'execute'; }, c => { c.risk = 'medium'; },
    c => { c.non_goals = [1]; }, c => { c.constraints = null; },
    c => { c.checks = {}; }, c => { c.unrecognized = true; },
    c => { c.requirements[0].id = '../sum'; },
    c => { c.requirements[0].required = 'true'; },
    c => { c.requirements[0].text = 12; },
    c => { c.requirements.push({ ...c.requirements[0] }); },
    c => { c.checks.push({ ...c.checks[0] }); },
    c => { c.checks[0].requirement_ids = ['missing']; },
    c => { c.checks[0].requirement_ids = ['sum', 'sum']; },
    c => { c.checks[0].args = 'node --test'; },
    c => { c.checks[0].args = [12]; },
    c => { c.checks[0].bin = ''; },
    c => { c.checks[0].bin = 'node\nwhoami'; },
    c => { c.checks[0].args = ['bad\0argument']; },
    c => { c.checks[0].assertion = { type: 'magic' }; },
    c => { delete c.checks[0].assertion; },
    c => { c.checks[0].assertion = { type: 'output_includes' }; },
    c => { c.checks[0].assertion = { type: 'exit_code', value: '0' }; },
    c => { c.checks[0].required = 1; },
    ...[0, 300001, 1.5, '1000', null].map(value => c => { c.checks[0].timeout_ms = value; }),
    c => { c.checks = Array.from({ length: 21 }, (_, i) => ({ ...c.checks[0], id: `check-${i}` })); },
  ];
  for (const mutate of mutations) {
    const input = contract();
    mutate(input);
    assert.throws(() => validateContract(input), TypeError, mutate.toString());
  }
  for (const value of [null, [], 'contract', new Date()]) assert.throws(() => validateContract(value));
});

test('allows trusted project executables and literal argv without interpolation', () => {
  const input = contract();
  input.checks[0].bin = './scripts/verify';
  input.checks[0].args = ['$(not-executed)', 'a;b', ''];
  assert.deepEqual(validateContract(input).checks[0].args, input.checks[0].args);
});

test('output assertions and supported timeout/check-count boundaries normalize', () => {
  const input = contract();
  input.checks[0].assertion = { type: 'output_includes', value: 'sum: 3' };
  input.checks[0].timeout_ms = 1;
  assert.equal(validateContract(input).checks[0].timeout_ms, 1);
  input.checks[0].timeout_ms = 300000;
  input.checks = Array.from({ length: 20 }, (_, index) => ({ ...input.checks[0], id: `check-${index}` }));
  const state = run(input);
  state.evidence = state.contract.checks.map(check => proof(state, check.id));
  assert.equal(evaluate(state).verdict, 'verified');
});

test('typecheck does not implicitly cover requirements', () => {
  const input = contract();
  input.checks[0].id = 'typecheck';
  input.checks[0].requirement_ids = [];
  const state = run(input);
  state.evidence.push(proof(state, 'typecheck'));
  const result = evaluate(state);
  assert.equal(result.verdict, 'needs_evidence');
  assert.equal(result.coverage[0].status, 'missing');
});

test('verifies explicitly bound evidence without requiring a diff', () => {
  const state = run();
  state.evidence.push(proof(state));
  const result = evaluate(state);
  assert.equal(result.verdict, 'verified');
  assert.equal(result.phase, 'completed');
  assert.deepEqual(result.coverage, [{ requirement_id: 'sum', status: 'covered', evidence_ids: ['evidence-sum-test'] }]);
  assert.match(result.reasons.join(' '), /not machine-proved/);
});

test('stale, unmapped, unknown, unevaluated and artifactless evidence cannot certify', () => {
  const changes = [
    { contract_hash: 'old' }, { fingerprint: 'old' }, { check_id: 'unknown' },
    { requirement_ids: [] }, { requirement_ids: ['other'] }, { requirement_ids: ['sum', 'sum'] },
    { assertion_evaluated: false }, { assertion_evaluated: 'true' },
    { artifact_path: '' }, { artifact_path: undefined }, { artifact_path: 1 },
    { status: 'unknown' }, { id: undefined }, { exit_code: 1 },
  ];
  for (const change of changes) {
    const state = run();
    state.evidence.push(proof(state, 'sum-test', change));
    assert.equal(evaluate(state).verdict, 'needs_evidence', JSON.stringify(change));
  }
});

test('same assertion type on different check IDs needs separate evidence', () => {
  const input = contract();
  input.checks.push({ ...input.checks[0], id: 'second-test' });
  const state = run(input);
  state.evidence.push(proof(state));
  assert.equal(evaluate(state).verdict, 'needs_evidence');
  state.evidence.push(proof(state, 'second-test'));
  assert.equal(evaluate(state).verdict, 'verified');
});

test('newest entry per check controls, including stale replacement evidence', () => {
  const state = run();
  state.evidence.push(proof(state), proof(state, 'sum-test', { fingerprint: 'old' }));
  assert.equal(evaluate(state).verdict, 'needs_evidence');
  state.evidence.push(proof(state));
  assert.equal(evaluate(state).verdict, 'verified');
});

test('failed and unevaluable declared checks remain resumable, even optional checks', () => {
  for (const status of ['failed', 'unevaluable']) {
    const state = run();
    state.evidence.push(proof(state, 'sum-test', { status }));
    assert.equal(evaluate(state).verdict, 'needs_work');
    assert.equal(evaluate(state).phase, 'paused');
    state.evidence.push(proof(state));
    assert.equal(evaluate(state).verdict, 'verified');
  }
  const input = contract();
  input.checks[0].required = false;
  const state = run(input);
  state.evidence.push(proof(state, 'sum-test', { status: 'failed' }));
  assert.equal(evaluate(state).verdict, 'needs_work');
});

test('revision is immutable, invalidates approval, retains stale evidence and allows changed requirement text', () => {
  const state = run();
  state.evidence.push(proof(state));
  const before = structuredClone(state);
  assert.equal(reviseContract(state, contract()), state);
  const input = contract();
  input.requirements[0].text = 'Adds three values';
  const revised = reviseContract(state, input);
  assert.deepEqual(state, before);
  assert.equal(revised.contract_version, 2);
  assert.equal(revised.approval, null);
  assert.equal(revised.evidence, state.evidence);
  assert.equal(revised.phase, 'planned');
  assert.equal(revised.verdict, 'needs_evidence');
  assert.notEqual(revised.contract_hash, state.contract_hash);
  assert.equal(evaluate(revised).verdict, 'awaiting_approval');
  revised.approval = { source: 'human', contract_hash: revised.contract_hash };
  assert.equal(evaluate(revised).verdict, 'needs_evidence');
});

test('approval is hash-bound and high risk requires human approval; blockers take precedence', () => {
  const input = contract();
  input.risk = 'high';
  const state = run(input);
  state.evidence.push(proof(state));
  assert.equal(evaluate(state).verdict, 'awaiting_approval');
  state.approval.source = 'human';
  assert.equal(evaluate(state).verdict, 'verified');
  state.approval.contract_hash = 'old';
  assert.equal(evaluate(state).verdict, 'awaiting_approval');
  state.blockers.push({ id: 'dependency', reason: 'Dependency unavailable', status: 'open' });
  assert.equal(evaluate(state).verdict, 'blocked');
  state.blockers[0].status = 'resolved';
  state.approval.contract_hash = state.contract_hash;
  state.contract_hash = 'tampered';
  assert.equal(evaluate(state).verdict, 'awaiting_approval');
});

test('inspect never technically verifies and prohibits checks', () => {
  const input = contract();
  input.intent = 'inspect';
  assert.throws(() => validateContract(input));
  input.checks = [];
  input.requirements = [];
  const state = run(input);
  assert.equal(evaluate(state).verdict, 'review_only');
  assert.equal(evaluate(state).phase, 'review_ready');
  state.phase = 'awaiting_input';
  assert.equal(evaluate(state).phase, 'awaiting_input');
});

test('malformed handoff shapes reject rather than certify', () => {
  for (const change of [
    { evidence: {} }, { evidence: null }, { blockers: 'none' },
    { blockers: [{ id: 'x', reason: 'reason', status: 'closed' }] },
    { approval: { source: 'bot', contract_hash: 'hash' } },
    { approval: { source: 'human' } }, { contract: null },
  ]) assert.throws(() => evaluate({ ...run(), ...change }), TypeError);
  assert.throws(() => evaluateRun(run(), null), TypeError);
  assert.throws(() => reviseContract({ contract_version: '1' }, contract()), TypeError);
  const state = run();
  state.evidence = [null, {}, 'junk'];
  assert.equal(evaluate(state).verdict, 'needs_evidence');
});
