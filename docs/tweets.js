/*
 * 公演当日にSiX-DOG公式Xアカウント(@shinsakae6dog)が投稿した告知ツイートを
 * 公演詳細に埋め込み表示する。ツイートには当日の看板・フライヤー写真が
 * 添付されていることが多く、元サイトのスクレイピングだけでは分からない
 * 出演者変更やイベントの雰囲気を補完できる。
 *
 * 写真そのものはこちらでは複製せず、X公式のoEmbed API(publish.x.com)経由で
 * その場に埋め込み表示する。対応表はSupabaseの event_tweets テーブルに保持し、
 * 動画URL投稿機能と同様に誰でもログイン不要でツイートの紐付け・解除ができる
 * (videosテーブルと違い、こちらは間違って紐付けた時に誰でも解除できるよう
 * 削除も許可している)。
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

  let tweetsByDate = null; // Map<event_date, Array<{id, tweet_id}>>

  async function loadTweetIndex() {
    tweetsByDate = new Map();
    try {
      const res = await fetch(`${SUPABASE.url}/rest/v1/event_tweets?select=id,event_date,tweet_id&order=submitted_at.asc`, { headers: headers() });
      if (!res.ok) return tweetsByDate;
      const rows = await res.json();
      rows.forEach(row => {
        const list = tweetsByDate.get(row.event_date) || [];
        list.push({ id: row.id, tweet_id: row.tweet_id });
        tweetsByDate.set(row.event_date, list);
      });
    } catch (e) {
      // データが無くても他の機能に影響させない
    }
    return tweetsByDate;
  }

  function extractTweetId(input) {
    const s = input.trim();
    const m = s.match(/status\/(\d+)/);
    if (m) return m[1];
    if (/^\d+$/.test(s)) return s;
    return null;
  }

  async function linkTweet(eventDate, tweetId) {
    const res = await fetch(`${SUPABASE.url}/rest/v1/event_tweets`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
      body: JSON.stringify({ event_date: eventDate, tweet_id: tweetId }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`紐付けに失敗しました (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return data[0];
  }

  async function unlinkTweet(rowId) {
    const res = await fetch(`${SUPABASE.url}/rest/v1/event_tweets?id=eq.${rowId}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) throw new Error(`解除に失敗しました (${res.status})`);
  }

  async function fetchOEmbedHtml(tweetId) {
    const url = `https://x.com/shinsakae6dog/status/${tweetId}`;
    const endpoint = `https://publish.x.com/oembed?url=${encodeURIComponent(url)}&omit_script=true&dnt=true&lang=ja`;
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`oEmbed取得失敗 (${res.status})`);
    const data = await res.json();
    return data.html;
  }

  function ensureWidgetsScript() {
    if (global.twttr && global.twttr.widgets) return Promise.resolve();
    if (document.getElementById("twitter-wjs")) {
      return new Promise(resolve => {
        const check = () => (global.twttr && global.twttr.widgets ? resolve() : setTimeout(check, 100));
        check();
      });
    }
    return new Promise(resolve => {
      const script = document.createElement("script");
      script.id = "twitter-wjs";
      script.src = "https://platform.twitter.com/widgets.js";
      script.async = true;
      script.onload = resolve;
      document.body.appendChild(script);
    });
  }

  function hasTweet(eventDate) {
    return !!(tweetsByDate && tweetsByDate.get(eventDate) || []).length;
  }

  async function renderEmbed(holder, tweetId) {
    holder.innerHTML = `<div class="panel-sub">読み込み中...</div>`;
    try {
      const html = await fetchOEmbedHtml(tweetId);
      const embedBox = document.createElement("div");
      embedBox.innerHTML = html;
      holder.innerHTML = "";
      holder.appendChild(embedBox);
    } catch (e) {
      holder.innerHTML = `<a href="https://x.com/shinsakae6dog/status/${tweetId}" target="_blank" rel="noopener noreferrer nofollow">元ツイートを見る ↗</a>`;
    }
    await ensureWidgetsScript();
    if (global.twttr && global.twttr.widgets) global.twttr.widgets.load(holder);
  }

  async function buildTweetPanel(eventDate) {
    if (!tweetsByDate) await loadTweetIndex();

    const wrap = document.createElement("div");
    wrap.className = "tweet-panel";
    wrap.innerHTML = `
      <div class="tweet-panel-title">🐦 当日の告知ポスト</div>
      <div class="tweet-list"></div>
      <div class="tweet-form">
        <input type="text" class="tw-url" placeholder="X(旧Twitter)投稿のURL" autocomplete="off" />
        <button type="button" class="tw-submit">紐付ける</button>
        <span class="tweet-status"></span>
      </div>
    `;
    const listEl = wrap.querySelector(".tweet-list");
    const statusEl = wrap.querySelector(".tweet-status");

    function renderOne(row) {
      const item = document.createElement("div");
      item.className = "tweet-embed";
      item.innerHTML = `<button type="button" class="tweet-unlink" title="この紐付けを解除">✕ 解除</button><div class="tweet-embed-body"></div>`;
      listEl.appendChild(item);
      item.querySelector(".tweet-unlink").addEventListener("click", async () => {
        try {
          await unlinkTweet(row.id);
          item.remove();
          const list = tweetsByDate.get(eventDate) || [];
          tweetsByDate.set(eventDate, list.filter(r => r.id !== row.id));
        } catch (e) {
          alert(e.message);
        }
      });
      renderEmbed(item.querySelector(".tweet-embed-body"), row.tweet_id);
    }

    (tweetsByDate.get(eventDate) || []).forEach(renderOne);

    wrap.querySelector(".tw-submit").addEventListener("click", async () => {
      const input = wrap.querySelector(".tw-url");
      const tweetId = extractTweetId(input.value);
      if (!tweetId) { statusEl.textContent = "投稿のURL(またはID)を入力してください"; return; }
      statusEl.textContent = "紐付け中...";
      try {
        const row = await linkTweet(eventDate, tweetId);
        const list = tweetsByDate.get(eventDate) || [];
        list.push({ id: row.id, tweet_id: row.tweet_id });
        tweetsByDate.set(eventDate, list);
        renderOne({ id: row.id, tweet_id: row.tweet_id });
        input.value = "";
        statusEl.textContent = "紐付けました！";
      } catch (e) {
        statusEl.textContent = e.message;
      }
    });

    return wrap;
  }

  global.SixDogTweets = { buildTweetPanel, loadTweetIndex, hasTweet };
})(window);
