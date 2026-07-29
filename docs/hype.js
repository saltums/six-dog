/*
 * 「この日アツかった！」ボタン。誰でも匿名でタップでき、タップ数がその日のカレンダー詳細に表示される。
 * バックエンドはSupabase(videos/event_linksと同じ構成、追記のみ・削除不可のRLS)。
 * 同じブラウザからの連打を防ぐため、タップ済みの日付はlocalStorageに記録する
 * (別ブラウザ・別端末からの連打までは防げない前提の簡易ガード)。
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

  let countsByDate = null; // Map<event_date, count>

  async function loadHypeIndex() {
    countsByDate = new Map();
    try {
      const res = await fetch(`${CONFIG.url}/rest/v1/event_hype?select=event_date`, { headers: headers() });
      if (!res.ok) return countsByDate;
      const rows = await res.json();
      rows.forEach(row => countsByDate.set(row.event_date, (countsByDate.get(row.event_date) || 0) + 1));
    } catch (e) {
      // 取得できなくても他の機能に影響させない
    }
    return countsByDate;
  }

  function getCount(eventDate) {
    return (countsByDate && countsByDate.get(eventDate)) || 0;
  }

  function storageKey(eventDate) {
    return `sixdog_hyped_${eventDate}`;
  }

  function hasHyped(eventDate) {
    try {
      return localStorage.getItem(storageKey(eventDate)) === "1";
    } catch (e) {
      return false;
    }
  }

  async function tap(eventDate) {
    const res = await fetch(`${CONFIG.url}/rest/v1/event_hype`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify({ event_date: eventDate }),
    });
    if (!res.ok) {
      throw new Error(`送信に失敗しました (${res.status})`);
    }
    try { localStorage.setItem(storageKey(eventDate), "1"); } catch (e) {}
    countsByDate.set(eventDate, getCount(eventDate) + 1);
    return getCount(eventDate);
  }

  function buildHypeButton(eventDate) {
    const wrap = document.createElement("div");
    wrap.className = "hype-wrap";
    const already = hasHyped(eventDate);
    wrap.innerHTML = `
      <button type="button" class="hype-btn${already ? " hyped" : ""}" ${already ? "disabled" : ""}>
        🔥 アツかった<span class="hype-count">${getCount(eventDate)}</span>
      </button>
    `;
    const btn = wrap.querySelector(".hype-btn");
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        const n = await tap(eventDate);
        btn.classList.add("hyped");
        btn.querySelector(".hype-count").textContent = n;
      } catch (e) {
        btn.disabled = false;
      }
    });
    return wrap;
  }

  global.SixDogHype = { loadHypeIndex, getCount, hasHyped, tap, buildHypeButton };
})(window);
