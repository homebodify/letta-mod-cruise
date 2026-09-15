import { writeFileSync, renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { runPath } from './store.mjs';

export function renderStatus(run, evaluation) {
  if (!run) return 'No active Cruise run. /cruise <request> 로 시작하세요.';
  return [
    `Cruise · ${run.run_id}`,
    `Request: ${run.request}`,
    `Phase: ${run.contract?.intent === 'inspect' && !['review_ready', 'paused', 'awaiting_input'].includes(run.phase) ? run.phase : evaluation?.phase ?? run.phase} · Verdict: ${evaluation?.verdict ?? run.verdict}`,
    `Contract: v${run.contract_version} · intent: ${run.contract?.intent ?? run.route.intent}`,
    ...(evaluation?.reasons ?? []),
    ...(run.blockers ?? []).filter(b => b.status !== 'resolved').map(b => `Blocked: ${b.reason}`),
    run.summary ? `Checkpoint: ${run.summary}` : '',
    'Technical verification does not establish usability or user acceptance.',
  ].filter(Boolean).join('\n');
}
export function writeReport(cwd, run, evaluation) {
  const path = join(runPath(cwd, run.run_id), 'report.md');
  const lines = ['# Cruise report', '', renderStatus(run, evaluation), '', '## Requirement evidence', ''];
  for (const row of evaluation.coverage ?? []) lines.push(`- ${row.requirement_id}: ${row.status} — ${(row.evidence_ids ?? []).join(', ') || 'no current evidence'}`);
  lines.push('', '## Captured checks', '');
  for (const ev of run.evidence) lines.push(`- ${ev.check_id}: ${ev.status}; exit ${ev.exit_code}; ${ev.artifact_path}`);
  lines.push('', '## Limits', '', '- Requirements-to-check mapping is a reviewed agent judgment, not a proof of semantic completeness.', '- Local command output may contain sensitive data. Do not publish run state or logs.', '- Only declared checks on the recorded workspace and contract are evaluated. UX validation remains separate.');
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, lines.join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  // Replace the directory entry, never follow a dangling symlink or overwrite a hard-linked inode.
  renameSync(temp, path);
  return path;
}
