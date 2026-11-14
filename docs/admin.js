/*
 * 管理者用:みんなの投稿(動画・関連URL・告知ポスト・公演情報の修正/追加・反応)を削除する画面。
 * パスワードはサーバー側の関数(supabase/admin.sql)でだけ確かめる。このファイルには書かない。
 * ログイン中は、このタブを閉じるまでパスワードを sessionStorage に置いておく(閉じれば消える)。
 */
(function (global) {
  "use strict";
  const X = global.SixDogSupabase;
  const KEY = "sixdog_admin_pw";
  const headers = extra => Object.assign({ apikey: X.anonKey, Authorization: `Bearer ${X.anonKey}` }, extra || {});
  const rpc = (fn, body) => fetch(`${X.url}/rest/v1/rpc/${fn}`, { method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify(body || {}) })
    .then(r => r.ok ? r.json() : r.text().then(t => { throw new Error(t || r.status); }));
  const get = (table, q) => fetch(`${X.rest(table)}?${q}`, { headers: headers() }).then(r => r.ok ? r.json() : []);

  const pw = () => { try { return sessionStorage.getItem(KEY) || ""; } catch (e) { return ""; } };
  const setPw = v => { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch (e) { /* 保存できない環境 */ } };
  const MSG = { wrong: "パスワードが違います。", locked: "間違いが続いたので、10分ほど受け付けません。", not_set: "まだ管理パスワードが設定されていません。", too_short: "8文字以上にしてください。", already_set: "管理パスワードはすでに設定されています。" };

  const status = () => rpc("sixdog_admin_status");
  const setup = p => rpc("sixdog_admin_setup", { p_new: p });
  const login = p => rpc("sixdog_admin_login", { p_pass: p });
  const change = (p, n) => rpc("sixdog_admin_change", { p_pass: p, p_new: n });
  const remove = (kind, key) => rpc("sixdog_admin_delete", { p_pass: pw(), p_kind: kind, p_key: String(key) });

  // 一覧(新しい順)。反応は数が多くなりやすいので直近だけ
  async function fetchAll() {
    const [videos, links, tweets, overrides, hype, emoi] = await Promise.all([
      get("videos", "select=id,event_date,performer_name,video_title,video_url,submitted_by,submitted_at&order=submitted_at.desc&limit=1000"),
      get("event_links", "select=id,event_date,title,url,submitted_at&order=submitted_at.desc&limit=1000"),
      get("event_tweets", "select=id,event_date,tweet_id,submitted_at&order=submitted_at.desc&limit=1000"),
      get("event_overrides", "select=event_date,title,performers,updated_at&order=updated_at.desc&limit=1000"),
      get("event_hype", "select=id,event_date,created_at&order=created_at.desc&limit=300"),
      get("event_emoi", "select=id,event_date,created_at&order=created_at.desc&limit=300"),
    ]);
    return { videos, links, tweets, overrides, hype, emoi };
  }

  global.SixDogAdmin = { pw, setPw, MSG, status, setup, login, change, remove, fetchAll, isIn: () => !!pw() };
})(window);
