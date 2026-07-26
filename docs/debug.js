(function () {
  "use strict";

  const PASSWORD = "1640925a";
  const SESSION_KEY = "sixdog_debug_unlocked";

  const SUPABASE = {
    url: "https://fzylksuomkqkrdujueym.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6eWxrc3VvbWtxa3JkdWp1ZXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5NTU5ODcsImV4cCI6MjEwMDUzMTk4N30.D9eORdSj5zkmJDnz8zVDSmMR804PATbWOpDEPChetf0",
  };
  function supabaseHeaders() {
    return { apikey: SUPABASE.anonKey, Authorization: `Bearer ${SUPABASE.anonKey}` };
  }

  const gateWrap = document.getElementById("gateWrap");
  const gateForm = document.getElementById("gateForm");
  const gatePassword = document.getElementById("gatePassword");
  const gateStatus = document.getElementById("gateStatus");
  const debugWrap = document.getElementById("debugWrap");
  const debugSub = document.getElementById("debugSub");
  const debugFilter = document.getElementById("debugFilter");
  const debugList = document.getElementById("debugList");

  let rows = [];
  let videosByDate = new Map();

  async function fetchAllVideos() {
    try {
      const res = await fetch(`${SUPABASE.url}/rest/v1/videos?select=event_date,performer_name,video_url,video_title&order=event_date.asc`, { headers: supabaseHeaders() });
      if (!res.ok) return new Map();
      const data = await res.json();
      const map = new Map();
      data.forEach(v => {
        if (!map.has(v.event_date)) map.set(v.event_date, []);
        map.get(v.event_date).push(v);
      });
      return map;
    } catch (e) {
      return new Map();
    }
  }

  function formatSnapshotTimestamp(ts) {
    if (!ts || ts.length < 8) return ts || "";
    return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
  }

  function sourceKind(ev) {
    if (ev._synthetic) return "ブログ等より復元";
    if (ev.date_confidence === "estimated") return "月・年は推定";
    return "スナップショット記録あり";
  }

  function renderTable(filterText) {
    const q = (filterText || "").trim().toLowerCase();
    const filtered = q
      ? rows.filter(ev => ev.event_date.includes(q) || (ev.title || "").toLowerCase().includes(q))
      : rows;

    debugSub.textContent = `全${rows.length}件中 ${filtered.length}件を表示`;

    if (!filtered.length) {
      debugList.innerHTML = `<div class="panel-sub">該当する公演はありません</div>`;
      return;
    }

    const table = document.createElement("table");
    table.className = "data-table";
    table.innerHTML = `<thead><tr><th>日付</th><th>タイトル</th><th>種別</th><th>スナップショット日時</th><th>元ページ</th><th>関連URL</th><th>動画</th><th>編集済み</th><th>備考</th></tr></thead><tbody></tbody>`;
    const tbody = table.querySelector("tbody");
    const getLinks = window.SixDogLinks ? window.SixDogLinks.getLinks : () => [];
    filtered.forEach(ev => {
      const tr = document.createElement("tr");
      tr.style.cursor = "default";

      const dateTd = document.createElement("td");
      dateTd.textContent = ev.event_date;

      const titleTd = document.createElement("td");
      titleTd.textContent = ev.title || "(タイトル不明)";

      const kindTd = document.createElement("td");
      kindTd.textContent = sourceKind(ev);

      const snapTd = document.createElement("td");
      snapTd.textContent = formatSnapshotTimestamp(ev.source_snapshot_timestamp);

      const urlTd = document.createElement("td");
      if (ev.source_snapshot_url) {
        const a = document.createElement("a");
        a.href = ev.source_snapshot_url;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "Wayback Machine ↗";
        urlTd.appendChild(a);
      } else {
        urlTd.textContent = "—";
      }

      const linksTd = document.createElement("td");
      const links = getLinks(ev.event_date);
      if (links.length) {
        links.forEach((row, i) => {
          if (i > 0) linksTd.appendChild(document.createElement("br"));
          const a = document.createElement("a");
          a.href = row.url;
          a.target = "_blank";
          a.rel = "noopener";
          a.textContent = (row.title || row.url) + " ↗";
          linksTd.appendChild(a);
        });
      } else {
        linksTd.textContent = "—";
      }

      const videosTd = document.createElement("td");
      const videos = videosByDate.get(ev.event_date) || [];
      if (videos.length) {
        videos.forEach((v, i) => {
          if (i > 0) videosTd.appendChild(document.createElement("br"));
          const a = document.createElement("a");
          a.href = v.video_url;
          a.target = "_blank";
          a.rel = "noopener";
          a.textContent = `${v.performer_name || "?"}: ${v.video_title || v.video_url} ↗`;
          videosTd.appendChild(a);
        });
      } else {
        videosTd.textContent = "—";
      }

      const editedTd = document.createElement("td");
      editedTd.textContent = ev._edited ? "✓" : "";

      const notesTd = document.createElement("td");
      notesTd.textContent = ev.notes || "—";
      notesTd.style.maxWidth = "260px";
      notesTd.style.whiteSpace = "normal";

      tr.appendChild(dateTd);
      tr.appendChild(titleTd);
      tr.appendChild(kindTd);
      tr.appendChild(snapTd);
      tr.appendChild(urlTd);
      tr.appendChild(linksTd);
      tr.appendChild(videosTd);
      tr.appendChild(editedTd);
      tr.appendChild(notesTd);
      tbody.appendChild(tr);
    });
    debugList.innerHTML = "";
    debugList.appendChild(table);
  }

  async function loadData() {
    debugSub.textContent = "読み込み中...";
    const res = await fetch("data/events.json", { cache: "no-store" });
    const data = await res.json();
    const overrides = window.SixDogEditor ? await window.SixDogEditor.fetchOverridesPublic() : {};
    const events = window.SixDogEditor ? window.SixDogEditor.applyOverrides(data, overrides) : data;
    rows = events.slice().sort((a, b) => a.event_date.localeCompare(b.event_date));
    if (window.SixDogLinks) await window.SixDogLinks.loadLinkIndex();
    videosByDate = await fetchAllVideos();
    renderTable(debugFilter.value);
  }

  function unlock() {
    gateWrap.classList.add("hidden");
    debugWrap.classList.remove("hidden");
    loadData();
  }

  gateForm.addEventListener("submit", e => {
    e.preventDefault();
    if (gatePassword.value === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      unlock();
    } else {
      gateStatus.textContent = "パスワードが違います。";
      gatePassword.value = "";
      gatePassword.focus();
    }
  });

  debugFilter.addEventListener("input", () => renderTable(debugFilter.value));

  if (sessionStorage.getItem(SESSION_KEY) === "1") {
    unlock();
  }
})();
