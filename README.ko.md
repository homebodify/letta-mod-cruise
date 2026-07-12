# CruiseCode

[English README](./README.md)

CruiseCode는 Letta Code용 evidence-first 코딩 워크플로우 mod입니다.

코딩 작업과 UX handoff를 검증 가능한 계약(Evidence Contract), 증거, 판정, 보고서로 바꾸는 것이 목표입니다. CruiseCode는 더 큰 자율 코딩 하네스가 되려는 도구가 아닙니다. 에이전트가 수행한 코딩 작업을 추적 가능하고, 리뷰 가능하고, 검증 상태를 솔직하게 남기는 데 집중합니다.

## 왜 필요한가

AI 코딩 에이전트는 코드를 빠르게 만들 수 있습니다. 하지만 더 어려운 질문은 그 결과를 믿을 수 있는지입니다.

CruiseCode는 이런 질문에 답하도록 설계됐습니다.

- 이 작업은 무엇을 만족해야 했나?
- 어떤 acceptance criteria를 기준으로 했나?
- 구현을 뒷받침하는 evidence는 무엇인가?
- 어떤 check가 통과했고 실패했나?
- 아직 부족하거나 검증되지 않은 것은 무엇인가?

핵심 규칙은 이겁니다.

```txt
No evidence → no verified
```

즉, 증거가 없으면 `verified`라고 말하지 않습니다.

## 명령어

```txt
/code-cruise "task"        run 생성 + Evidence Contract 생성
/code-cruise --verify-only 현재 git diff를 가능한 check로 검증
/code-cruise --resume      active run 표시
/code-cruise --handoff <file>
                            implementation-handoff.json에서 run 생성
/code-plan [task]          Evidence Contract 생성/갱신
/code-check                git/check evidence 수집
/code-status               현재 run 상태 표시
/code-report               report.md 생성
```

## 저장 구조

CruiseCode는 현재 작업 디렉토리 기준으로 프로젝트 로컬 상태를 저장합니다.

```txt
.letta/cruise-code/
  config.json
  active.json
  runs/
    <run-id>/
      run.json
      plan.json
      ledger.jsonl
      evidence/
        index.json
        git-status.txt
        git-diff-stat.txt
        git-diff.patch
        typecheck.txt
        test.txt
        lint.txt
        build.txt
      report.md
```

이 저장소에는 로컬 run state나 private evidence artifact를 포함하지 않습니다.

## 설치

mod 파일을 로컬 Letta Code mods 디렉토리에 복사합니다.

```bash
mkdir -p ~/.letta/mods
cp cruise-code.js ~/.letta/mods/cruise-code.js
```

그 다음 Letta Code에서 reload합니다.

```txt
/reload
```

CruiseCode는 홈 디렉토리보다 실제 프로젝트 디렉토리에서 사용하는 것이 좋습니다.

```txt
/code-cruise "Fix login redirect after expired session"
```

## MVP 범위

첫 버전은 아래에 집중합니다.

- Evidence Contract 생성
- `package.json` 기반 JS/TS check 감지
- git status/diff evidence 수집
- typecheck/test/lint/build output 저장
- verdict 계산
- compact status panel
- 상세 `/code-status`
- `report.md` 생성
- 향후 CruiseUX 연동을 위한 JSON handoff 소비

## CruiseUX handoff 방향

CruiseCode는 CruiseUX와 함께 쓰이도록 설계됐습니다.

```txt
CruiseUX  → UX framing, research, interview, ideation, spec, review
CruiseCode → implementation, evidence, checks, verdict, report
```

향후 CruiseUX handoff 파일은 아래 JSON을 기준으로 합니다.

```txt
implementation-handoff.json
```

CruiseCode는 `ux-ac-001` 같은 UX acceptance criteria를 구현 acceptance criteria로 변환하면서 원래 `ux_ref`를 보존합니다.

## 디자인 노트

간결한 공개용 설계 개요는 [docs/DESIGN.md](./docs/DESIGN.md)를 참고하세요.

## 보안 메모

이 저장소에는 source와 documentation만 포함해야 합니다. 아래 항목은 커밋하지 않습니다.

- `.letta/cruise-code/` run state
- private project evidence files
- `.env` files
- credentials or API keys
- local diagnostics
- private project paths or logs

## License

MIT License. See [LICENSE](./LICENSE).
