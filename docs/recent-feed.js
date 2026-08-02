/*
 * トップページ(年選択ハブ)に出す「最近追加された情報」の簡易フィード。
 * debug.html「変更履歴」タブと同じデータ(event_overrides/event_links/videos)を
 * 使うが、こちらは検索・フィルタ無しでログイン不要、直近数件だけを見せる
 * 公開版。「みんなが情報を足してくれている」実感を伝えるのが目的。
 */
(function (global) {
  "use strict";

  const CONFIG = {
    url: "https://fzylksuomkqkrdujueym.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6eWxrc3VvbWtxa3JkdWp1ZXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5NTU5ODcsImV4cCI6MjEwMDUzMTk4N30.D9eORdSj5zkmJDnz8zVDSmMR804PATbWOpDEPChetf0",
  };
  function headers() {
    return { apikey: CONFIG.anonKey, Authorization: `Bearer ${CONFIG.anonKey}` };
  }

  function summarizePerformers(performers) {
    if (!Array.isArray(performers) || !performers.length) return "";
    return performers.length > 3 ? performers.slice(0, 3).join("、") + " 他" : performers.join("、");
  }

  function relativeTime(ts) {
    const diffMs = Date.now() - new Date(ts).getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 60) return `${Math.max(min, 0)}分前`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour}時間前`;
    const day = Math.floor(hour / 24);
    if (day < 30) return `${day}日前`;
    return new Date(ts).toISOString().slice(0, 10);
  }

  async function fetchRecent(limit) {
    const perSource = limit * 2;
    let overrides = [], links = [], videos = [];
    try {
      const [overridesRes, linksRes, videosRes] = await Promise.all([
        fetch(`${CONFIG.url}/rest/v1/event_overrides?select=event_date,title,performers,updated_at&order=updated_at.desc&limit=${perSource}`, { headers: headers() }),
        fetch(`${CONFIG.url}/rest/v1/event_links?select=event_date,title,submitted_at&order=submitted_at.desc&limit=${perSource}`, { headers: headers() }),
        fetch(`${CONFIG.url}/rest/v1/videos?select=event_date,performer_name,video_title,submitted_at&order=submitted_at.desc&limit=${perSource}`, { headers: headers() }),
      ]);
      overrides = overridesRes.ok ? await overridesRes.json() : [];
      links = linksRes.ok ? await linksRes.json() : [];
      videos = videosRes.ok ? await videosRes.json() : [];
    } catch (e) {
      return [];
    }

    const entries = [];
    overrides.forEach(o => {
      const label = o.title || summarizePerformers(o.performers) || "公演情報";
      entries.push({ timestamp: o.updated_at, eventDate: o.event_date, text: `「${label}」の情報を追加・更新` });
    });
    links.forEach(l => {
      entries.push({ timestamp: l.submitted_at, eventDate: l.event_date, text: `${l.event_date} に関連リンクを追加` });
    });
    videos.forEach(v => {
      entries.push({ timestamp: v.submitted_at, eventDate: v.event_date, text: `${v.event_date} ${v.performer_name || ""}の動画を追加` });
    });
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return entries.slice(0, limit);
  }

  function buildFeed(entries) {
    const wrap = document.createElement("div");
    wrap.className = "recent-feed";
    if (!entries.length) return wrap;
    const heading = document.createElement("div");
    heading.className = "recent-feed-heading";
    heading.textContent = "📝 最近追加された情報";
    wrap.appendChild(heading);
    entries.forEach(e => {
      const a = document.createElement("a");
      a.className = "recent-feed-item";
      a.href = `index.html?date=${encodeURIComponent(e.eventDate)}`;
      a.innerHTML = `<span class="recent-feed-text"></span><span class="recent-feed-time"></span>`;
      a.querySelector(".recent-feed-text").textContent = e.text;
      a.querySelector(".recent-feed-time").textContent = relativeTime(e.timestamp);
      wrap.appendChild(a);
    });
    return wrap;
  }

  global.SixDogRecentFeed = { fetchRecent, buildFeed };
})(window);
