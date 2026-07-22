(() => {
  "use strict";

  const DOW = ["日", "月", "火", "水", "木", "金", "土"];

  const calGrid = document.getElementById("calGrid");
  const calendarView = document.getElementById("calendarView");
  const listView = document.getElementById("listView");
  const searchInput = document.getElementById("search");
  const monthSelect = document.getElementById("monthSelect");
  const prevMonthBtn = document.getElementById("prevMonth");
  const nextMonthBtn = document.getElementById("nextMonth");
  const statsEl = document.getElementById("stats");
  const overlay = document.getElementById("detailOverlay");
  const detailCard = document.getElementById("detailCard");

  /** @type {any[]} */
  let events = [];
  let eventsByDate = new Map();
  let months = []; // [{year, month, key, label}]
  let currentMonthIndex = 0;

  function pad2(n) { return String(n).padStart(2, "0"); }

  function monthKey(y, m) { return `${y}-${pad2(m)}`; }

  function buildMonthRange(minDateStr, maxDateStr) {
    const [minY, minM] = minDateStr.split("-").map(Number);
    const [maxY, maxM] = maxDateStr.split("-").map(Number);
    const list = [];
    let y = minY, m = minM;
    while (y < maxY || (y === maxY && m <= maxM)) {
      list.push({ year: y, month: m, key: monthKey(y, m), label: `${y}年${m}月` });
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return list;
  }

  function formatDateLong(dateStr, weekday) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const w = weekday ? `(${weekday})` : "";
    return `${y}年${m}月${d}日${w}`;
  }

  function timeLabel(open, start) {
    if (!open && !start) return "未定";
    if (open && start) return `OPEN ${open} / START ${start}`;
    return `OPEN/START ${open || start}`;
  }

  function priceLabel(adv, door) {
    if (adv == null && door == null) return "----";
    const a = adv != null ? `¥${adv.toLocaleString()}` : "----";
    const d = door != null ? `¥${door.toLocaleString()}` : "----";
    return `adv ${a} / door ${d}`;
  }

  function formatSnapshotTimestamp(ts) {
    if (!ts || ts.length < 8) return ts;
    return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
  }

  function renderStats() {
    if (!events.length) {
      statsEl.textContent = "";
      return;
    }
    const q = searchInput.value.trim();
    if (q) {
      const n = listView.querySelectorAll(".list-item").length;
      statsEl.innerHTML = `検索結果 <b>${n}</b> 件`;
    } else {
      statsEl.innerHTML = `全 <b>${events.length}</b> 件`;
    }
  }

  function renderCalendar() {
    calGrid.innerHTML = "";
    if (!months.length) return;

    DOW.forEach(d => {
      const el = document.createElement("div");
      el.className = "cal-dow";
      el.textContent = d;
      calGrid.appendChild(el);
    });

    const { year, month } = months[currentMonthIndex];
    const firstDow = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let i = 0; i < firstDow; i++) {
      const el = document.createElement("div");
      el.className = "cal-cell empty";
      calGrid.appendChild(el);
    }

    let anyEvent = false;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${pad2(month)}-${pad2(day)}`;
      const ev = eventsByDate.get(dateStr);
      const cell = document.createElement(ev ? "button" : "div");
      if (ev) { cell.type = "button"; }
      cell.className = "cal-cell" + (ev ? " has-event" : "");
      const dEl = document.createElement("div");
      dEl.className = "d";
      dEl.textContent = day;
      cell.appendChild(dEl);
      if (ev) {
        anyEvent = true;
        const t = document.createElement("span");
        t.className = "ev-title";
        t.textContent = ev.title || "(タイトル不明)";
        cell.appendChild(t);
        if (ev.performers && ev.performers.length) {
          const b = document.createElement("span");
          b.className = "badge";
          b.textContent = `出演 ${ev.performers.length}`;
          cell.appendChild(b);
        }
        if (ev.date_confidence === "estimated") {
          const w = document.createElement("span");
          w.className = "badge badge-warn";
          w.textContent = "月不明";
          w.title = "この公演の月・年はページ更新日から推定したもので、実際とズレている可能性があります";
          cell.appendChild(w);
        }
        cell.addEventListener("click", () => showDetail(ev));
      }
      calGrid.appendChild(cell);
    }

    if (!anyEvent) {
      const msg = document.createElement("div");
      msg.className = "cal-empty-month";
      msg.textContent = "この月に記録された公演はありません";
      calGrid.appendChild(msg);
    }
  }

  function renderList(query) {
    const q = query.toLowerCase();
    const matches = events.filter(ev => {
      const hay = [ev.title, ...(ev.performers || [])].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });

    listView.innerHTML = "";
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "list-empty";
      empty.textContent = "該当する公演が見つかりませんでした";
      listView.appendChild(empty);
      renderStats();
      return;
    }

    matches.forEach(ev => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "list-item";
      item.innerHTML = `
        <div class="date">${ev.event_date}${ev.date_confidence === "estimated" ? ' <span class="badge badge-warn" title="月・年は推定です">月不明</span>' : ""}</div>
        <div class="body">
          <div class="t">${escapeHtml(ev.title || "(タイトル不明)")}</div>
          <div class="p">${escapeHtml((ev.performers || []).join(" / "))}</div>
        </div>
      `;
      item.addEventListener("click", () => showDetail(ev));
      listView.appendChild(item);
    });
    renderStats();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function showDetail(ev) {
    detailCard.innerHTML = `
      <button class="close" aria-label="閉じる" type="button">×</button>
      <div class="detail-eyebrow">${ev.event_date}${ev.weekday ? " (" + ev.weekday + ")" : ""}</div>
      <div class="detail-title">${escapeHtml(ev.title || "(タイトル不明)")}</div>
      ${ev.date_confidence === "estimated" ? `<div class="detail-notes">⚠ この日付の月・年は推定です。元ページに月の記載が無く、スナップショットが取得された時期から推測しているため、実際の公演日と異なる可能性があります。</div>` : ""}
      <dl class="detail-grid">
        <dt>TIME</dt><dd>${escapeHtml(timeLabel(ev.open_time, ev.start_time))}</dd>
        <dt>PRICE</dt><dd>${escapeHtml(priceLabel(ev.price_adv, ev.price_door))}${ev.price_note ? " " + escapeHtml(ev.price_note) : ""}</dd>
      </dl>
      ${ev.performers && ev.performers.length ? `<div class="performers">${ev.performers.map(p => `<span class="chip">${escapeHtml(p)}</span>`).join("")}</div>` : ""}
      ${ev.notes ? `<div class="detail-notes">${escapeHtml(ev.notes)}</div>` : ""}
      <div class="detail-source">
        出典: ${formatSnapshotTimestamp(ev.source_snapshot_timestamp)} 時点のスナップショット<br/>
        <a href="${ev.source_snapshot_url}" target="_blank" rel="noopener">Wayback Machine で元ページを見る ↗</a>
      </div>
    `;
    detailCard.querySelector(".close").addEventListener("click", hideDetail);
    overlay.classList.remove("hidden");
  }

  function hideDetail() {
    overlay.classList.add("hidden");
    detailCard.innerHTML = "";
  }

  overlay.addEventListener("click", e => { if (e.target === overlay) hideDetail(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") hideDetail(); });

  function updateView() {
    const q = searchInput.value.trim();
    if (q) {
      calendarView.classList.add("hidden");
      listView.classList.remove("hidden");
      renderList(q);
    } else {
      listView.classList.add("hidden");
      calendarView.classList.remove("hidden");
      renderCalendar();
      renderStats();
    }
  }

  function selectMonth(index) {
    currentMonthIndex = Math.max(0, Math.min(months.length - 1, index));
    monthSelect.value = months[currentMonthIndex].key;
    renderCalendar();
  }

  searchInput.addEventListener("input", updateView);
  prevMonthBtn.addEventListener("click", () => selectMonth(currentMonthIndex - 1));
  nextMonthBtn.addEventListener("click", () => selectMonth(currentMonthIndex + 1));
  monthSelect.addEventListener("change", () => {
    const idx = months.findIndex(m => m.key === monthSelect.value);
    if (idx >= 0) selectMonth(idx);
  });

  async function init() {
    let data = [];
    try {
      const res = await fetch("data/events.json", { cache: "no-store" });
      data = await res.json();
    } catch (e) {
      calGrid.innerHTML = `<div class="cal-empty-month">データの読み込みに失敗しました</div>`;
      return;
    }
    events = data;
    eventsByDate = new Map(events.map(ev => [ev.event_date, ev]));

    if (!events.length) {
      calGrid.innerHTML = `<div class="cal-empty-month">まだデータがありません</div>`;
      return;
    }

    const dates = events.map(ev => ev.event_date).sort();
    months = buildMonthRange(dates[0].slice(0, 7), dates[dates.length - 1].slice(0, 7));
    monthSelect.innerHTML = months.map(m => `<option value="${m.key}">${m.label}</option>`).join("");

    // もっとも公演件数が多い月を初期表示にする
    const countByMonth = new Map();
    events.forEach(ev => {
      const k = ev.event_date.slice(0, 7);
      countByMonth.set(k, (countByMonth.get(k) || 0) + 1);
    });
    let bestKey = months[0].key, bestCount = -1;
    for (const [k, c] of countByMonth) { if (c > bestCount) { bestCount = c; bestKey = k; } }
    const initialIndex = Math.max(0, months.findIndex(m => m.key === bestKey));

    selectMonth(initialIndex);
    updateView();
  }

  init();
})();
