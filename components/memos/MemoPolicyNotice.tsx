/**
 * 장기 저장 메모 ≠ 대화 세션 임시 상태( 정책 상 완전 분리 ).
 */
export default function MemoPolicyNotice() {
  return (
    <aside
      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-overlay)]/90 px-4 py-3 text-sm text-[var(--text-secondary)]"
      role="note"
    >
      <p className="font-medium text-[var(--text-primary)]">장기 저장 메모</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--text-tertiary)]">
        여기에 보이는 글은 Supabase에 올라간, 사용자가 요청·승인한 장기 메모뿐입니다.
        대화(어시스턴트) 내용은 자동으로 메모에 붙지 않으며, 세션과 저장소는 분리되어 있습니다.
        저장은 승인 대기 후 DB 반영입니다.
      </p>
    </aside>
  );
}
