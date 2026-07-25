/*
 * サイトを公開したまま、公演データ・出演者名の呼称を修正できる編集機能。
 *
 * 2種類の仕組みが混在している(意図的):
 * - 公演情報の編集(event_overrides): 誰でもログイン不要でその場で保存できる。
 *   Supabase(videos機能と同じプロジェクト)に直接書き込む。「荒らしはいない」
 *   という前提で、公演データは誰でも編集可能にする方針(ユーザー指示)。
 * - アーティスト名の統合(artist-aliases.json): こちらは従来通りGitHub Contents
 *   API経由でコミットする方式のまま(書き込みには書き込み権限を持つGitHub
 *   Personal Access Tokenが必要)。ランキング集計に影響する操作のため、
 *   オーナーのみが変更できるよう残している。
 */
(function (global) {
  "use strict";

  const CONFIG = {
    owner: "saltums",
    repo: "six-dog",
    branch: "master",
    aliasesPath: "docs/data/artist-aliases.json",
  };
  const SUPABASE = {
    url: "https://fzylksuomkqkrdujueym.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6eWxrc3VvbWtxa3JkdWp1ZXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5NTU5ODcsImV4cCI6MjEwMDUzMTk4N30.D9eORdSj5zkmJDnz8zVDSmMR804PATbWOpDEPChetf0",
  };
  function supabaseHeaders(extra) {
    return Object.assign({ apikey: SUPABASE.anonKey, Authorization: `Bearer ${SUPABASE.anonKey}` }, extra || {});
  }
  const TOKEN_KEY = "sixdog_gh_token";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }
  function setToken(t) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }
  function ensureToken() {
    let t = getToken();
    if (t) return t;
    t = prompt(
      "保存にはこのリポジトリへの書き込み権限を持つ GitHub Personal Access Token が必要です。\n" +
      "(Settings → Developer settings → Fine-grained tokens、Contents: Read and write 権限)\n\n" +
      "このブラウザだけに保存され、GitHub 以外には送信されません。"
    );
    if (t) setToken(t.trim());
    return getToken();
  }
  function clearToken() {
    setToken("");
  }

  function b64EncodeUtf8(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64DecodeUtf8(str) {
    return decodeURIComponent(escape(atob(str)));
  }

  async function githubApi(path, options) {
    const token = ensureToken();
    if (!token) throw new Error("トークンが入力されなかったため中止しました");
    const res = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options && options.headers ? options.headers : {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 401) { clearToken(); }
      throw new Error(`GitHub API エラー (${res.status}): ${body.slice(0, 200)}`);
    }
    return res.json();
  }

  // ---------- 汎用: リポジトリ内のJSONファイルを読み書き ----------

  async function fetchJsonFileAuthed(path) {
    try {
      const data = await githubApi(`contents/${path}?ref=${CONFIG.branch}`, { method: "GET" });
      const text = b64DecodeUtf8(data.content.replace(/\n/g, ""));
      return { json: JSON.parse(text || "{}"), sha: data.sha };
    } catch (e) {
      console.warn(`${path} の取得に失敗、空として扱います`, e);
      return { json: {}, sha: null };
    }
  }

  // 保存APIキーが無くても閲覧はできるよう、公開読み取りは素のfetchで行う
  // (githubApi()はトークン入力を要求してしまうため保存専用)
  async function fetchJsonFilePublic(relativePath) {
    try {
      const res = await fetch(relativePath, { cache: "no-store" });
      if (!res.ok) return {};
      return await res.json();
    } catch (e) {
      return {};
    }
  }

  async function saveJsonFile(path, json, message) {
    const { sha } = await fetchJsonFileAuthed(path);
    const content = b64EncodeUtf8(JSON.stringify(json, null, 2));
    const body = { message, content, branch: CONFIG.branch };
    if (sha) body.sha = sha;
    await githubApi(`contents/${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  // ---------- event_overrides (公演情報の編集、誰でも保存可・Supabase) ----------

  async function fetchOverridesPublic() {
    try {
      const res = await fetch(`${SUPABASE.url}/rest/v1/event_overrides?select=*`, { headers: supabaseHeaders() });
      if (!res.ok) return {};
      const rows = await res.json();
      const overrides = {};
      rows.forEach(row => {
        const patch = {};
        ["title", "open_time", "start_time", "price_adv", "price_door", "price_note", "performers", "notes"].forEach(f => {
          if (row[f] !== null && row[f] !== undefined) patch[f] = row[f];
        });
        overrides[row.event_date] = patch;
      });
      return overrides;
    } catch (e) {
      return {};
    }
  }

  function applyOverrides(events, overrides) {
    if (!overrides || Object.keys(overrides).length === 0) return events;
    return events.map(ev => {
      const patch = overrides[ev.event_date];
      if (!patch) return ev;
      const merged = Object.assign({}, ev, patch);
      merged._edited = true;
      return merged;
    });
  }

  async function saveOverride(originalDate, patch) {
    const row = Object.assign({ event_date: originalDate, updated_at: new Date().toISOString() }, patch);
    const res = await fetch(`${SUPABASE.url}/rest/v1/event_overrides?on_conflict=event_date`, {
      method: "POST",
      headers: supabaseHeaders({
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      }),
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`保存に失敗しました (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return data[0];
  }

  // ---------- artist-aliases.json (出演者名の呼称統合) ----------
  // 表示名(例: "A(アコースティック)")はイベントデータ側に手を付けず残したまま、
  // 集計・検索のときだけ統合先(例: "A")として扱うためのマッピング。
  // { "表示名": "統合先の正式名" } という単純なフラットマップ。

  async function fetchAliasesPublic() {
    return fetchJsonFilePublic("data/artist-aliases.json");
  }

  function resolveCanonicalName(name, aliases) {
    return (aliases && aliases[name]) || name;
  }

  async function saveAliases(aliases) {
    await saveJsonFile(CONFIG.aliasesPath, aliases, "Update artist aliases via web UI");
  }

  // ---------- 編集フォームUI ----------

  function buildEditForm(ev, { onSave, onCancel }) {
    const wrap = document.createElement("div");
    wrap.className = "edit-form";

    const performersText = (ev.performers || []).join("\n");
    wrap.innerHTML = `
      <div class="edit-row">
        <label>タイトル</label>
        <input type="text" data-field="title" value="${escapeAttr(ev.title || "")}" />
      </div>
      <div class="edit-row edit-row-2col">
        <div><label>OPEN</label><input type="text" data-field="open_time" placeholder="17:30" value="${escapeAttr(ev.open_time || "")}" /></div>
        <div><label>START</label><input type="text" data-field="start_time" placeholder="18:00" value="${escapeAttr(ev.start_time || "")}" /></div>
      </div>
      <div class="edit-row edit-row-2col">
        <div><label>adv</label><input type="number" data-field="price_adv" value="${ev.price_adv != null ? ev.price_adv : ""}" /></div>
        <div><label>door</label><input type="number" data-field="price_door" value="${ev.price_door != null ? ev.price_door : ""}" /></div>
      </div>
      <div class="edit-row">
        <label>料金備考</label>
        <input type="text" data-field="price_note" value="${escapeAttr(ev.price_note || "")}" />
      </div>
      <div class="edit-row">
        <label>出演者(1行に1組)</label>
        <textarea data-field="performers" rows="5">${escapeHtmlText(performersText)}</textarea>
      </div>
      <div class="edit-row">
        <label>備考</label>
        <textarea data-field="notes" rows="2">${escapeHtmlText(ev.notes || "")}</textarea>
      </div>
      <div class="edit-actions">
        <button type="button" class="btn-save">保存する</button>
        <button type="button" class="btn-cancel">キャンセル</button>
      </div>
      <div class="edit-status"></div>
    `;

    const statusEl = wrap.querySelector(".edit-status");

    wrap.querySelector(".btn-cancel").addEventListener("click", () => onCancel());
    wrap.querySelector(".btn-save").addEventListener("click", async () => {
      const patch = {};
      wrap.querySelectorAll("[data-field]").forEach(el => {
        const field = el.dataset.field;
        let value = el.value.trim();
        if (field === "performers") {
          patch.performers = value.split("\n").map(s => s.trim()).filter(Boolean);
        } else if (field === "price_adv" || field === "price_door") {
          patch[field] = value === "" ? null : Number(value);
        } else {
          patch[field] = value === "" ? null : value;
        }
      });
      statusEl.textContent = "保存中...";
      try {
        await saveOverride(ev.event_date, patch);
        statusEl.textContent = "保存しました。";
        onSave(Object.assign({}, ev, patch));
      } catch (e) {
        statusEl.textContent = "保存に失敗しました: " + e.message;
      }
    });

    return wrap;
  }

  function escapeAttr(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function escapeHtmlText(s) {
    return String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }

  global.SixDogEditor = {
    fetchOverridesPublic,
    applyOverrides,
    buildEditForm,
    clearToken,
    ensureToken,
    fetchAliasesPublic,
    resolveCanonicalName,
    saveAliases,
  };
})(window);
