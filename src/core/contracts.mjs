import { createHash } from 'node:crypto';

const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function object(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError(`${name} must be a plain object`);
  }
  if (keys && Object.keys(value).some(key => !keys.includes(key))) {
    throw new TypeError(`${name} contains unknown fields`);
  }
  return value;
}

function string(value, name, nonempty = true) {
  if (typeof value !== 'string' || (nonempty && !value.trim()) || value.includes('\0')) {
    throw new TypeError(`${name} must be ${nonempty ? 'a nonempty' : 'a'} string without NUL`);
  }
  return value;
}

function array(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  return value;
}

function id(value, name) {
  if (typeof value !== 'string' || !ID.test(value)) throw new TypeError(`${name} is not a safe ID`);
  return value;
}

function required(value, name) {
  if (value === undefined) return true;
  if (typeof value !== 'boolean') throw new TypeError(`${name} must be boolean`);
  return value;
}

function unique(values, name) {
  if (new Set(values).size !== values.length) throw new TypeError(`${name} contains duplicate IDs`);
  return values;
}

/** Normalize the declarative contract. Commands are literal executable/argv, never shell templates. */
export function validateContract(input) {
  object(input, 'contract', ['schema_version', 'goal', 'intent', 'risk', 'requirements', 'non_goals', 'constraints', 'checks']);
  if (input.schema_version !== 1) throw new TypeError('schema_version must be 1');
  const goal = string(input.goal, 'goal');
  if (!['inspect', 'implement'].includes(input.intent)) throw new TypeError('invalid intent');
  if (!['low', 'high'].includes(input.risk)) throw new TypeError('invalid risk');
  const requirements = array(own(input, 'requirements') ? input.requirements : [], 'requirements').map((entry, index) => {
    object(entry, `requirements[${index}]`, ['id', 'text', 'required']);
    return { id: id(entry.id, 'requirement.id'), text: string(entry.text, 'requirement.text'), required: required(entry.required, 'requirement.required') };
  });
  const requirementIds = new Set(unique(requirements.map(entry => entry.id), 'requirements'));
  if (input.intent === 'implement' && !requirements.length) throw new TypeError('implement requires requirements');
  if (input.intent === 'implement' && !requirements.some(entry => entry.required)) throw new TypeError('implement requires at least one required requirement');
  const strings = key => array(own(input, key) ? input[key] : [], key).map(value => string(value, key));
  const checks = array(own(input, 'checks') ? input.checks : [], 'checks').map((entry, index) => {
    object(entry, `checks[${index}]`, ['id', 'label', 'bin', 'args', 'requirement_ids', 'required', 'timeout_ms', 'assertion']);
    const refs = unique(array(entry.requirement_ids, 'check.requirement_ids').map(value => id(value, 'check.requirement_ids')), 'check.requirement_ids');
    if (refs.some(ref => !requirementIds.has(ref))) throw new TypeError('check has dangling requirement ID');
    const timeout = own(entry, 'timeout_ms') ? entry.timeout_ms : 120000;
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 300000) throw new TypeError('invalid timeout_ms');
    object(entry.assertion, 'check.assertion', ['type', 'value']);
    let assertion;
    if (entry.assertion.type === 'exit_code') {
      if (own(entry.assertion, 'value')) throw new TypeError('exit_code asserts zero and does not accept value');
      assertion = { type: 'exit_code' };
    } else if (entry.assertion.type === 'output_includes') {
      assertion = { type: 'output_includes', value: string(entry.assertion.value, 'assertion.value') };
    } else {
      throw new TypeError('unknown assertion type');
    }
    const bin = string(entry.bin, 'check.bin');
    if (/[\r\n]/.test(bin)) throw new TypeError('check.bin must be a literal executable');
    return {
      id: id(entry.id, 'check.id'), label: string(entry.label, 'check.label'), bin,
      args: array(entry.args, 'check.args').map(value => string(value, 'check.args', false)),
      requirement_ids: refs, required: required(entry.required, 'check.required'), timeout_ms: timeout, assertion,
    };
  });
  unique(checks.map(entry => entry.id), 'checks');
  if (checks.length > 20) throw new TypeError('at most 20 checks are allowed');
  if (input.intent === 'inspect' && checks.length) throw new TypeError('inspect cannot declare checks');
  return { schema_version: 1, goal, intent: input.intent, risk: input.risk, requirements, non_goals: strings('non_goals'), constraints: strings('constraints'), checks };
}

export function contractHash(contract) {
  return createHash('sha256').update(JSON.stringify(validateContract(contract))).digest('hex');
}

