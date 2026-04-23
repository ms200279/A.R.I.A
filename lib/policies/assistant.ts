import "server-only";

/**
 * Assistant 입력 pre-gate.
 *
 * 목적:
 *  - 명백히 "현재 프로젝트 정책상 금지"인 명령형 요청(메일 발송/삭제/공유/웹 자동화)을
 *    LLM 호출 전에 차단한다.
 *  - 모델이 뒤늦게 거절하는 것보다 비용을 절감하고 audit 로그에 선명한 정책 위반 이벤트를 남긴다.
 *
 * 설계 원칙:
 *  - 과차단 방지를 위해 "명령형"에 가까운 패턴만 매칭한다. 예:
 *      "메일 보내는 방법 알려줘" 는 허용(설명 요청)
 *      "메일 보내줘"           는 차단(실행 요청)
 *  - 의도 추정은 불완전할 수밖에 없다. 애매하면 통과시키고, 모델과 system prompt 가 거절한다.
 *  - 원문 메시지는 로깅/반환 페이로드에 싣지 않는다. 매칭된 reason / pattern 식별자만 전달.
 */

export type AssistantPolicyBlockReason =
  | "mail_send_not_supported"
  | "delete_not_supported"
  | "share_not_supported"
  | "web_automation_not_supported";

export type AssistantPreGateResult =
  | { decision: "allow" }
  | {
      decision: "block";
      reason: AssistantPolicyBlockReason;
      /** 매칭된 패턴 식별자. 로깅용. 메시지 원문이 아니다. */
      matched_pattern: string;
      /** 사용자에게 노출될 한국어 메시지. */
      user_message: string;
    };

type Rule = {
  reason: AssistantPolicyBlockReason;
  user_message: string;
  patterns: Array<{ id: string; re: RegExp }>;
};

/**
 * 차단 규칙.
 * 정규식은 "명령형으로 해당 금지 액션을 요청하는 표현" 만 잡도록 보수적으로 작성한다.
 */
const RULES: Rule[] = [
  {
    reason: "mail_send_not_supported",
    user_message:
      "메일 발송은 현재 지원하지 않습니다. 메일 초안 작성이나 메일 내용 정리가 필요하시면 그렇게 요청해 주세요.",
    patterns: [
      { id: "ko_mail_send_imperative", re: /(메일|이메일)\s*(을|를)?\s*(보내|전송|발송)\s*(줘|주세요|달라|해\s*줘|해\s*주세요)/ },
      { id: "en_send_email", re: /\bsend\s+(an?\s+)?(e-?mail|mail)\b/i },
    ],
  },
  {
    reason: "delete_not_supported",
    user_message:
      "삭제는 현재 지원하지 않습니다. 필요한 경우 삭제 대상과 이유를 먼저 정리해 드릴 수 있습니다.",
    patterns: [
      { id: "ko_delete_imperative", re: /(삭제|지워|없애)\s*(줘|주세요|달라|해\s*줘|해\s*주세요)/ },
      { id: "en_delete_this", re: /\bdelete\s+(this|that|the|my|all)\b/i },
    ],
  },
  {
    reason: "share_not_supported",
    user_message:
      "외부 공유/전달은 현재 지원하지 않습니다. 공유할 내용을 정리해 드릴 수는 있습니다.",
    patterns: [
      { id: "ko_share_imperative", re: /(공유|전달|포워딩|포워드)\s*(해\s*줘|해\s*주세요|달라|줘|주세요)/ },
      { id: "en_share_forward", re: /\b(share|forward)\s+(this|that|it|the)\b/i },
    ],
  },
  {
    reason: "web_automation_not_supported",
    user_message:
      "브라우저/웹 자동화는 현재 지원하지 않습니다. 조회·요약 범위 내에서 도와드릴 수 있습니다.",
    patterns: [
      { id: "ko_web_automate", re: /자동\s*(로그인|결제|구매|주문|클릭|댓글|예약)\s*(해\s*줘|해\s*주세요|달라)/ },
      { id: "ko_macro", re: /(매크로|봇)\s*(돌려|실행|구동)/ },
    ],
  },
];

export function evaluateAssistantPreGate(userMessage: string): AssistantPreGateResult {
  const msg = userMessage ?? "";
  for (const rule of RULES) {
    for (const p of rule.patterns) {
      if (p.re.test(msg)) {
        return {
          decision: "block",
          reason: rule.reason,
          matched_pattern: p.id,
          user_message: rule.user_message,
        };
      }
    }
  }
  return { decision: "allow" };
}

// ─────────────────────────────────────────────────────────────────────────────
// save-memo intent 재검증
// ─────────────────────────────────────────────────────────────────────────────

/**
 * assistant 가 `create_pending_action_for_memo` 를 호출하려 할 때
 * 사용자의 현재 턴 메시지가 실제로 저장을 명시적으로 요청(또는 이전 제안에 동의)했는지
 * 서버 측에서 한 번 더 검증한다.
 *
 * 이 게이트가 없으면 모델 단독 판단만으로 pending_action 이 만들어질 수 있다.
 * 자동 장기 기억 금지 / 명시 저장만 허용 정책을 지키기 위한 keyword-level 안전장치다.
 *
 * 패턴은 의도적으로 보수적이다. 애매한 턴은 막히게 두고, 모델은 clarification 으로 되묻는다.
 */
export type SaveMemoIntentEvaluation =
  | { allowed: true; matched_pattern: string }
  | { allowed: false; reason: "no_explicit_save_intent" };

const SAVE_INTENT_PATTERNS: Array<{ id: string; re: RegExp }> = [
  // 명령형 저장
  {
    id: "ko_memo_imperative",
    re: /(메모해|메모로?\s*(남겨|저장|기록)|기록해|저장해|남겨\s*(줘|주세요|둬|둬\s*줘)|적어\s*(둬|줘|주세요)|써\s*(둬|줘|주세요))/,
  },
  // 짧은 동의 표현 (이전 proposal 에 대한 YES)
  {
    id: "ko_confirmation_short",
    re: /^(응|네|예|그래|좋아|좋습니다|맞아|오케이|ok|okay|yes|yep|sure)\s*[.!~,]*\s*(저장|기록|메모|ㄱㄱ|해\s*줘|해\s*주세요)?$/i,
  },
  // 동의 + 저장 지시
  {
    id: "ko_confirmation_with_save",
    re: /(그걸로|그대로|위\s*내용\s*(대로|으로))\s*(저장|메모|기록)/,
  },
  // 영어 명령형
  {
    id: "en_save_imperative",
    re: /\b(save|store|record|remember|memo|note)\s+(this|that|it|the\s+above)\b/i,
  },
];

export function evaluateSaveMemoIntent(
  userMessage: string,
): SaveMemoIntentEvaluation {
  const msg = (userMessage ?? "").trim();
  if (msg.length === 0) {
    return { allowed: false, reason: "no_explicit_save_intent" };
  }
  for (const p of SAVE_INTENT_PATTERNS) {
    if (p.re.test(msg)) {
      return { allowed: true, matched_pattern: p.id };
    }
  }
  return { allowed: false, reason: "no_explicit_save_intent" };
}
