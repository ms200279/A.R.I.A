/**
 * Supabase 생성 타입의 자리.
 *
 * 이 파일은 나중에 `supabase gen types typescript --linked` 의 결과로
 * 자동 생성된 내용으로 덮여쓰기 될 예정이다. 지금은 비어 있는 Database 타입으로 자리만 잡는다.
 *
 * 생성 명령 (예정):
 *   supabase gen types typescript --linked > types/supabase.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
