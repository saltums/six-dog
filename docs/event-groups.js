/*
 * イベント名のグルーピング(同じ企画シリーズの別回をまとめる)のデータ層。
 * 動画URL・当日ツイート紐付けと同様、Supabaseの event_title_groups テーブルに
 * 誰でもログイン不要で読み書きできる({variant_title, group_name}のフラットな
 * マッピング)。UI側(event-groups-admin.js)はこのモジュールの関数だけを使う。
 */
(function (global) {
  "use strict";

  const SUPABASE = {
    url: "https://fzylksuomkqkrdujueym.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6eWxrc3VvbWtxa3JkdWp1ZXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5NTU5ODcsImV4cCI6MjEwMDUzMTk4N30.D9eORdSj5zkmJDnz8zVDSmMR804PATbWOpDEPChetf0",
  };
  function headers(extra) {
    return Object.assign({ apikey: SUPABASE.anonKey, Authorization: `Bearer ${SUPABASE.anonKey}` }, extra || {});
  }

  async function fetchGroupRows() {
    try {
      const res = await fetch(`${SUPABASE.url}/rest/v1/event_title_groups?select=id,variant_title,group_name&order=submitted_at.asc`, { headers: headers() });
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  }

  async function fetchGroupsMap() {
    const rows = await fetchGroupRows();
    const map = {};
    rows.forEach(r => { map[r.variant_title] = r.group_name; });
    return map;
  }

  async function linkGroup(variantTitle, groupName) {
    const res = await fetch(`${SUPABASE.url}/rest/v1/event_title_groups?on_conflict=variant_title`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify({ variant_title: variantTitle, group_name: groupName }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`保存に失敗しました (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return data[0];
  }

  async function unlinkGroup(rowId) {
    const res = await fetch(`${SUPABASE.url}/rest/v1/event_title_groups?id=eq.${rowId}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) throw new Error(`解除に失敗しました (${res.status})`);
  }

  global.SixDogEventGroups = { fetchGroupRows, fetchGroupsMap, linkGroup, unlinkGroup };
})(window);
