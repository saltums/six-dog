/*
 * 出演者(公演ごと)に動画URLを紐づけて、誰でもリアルタイムに閲覧・投稿できる機能。
 * バックエンドは Supabase(Postgres + PostgREST)。ここで使う anon key は
 * クライアント側に埋め込む前提の公開鍵で、Row Level Security により
 * 「閲覧・投稿・更新は誰でも可、削除は不可」に制限されている
 * (Supabase側の videos テーブルのポリシー参照)。
 */
(function (global) {
  "use strict";

  const CONFIG = {
    url: "https://fzylksuomkqkrdujueym.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6eWxrc3VvbWtxa3JkdWp1ZXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5NTU5ODcsImV4cCI6MjEwMDUzMTk4N30.D9eORdSj5zkmJDnz8zVDSmMR804PATbWOpDEPChetf0",
  };

  function headers(extra) {
    return Object.assign({
      apikey: CONFIG.anonKey,
      Authorization: `Bearer ${CONFIG.anonKey}`,
    }, extra || {});
  }

  async function fetchVideos(eventDate, performerName) {
    const params = new URLSearchParams({
      select: "*",
      event_date: `eq.${eventDate}`,
      performer_name: `eq.${performerName}`,
      order: "submitted_at.desc",
    });
    const res = await fetch(`${CONFIG.url}/rest/v1/videos?${params.toString()}`, { headers: headers() });
    if (!res.ok) return [];
    return res.json();
  }

  async function submitVideo(row) {
    const res = await fetch(`${CONFIG.url}/rest/v1/videos`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`投稿に失敗しました (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return data[0];
  }

  function extractYouTubeId(url) {
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function formatDate(iso) {
    try { return new Date(iso).toLocaleDateString("ja-JP"); } catch (e) { return iso; }
  }

  function buildVideoPanel(eventDate, performerName) {
    const wrap = document.createElement("div");
    wrap.className = "video-panel";
    wrap.innerHTML = `
      <div class="video-panel-head">
        <span class="video-panel-title">🎬 ${escapeHtml(performerName)} の動画</span>
        <button type="button" class="video-panel-close" aria-label="閉じる">✕</button>
      </div>
      <div class="video-list"></div>
      <div class="video-form">
        <input type="text" class="v-url" placeholder="動画URL(YouTubeなど)" autocomplete="off" />
        <input type="text" class="v-by" placeholder="投稿者名(任意)" autocomplete="off" />
        <textarea class="v-notes" rows="2" placeholder="コメント(任意)"></textarea>
        <button type="button" class="v-submit">投稿する</button>
        <span class="video-status"></span>
      </div>
    `;
    const listEl = wrap.querySelector(".video-list");
    const statusEl = wrap.querySelector(".video-status");

    async function reload() {
      listEl.innerHTML = `<div class="panel-sub">読み込み中...</div>`;
      let videos = [];
      try {
        videos = await fetchVideos(eventDate, performerName);
      } catch (e) {
        listEl.innerHTML = `<div class="panel-sub">読み込みに失敗しました</div>`;
        return;
      }
      if (!videos.length) {
        listEl.innerHTML = `<div class="panel-sub">まだ投稿された動画はありません。最初の投稿者になりましょう。</div>`;
        return;
      }
      listEl.innerHTML = "";
      videos.forEach(v => {
        const item = document.createElement("div");
        item.className = "video-item";
        const ytId = extractYouTubeId(v.video_url);
        item.innerHTML = `
          ${ytId ? `<div class="video-embed"><iframe src="https://www.youtube.com/embed/${ytId}" loading="lazy" allow="encrypted-media" allowfullscreen title="${escapeHtml(performerName)}の動画"></iframe></div>` : ""}
          <a class="video-link" href="${encodeURI(v.video_url)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(v.video_url)} ↗</a>
          <div class="video-meta">${v.submitted_by ? escapeHtml(v.submitted_by) + " — " : ""}${formatDate(v.submitted_at)}</div>
          ${v.notes ? `<div class="video-notes">${escapeHtml(v.notes)}</div>` : ""}
        `;
        listEl.appendChild(item);
      });
    }

    wrap.querySelector(".video-panel-close").addEventListener("click", () => wrap.remove());
    wrap.querySelector(".v-submit").addEventListener("click", async () => {
      const urlInput = wrap.querySelector(".v-url");
      const byInput = wrap.querySelector(".v-by");
      const notesInput = wrap.querySelector(".v-notes");
      const url = urlInput.value.trim();
      const by = byInput.value.trim();
      const notes = notesInput.value.trim();
      if (!url) { statusEl.textContent = "URLを入力してください"; return; }
      if (!/^https?:\/\//i.test(url)) { statusEl.textContent = "http(s):// から始まるURLを入力してください"; return; }
      statusEl.textContent = "投稿中...";
      try {
        await submitVideo({
          event_date: eventDate,
          performer_name: performerName,
          video_url: url,
          submitted_by: by || null,
          notes: notes || null,
        });
        urlInput.value = "";
        byInput.value = "";
        notesInput.value = "";
        statusEl.textContent = "投稿しました！";
        reload();
      } catch (e) {
        statusEl.textContent = e.message;
      }
    });

    reload();
    return wrap;
  }

  global.SixDogVideos = { buildVideoPanel };
})(window);
