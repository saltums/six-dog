/*
 * 公演に関連するブログ記事(出演者本人や観客が書いたライブレポなど)を
 * 公演詳細にリンク表示する。当日ツイートと違いブログはoEmbedが使えないため、
 * 記事タイトル+リンクのみのシンプルな表示にする(画像や本文は複製しない)。
 * 動画URL・当日ツイートと同様、Supabaseの event_links テーブルに誰でも
 * ログイン不要で読み書きできる。
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

  let linksByDate = null; // Map<event_date, Array<{id, url, title}>>

  async function loadLinkIndex() {
    linksByDate = new Map();
    try {
      const res = await fetch(`${SUPABASE.url}/rest/v1/event_links?select=id,event_date,url,title&order=submitted_at.asc`, { headers: headers() });
      if (!res.ok) return linksByDate;
      const rows = await res.json();
      rows.forEach(row => {
        const list = linksByDate.get(row.event_date) || [];
        list.push({ id: row.id, url: row.url, title: row.title });
        linksByDate.set(row.event_date, list);
      });
    } catch (e) {
      // データが無くても他の機能に影響させない
    }
    return linksByDate;
  }

  function hasLink(eventDate) {
    return !!(linksByDate && linksByDate.get(eventDate) || []).length;
  }

  function getLinks(eventDate) {
    return (linksByDate && linksByDate.get(eventDate)) || [];
  }

  async function fetchPageTitle(url) {
    // ブログ側にCORS制限があることが多く、ほぼ確実に失敗する。
    // その場合はURLホスト名をタイトル代わりに使う。
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error("blocked");
      const text = await res.text();
      const m = text.match(/<title[^>]*>([^<]*)<\/title>/i);
      return m ? m[1].trim() : null;
    } catch (e) {
      return null;
    }
  }

  async function linkArticle(eventDate, url, title) {
    const res = await fetch(`${SUPABASE.url}/rest/v1/event_links`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
      body: JSON.stringify({ event_date: eventDate, url, title: title || null }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`紐付けに失敗しました (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return data[0];
  }

  async function unlinkArticle(rowId) {
    const res = await fetch(`${SUPABASE.url}/rest/v1/event_links?id=eq.${rowId}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) throw new Error(`解除に失敗しました (${res.status})`);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function buildLinkPanel(eventDate) {
    if (!linksByDate) await loadLinkIndex();

    const wrap = document.createElement("div");
    wrap.className = "tweet-panel";
    wrap.innerHTML = `
      <div class="tweet-panel-title">🔗 関連URL</div>
      <div class="link-list"></div>
      <div class="tweet-form">
        <input type="text" class="lk-url" placeholder="関連ページのURL" autocomplete="off" />
        <input type="text" class="lk-title" placeholder="タイトル(任意)" autocomplete="off" />
        <button type="button" class="lk-submit">紐付ける</button>
        <span class="tweet-status"></span>
      </div>
    `;
    const listEl = wrap.querySelector(".link-list");
    const statusEl = wrap.querySelector(".tweet-status");

    function renderOne(row) {
      const item = document.createElement("div");
      item.className = "link-item";
      const label = row.title || row.url;
      item.innerHTML = `
        <a href="${escapeHtml(row.url)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(label)} ↗</a>
        <button type="button" class="tweet-unlink" title="この紐付けを解除">✕ 解除</button>
      `;
      listEl.appendChild(item);
      item.querySelector(".tweet-unlink").addEventListener("click", async () => {
        try {
          await unlinkArticle(row.id);
          item.remove();
          const list = linksByDate.get(eventDate) || [];
          linksByDate.set(eventDate, list.filter(r => r.id !== row.id));
        } catch (e) {
          alert(e.message);
        }
      });
    }

    (linksByDate.get(eventDate) || []).forEach(renderOne);

    wrap.querySelector(".lk-submit").addEventListener("click", async () => {
      const urlInput = wrap.querySelector(".lk-url");
      const titleInput = wrap.querySelector(".lk-title");
      const url = urlInput.value.trim();
      if (!url) { statusEl.textContent = "記事のURLを入力してください"; return; }
      if (!/^https?:\/\//i.test(url)) { statusEl.textContent = "http(s):// から始まるURLを入力してください"; return; }
      statusEl.textContent = "紐付け中...";
      try {
        const title = titleInput.value.trim() || await fetchPageTitle(url);
        const row = await linkArticle(eventDate, url, title);
        const list = linksByDate.get(eventDate) || [];
        list.push({ id: row.id, url: row.url, title: row.title });
        linksByDate.set(eventDate, list);
        renderOne({ id: row.id, url: row.url, title: row.title });
        urlInput.value = "";
        titleInput.value = "";
        statusEl.textContent = "紐付けました！";
      } catch (e) {
        statusEl.textContent = e.message;
      }
    });

    return wrap;
  }

  global.SixDogLinks = { buildLinkPanel, loadLinkIndex, hasLink, getLinks };
})(window);
