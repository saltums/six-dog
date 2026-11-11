/*
 * Supabase の接続先をこの1ファイルに集約している。DBを引っ越すときは
 * ここだけ書き換えればサイト全体と scripts/Export-Supabase.ps1 の両方が追従する。
 *
 * anonKey はクライアントに埋め込む前提の公開鍵(各テーブルの権限は Row Level
 * Security で制御)。tablePrefix は、他アプリと同居しているプロジェクトで
 * テーブル名の衝突を避けるための接頭辞。
 */
(function (global) {
  "use strict";

  // 2026-11-11: 元のプロジェクト(fzylksuomkqkrdujueym)が無料枠の自動停止に
  // かかったため、他アプリと同居する various_apps プロジェクトへ引っ越した
  const url = "https://bcxwfosythkuwdmkwkkj.supabase.co";
  const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjeHdmb3N5dGhrdXdkbWt3a2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NzE1ODUsImV4cCI6MjEwNzQ0NzU4NX0.8rJ0UZmMBdu9wge735h6eGTUiQNUm0TYrl9y5_wxk3k";
  const tablePrefix = "sixdog_";

  global.SixDogSupabase = {
    url,
    anonKey,
    tablePrefix,
    // 論理テーブル名から REST エンドポイントの URL を作る
    rest(table) {
      return `${url}/rest/v1/${tablePrefix}${table}`;
    },
  };
})(window);