/** Changed requirement text is permitted: the new version/hash invalidates prior approval and evidence. */
export function reviseContract(run, input) {
  object(run, 'run');
  const contract = validateContract(input);
  const hash = contractHash(contract);
  if (run.contract && contractHash(run.contract) === hash) return run;
  if (run.contract_version !== undefined && (!Number.isInteger(run.contract_version) || run.contract_version < 0)) {
    throw new TypeError('contract_version must be a nonnegative integer');
  }
  return { ...run, contract, contract_version: (run.contract_version ?? 0) + 1, contract_hash: hash, approval: null, phase: 'planned', verdict: 'needs_evidence' };
}

/**
 * Certification checks explicit, agent-selected bindings, not semantic truth.
 * A declared assertion's relevance to requirement prose cannot be machine-proved here.
 * Typechecks/diffs have no implicit coverage, and no diff is necessary for legitimate no-ops.
 */
export function evaluateRun(run, snapshotFingerprint) {
  object(run, 'run');
  const contract = validateContract(run.contract);
  string(snapshotFingerprint, 'snapshotFingerprint');
  const evidence = array(own(run, 'evidence') ? run.evidence : [], 'run.evidence');
  const blockers = array(own(run, 'blockers') ? run.blockers : [], 'run.blockers');
  for (const blocker of blockers) {
    object(blocker, 'blocker');
    id(blocker.id, 'blocker.id');
    string(blocker.reason, 'blocker.reason');
    if (!['open', 'resolved'].includes(blocker.status)) throw new TypeError('invalid blocker status');
  }
  if (run.approval != null) {
    object(run.approval, 'approval');
    string(run.approval.contract_hash, 'approval.contract_hash');
    if (!['request', 'human'].includes(run.approval.source)) throw new TypeError('invalid approval source');
  }
  const hash = contractHash(contract);
  const latest = new Map();
  const checks = new Map(contract.checks.map(check => [check.id, check]));
  for (const entry of evidence) {
    if (entry && typeof entry === 'object' && checks.has(entry.check_id)) latest.set(entry.check_id, entry);
  }
  const current = entry => entry && run.contract_hash === hash && entry.contract_hash === hash && entry.fingerprint === snapshotFingerprint;
  const passes = check => {
    const entry = latest.get(check.id);
    return current(entry) && typeof entry.id === 'string' && ID.test(entry.id)
      && entry.status === 'passed' && entry.assertion_evaluated === true
      && typeof entry.artifact_path === 'string' && !!entry.artifact_path.trim() && !entry.artifact_path.includes('\0')
      && Number.isInteger(entry.exit_code) && entry.exit_code === 0
      && Array.isArray(entry.requirement_ids)
      && entry.requirement_ids.length === check.requirement_ids.length
      && new Set(entry.requirement_ids).size === entry.requirement_ids.length
      && entry.requirement_ids.every(ref => check.requirement_ids.includes(ref));
  };
  const coverage = contract.requirements.map(requirement => {
    const evidenceIds = contract.checks.filter(check => check.requirement_ids.includes(requirement.id) && passes(check)).map(check => latest.get(check.id).id);
    return { requirement_id: requirement.id, status: evidenceIds.length ? 'covered' : 'missing', evidence_ids: [...new Set(evidenceIds)] };
  });
  const result = (verdict, phase, reasons) => ({ verdict, phase, coverage, reasons });
  const open = blockers.filter(blocker => blocker.status === 'open');
  if (open.length) return result('blocked', 'paused', open.map(blocker => blocker.reason));
  if (contract.intent === 'inspect') return result('review_only', run.phase === 'awaiting_input' ? 'awaiting_input' : 'review_ready', ['Inspection is review-only; it does not certify implementation.']);
  if (run.contract_hash !== hash || run.approval?.contract_hash !== hash
    || (contract.risk === 'high' && run.approval?.source !== 'human')) {
    return result('awaiting_approval', 'awaiting_approval', ['Current contract approval is required; high risk requires human approval.']);
  }
  const failed = contract.checks.filter(check => {
    const entry = latest.get(check.id);
    return current(entry) && ['failed', 'unevaluable'].includes(entry.status);
  });
  if (failed.length) return result('needs_work', 'paused', failed.map(check => `Check ${check.id} failed or was unevaluable.`));
  const missingChecks = contract.checks.filter(check => check.required && !passes(check));
  const missingRequirements = coverage.filter(entry => entry.status !== 'covered' && contract.requirements.find(requirement => requirement.id === entry.requirement_id).required);
  if (missingChecks.length || missingRequirements.length) {
    return result('needs_evidence', 'paused', [
      ...missingChecks.map(check => `Check ${check.id} needs current, assertion-evaluated artifact evidence.`),
      ...missingRequirements.map(entry => `Requirement ${entry.requirement_id} needs explicitly bound evidence.`),
    ]);
  }
  return result('verified', 'completed', ['All required checks and requirements have current evidence. Semantic relevance of agent-declared assertion mappings is not machine-proved.']);
}
