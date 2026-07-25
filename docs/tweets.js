/*
 * 公演当日にSiX-DOG公式Xアカウント(@shinsakae6dog)が投稿した告知ツイートを
 * 公演詳細に埋め込み表示する。ツイートには当日の看板・フライヤー写真が
 * 添付されていることが多く、元サイトのスクレイピングだけでは分からない
 * 出演者変更やイベントの雰囲気を補完できる。
 *
 * 写真そのものはこちらでは複製せず、X公式のoEmbed API(publish.x.com)経由で
 * その場に埋め込み表示する(docs/data/tweets.jsonは日付とツイートIDの対応表のみ)。
 */
(function (global) {
  "use strict";

  let tweetsByDate = null;

  async function loadTweetIndex() {
    if (tweetsByDate) return tweetsByDate;
    tweetsByDate = new Map();
    try {
      const res = await fetch("data/tweets.json", { cache: "no-store" });
      const rows = await res.json();
      rows.forEach(row => {
        const list = tweetsByDate.get(row.event_date) || [];
        list.push(row.tweet_id);
        tweetsByDate.set(row.event_date, list);
      });
    } catch (e) {
      // データが無くても他の機能に影響させない
    }
    return tweetsByDate;
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
    return !!(tweetsByDate && tweetsByDate.has(eventDate));
  }

  async function buildTweetPanel(eventDate) {
    const byDate = await loadTweetIndex();
    const ids = byDate.get(eventDate);
    if (!ids || !ids.length) return null;

    const wrap = document.createElement("div");
    wrap.className = "tweet-panel";
    wrap.innerHTML = `<div class="tweet-panel-title">🐦 当日の告知ポスト</div><div class="tweet-list"></div>`;
    const listEl = wrap.querySelector(".tweet-list");

    for (const id of ids) {
      const holder = document.createElement("div");
      holder.className = "tweet-embed";
      holder.innerHTML = `<div class="panel-sub">読み込み中...</div>`;
      listEl.appendChild(holder);
      try {
        const html = await fetchOEmbedHtml(id);
        holder.innerHTML = html;
      } catch (e) {
        holder.innerHTML = `<a href="https://x.com/shinsakae6dog/status/${id}" target="_blank" rel="noopener noreferrer nofollow">元ツイートを見る ↗</a>`;
      }
    }

    await ensureWidgetsScript();
    if (global.twttr && global.twttr.widgets) {
      global.twttr.widgets.load(wrap);
    }
    return wrap;
  }

  global.SixDogTweets = { buildTweetPanel, loadTweetIndex, hasTweet };
})(window);
