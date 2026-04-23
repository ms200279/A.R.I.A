"use client";

import type { ChatMessage } from "@/types/assistant-ui";

type Props = { message: ChatMessage };

/**
 * 메시지 단건 렌더.
 *
 * assistant 응답의 5 가지 `kind` 별로 톤/레이블이 달라진다:
 *   - direct_answer / clarification_question : 기본
 *   - proposed_action / approval_required    : 포인트 컬러 + "저장안/승인 필요" 배지
 *   - blocked                                 : 경고 톤
 *
 * 추후 proposed_action / approval_required 에는 카드(예: pending_action 상세 + 승인 버튼)를
 * 끼워넣기 쉬운 구조로 남겨 두었다 (ExtraSlot).
 */
export default function MessageBubble({ message }: Props) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-white/[0.06] px-4 py-3 text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === "system") {
    const danger = message.tone === "error";
    return (
      <div className="flex justify-center">
        <div
          className={`max-w-[80%] rounded-full border px-3 py-1.5 text-xs ${
            danger
              ? "border-[color:var(--danger)]/40 bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
              : "border-white/10 bg-white/[0.03] text-[var(--text-secondary)]"
          }`}
          role={danger ? "alert" : undefined}
        >
          {message.content}
        </div>
      </div>
    );
  }

  // assistant
  const { kind, content, reason } = message;
  const isBlocked = kind === "blocked";
  const isProposal =
    kind === "proposed_action" || kind === "approval_required";

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          aria
          {kind !== "direct_answer" ? (
            <span
              className={`rounded-full border px-2 py-[1px] ${
                isBlocked
                  ? "border-[color:var(--danger)]/40 text-[color:var(--danger)]"
                  : isProposal
                    ? "border-[color:var(--accent)]/40 text-[color:var(--accent-strong)]"
                    : "border-white/10 text-[var(--text-secondary)]"
              }`}
            >
              {labelFor(kind)}
            </span>
          ) : null}
        </div>

        <div
          className={`rounded-2xl rounded-bl-md border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isBlocked
              ? "border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
              : isProposal
                ? "border-[color:var(--accent)]/30 bg-[color:var(--accent-soft)] text-[var(--text-primary)]"
                : "border-white/10 bg-white/[0.03] text-[var(--text-primary)]"
          }`}
        >
          {content}

          {isProposal && message.pendingActionIds && message.pendingActionIds.length > 0 ? (
            <ExtraSlot>
              <ProposalHint
                kind={kind}
                ids={message.pendingActionIds}
              />
            </ExtraSlot>
          ) : null}

          {isBlocked && reason ? (
            <ExtraSlot>
              <div className="text-[11px] uppercase tracking-wide text-[color:var(--danger)]/80">
                reason: {reason}
              </div>
            </ExtraSlot>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function labelFor(
  kind: Exclude<
    import("@/types/assistant-ui").AssistantAnswerKind,
    "direct_answer"
  >,
): string {
  switch (kind) {
    case "clarification_question":
      return "확인 필요";
    case "proposed_action":
      return "제안";
    case "approval_required":
      return "승인 대기";
    case "blocked":
      return "차단됨";
  }
}

function ExtraSlot({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 border-t border-white/10 pt-3">{children}</div>;
}

function ProposalHint({
  kind,
  ids,
}: {
  kind: "proposed_action" | "approval_required";
  ids: string[];
}) {
  return (
    <div className="flex flex-col gap-2 text-xs text-[var(--text-secondary)]">
      <div>
        {kind === "approval_required"
          ? "저장안이 생성되었습니다. 승인 화면에서 최종 확인해 주세요."
          : "동의하시면 저장안을 만들어 두겠습니다."}
      </div>
      <div className="font-mono text-[10px] text-[var(--text-tertiary)]">
        pending_action_ids: {ids.slice(0, 3).join(", ")}
        {ids.length > 3 ? ` +${ids.length - 3}` : null}
      </div>
    </div>
  );
}
