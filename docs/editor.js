/*
 * サイトを公開したまま、GitHub API経由でイベントデータを直接修正できる編集機能。
 *
 * 仕組み:
 * - 修正内容は docs/data/manual-overrides.json (event_dateをキーにした差分)に
 *   GitHub Contents API 経由でコミットされる。以後、そのコミットが反映された
 *   時点(Pagesの再ビルド後)で全訪問者に表示される。
 * - 書き込みには GitHub Personal Access Token(このリポジトリへの書き込み権限)が
 *   必要。トークンは「保存」時に一度だけ入力を求め、ブラウザの localStorage に
 *   保存されるだけで、GitHub の API 以外のどこにも送信されない。トークンを
 *   持たない一般の訪問者は編集フォーム自体は開けるが、保存時にトークンを
 *   持っていないため保存できない(=事実上、書き込み権限を持つ人だけが編集できる)。
 * - パーサーを再実行して data/events.json を作り直しても、次にこのファイルを
 *   マージすればここでの修正は失われない(Parse-Events.ps1 側の対応は別途)。
 */
(function (global) {
  "use strict";

  const CONFIG = {
    owner: "saltums",
    repo: "six-dog",
    branch: "master",
    overridesPath: "docs/data/manual-overrides.json",
    aliasesPath: "docs/data/artist-aliases.json",
  };
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

  // ---------- manual-overrides.json (イベントごとの修正差分) ----------

  async function fetchOverridesPublic() {
    return fetchJsonFilePublic("data/manual-overrides.json");
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
    const { json: overrides } = await fetchJsonFileAuthed(CONFIG.overridesPath);
    overrides[originalDate] = Object.assign({}, overrides[originalDate] || {}, patch);
    await saveJsonFile(CONFIG.overridesPath, overrides, `Edit event ${originalDate} via web UI`);
    return overrides[originalDate];
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
        <button type="button" class="btn-save">保存(GitHubにコミット)</button>
        <button type="button" class="btn-cancel">キャンセル</button>
        <button type="button" class="btn-token">トークン設定</button>
      </div>
      <div class="edit-status"></div>
    `;

    const statusEl = wrap.querySelector(".edit-status");

    wrap.querySelector(".btn-cancel").addEventListener("click", () => onCancel());
    wrap.querySelector(".btn-token").addEventListener("click", () => {
      clearToken();
      ensureToken();
    });
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
        statusEl.textContent = "保存しました。GitHub Pagesの再ビルド後(数分)に公開反映されます。";
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
