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
  const yearHub = document.getElementById("yearHub");
  const yearHubGrid = document.getElementById("yearHubGrid");
  const controlsEl = document.getElementById("controls");
  const mainView = document.getElementById("mainView");
  const backToYearsBtn = document.getElementById("backToYears");

  /** @type {any[]} */
  let events = [];
  let aliases = {};
  let eventGroups = {};
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
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cal-cell" + (ev ? " has-event" : " cal-cell-empty");
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
          b.textContent = ev.performers.length;
          b.title = `出演 ${ev.performers.length}`;
          cell.appendChild(b);
        }
        if (ev.date_confidence === "estimated") {
          const w = document.createElement("span");
          w.className = "badge badge-warn";
          w.textContent = "月不明";
          w.title = "この公演の月・年はページ更新日から推定したもので、実際とズレている可能性があります";
          cell.appendChild(w);
        }
        if (window.SixDogTweets && window.SixDogTweets.hasTweet(dateStr)) {
          const x = document.createElement("span");
          x.className = "badge badge-x badge-tweet";
          x.title = "当日の告知ツイートあり";
          x.textContent = "𝕏";
          cell.appendChild(x);
        }
        if (window.SixDogLinks && window.SixDogLinks.hasLink(dateStr)) {
          const l = document.createElement("span");
          l.className = "badge badge-x badge-link";
          l.title = "関連URLあり";
          l.textContent = "🔗";
          cell.appendChild(l);
        }
        if (window.SixDogVideos && window.SixDogVideos.hasVideo(dateStr)) {
          const v = document.createElement("span");
          v.className = "badge badge-video";
          v.title = "動画のある出演者がいます";
          v.textContent = "🎬";
          cell.appendChild(v);
        }
        if (window.SixDogHype && window.SixDogHype.getCount(dateStr) > 0) {
          const h = document.createElement("span");
          h.className = "badge badge-hype";
          h.title = `アツかった ${window.SixDogHype.getCount(dateStr)}件`;
          h.textContent = "🔥";
          cell.appendChild(h);
        }
        if (window.SixDogEmoi && window.SixDogEmoi.getCount(dateStr) > 0) {
          const em = document.createElement("span");
          em.className = "badge badge-emoi";
          em.title = `エモい ${window.SixDogEmoi.getCount(dateStr)}件`;
          em.textContent = "🥹";
          cell.appendChild(em);
        }
        cell.addEventListener("click", () => showDetail(ev));
      } else {
        const plus = document.createElement("span");
        plus.className = "cal-add-hint";
        plus.textContent = "＋";
        cell.appendChild(plus);
        cell.title = "この日の公演情報を追加";
        cell.addEventListener("click", () => showDetail({ event_date: dateStr }, { isNew: true }));
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
      const performerNames = ev.performers || [];
      // 表示名だけでなく統合先の名前(例: "A(アコースティック)" → "A")でも検索できるようにする
      const canonicalNames = performerNames.map(p => aliases[p]).filter(Boolean);
      // イベント名も同様に、グループ名(例: "Hello→vol.130" → "Hello→")でも検索できるようにする
      const titleGroup = ev.title ? eventGroups[ev.title] : null;
      const hay = [ev.title, titleGroup, ...performerNames, ...canonicalNames].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
    matches.sort((a, b) => a.event_date.localeCompare(b.event_date));

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

  function showDetail(ev, opts) {
    const isNew = !!(opts && opts.isNew);
    if (isNew) {
      detailCard.innerHTML = `
        <button class="close" aria-label="閉じる" type="button">×</button>
        <div class="detail-eyebrow">${ev.event_date}${ev.weekday ? " (" + ev.weekday + ")" : ""} <span class="badge-warn">新規追加</span></div>
        <div class="detail-title">新しい公演情報を追加</div>
        <div class="detail-notes">この日の公演記録がありません。わかる範囲で情報を入力してください(後から追記・修正できます)。</div>
        <div class="edit-form-slot"></div>
      `;
      detailCard.querySelector(".close").addEventListener("click", hideDetail);
      const editSlot = detailCard.querySelector(".edit-form-slot");
      if (window.SixDogEditor) {
        const form = window.SixDogEditor.buildEditForm(ev, {
          onCancel: hideDetail,
          onSave: (updatedEv) => {
            eventsByDate.set(ev.event_date, updatedEv);
            const idx = events.findIndex(e => e.event_date === ev.event_date);
            if (idx >= 0) events[idx] = updatedEv; else events.push(updatedEv);
            renderCalendar();
            hideDetail();
            showDetail(updatedEv);
          },
        });
        editSlot.appendChild(form);
      }
      overlay.classList.remove("hidden");
      return;
    }
    detailCard.innerHTML = `
      <button class="close" aria-label="閉じる" type="button">×</button>
      <div class="detail-eyebrow">${ev.event_date}${ev.weekday ? " (" + ev.weekday + ")" : ""}${ev._edited && !ev._synthetic ? ' <span class="badge-warn" title="手動で修正済み">編集済み</span>' : ""}</div>
      <div class="detail-title">${escapeHtml(ev.title || "(タイトル不明)")}</div>
      <div class="detail-actions">
        <div class="hype-slot"></div>
        <div class="emoi-slot"></div>
        <div class="share-slot"></div>
      </div>
      ${ev.date_confidence === "estimated" ? `<div class="detail-notes">⚠ この日付の月・年は推定です。元ページに月の記載が無く、スナップショットが取得された時期から推測しているため、実際の公演日と異なる可能性があります。</div>` : ""}
      <dl class="detail-grid">
        <dt>TIME</dt><dd>${escapeHtml(timeLabel(ev.open_time, ev.start_time))}</dd>
        <dt>PRICE</dt><dd>${escapeHtml(priceLabel(ev.price_adv, ev.price_door))}${ev.price_note ? " " + escapeHtml(ev.price_note) : ""}</dd>
      </dl>
      ${ev.performers && ev.performers.length ? `
        <div class="performers">${ev.performers.map(p => `<button type="button" class="chip" data-performer="${escapeHtml(p)}">${escapeHtml(p)}<span class="chip-video-icon hidden">🎬</span></button>`).join("")}</div>
        <div class="performers-hint">出演者名をクリックすると動画URLの閲覧・投稿ができます</div>
      ` : ""}
      <div class="video-slot"></div>
      <div class="tweet-slot"></div>
      <div class="link-slot"></div>
      <div class="detail-edit-toggle">
        <button type="button" class="btn-edit-toggle">✎ この公演情報を編集</button>
      </div>
      <div class="edit-form-slot"></div>
    `;
    detailCard.querySelector(".close").addEventListener("click", hideDetail);
    if (window.SixDogHype) {
      detailCard.querySelector(".hype-slot").appendChild(window.SixDogHype.buildHypeButton(ev.event_date));
    }
    if (window.SixDogEmoi) {
      detailCard.querySelector(".emoi-slot").appendChild(window.SixDogEmoi.buildEmoiButton(ev.event_date));
    }
    if (window.SixDogShare) {
      detailCard.querySelector(".share-slot").appendChild(window.SixDogShare.buildShareButtons(ev));
    }
    const videoSlot = detailCard.querySelector(".video-slot");
    detailCard.querySelectorAll(".chip[data-performer]").forEach(chip => {
      chip.addEventListener("click", () => {
        if (!window.SixDogVideos) return;
        videoSlot.innerHTML = "";
        videoSlot.appendChild(window.SixDogVideos.buildVideoPanel(ev.event_date, chip.dataset.performer));
        videoSlot.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    });
    const tweetSlot = detailCard.querySelector(".tweet-slot");
    if (window.SixDogTweets) {
      window.SixDogTweets.buildTweetPanel(ev.event_date).then(panel => {
        if (panel) tweetSlot.appendChild(panel);
      });
    }
    const linkSlot = detailCard.querySelector(".link-slot");
    if (window.SixDogLinks) {
      window.SixDogLinks.buildLinkPanel(ev.event_date).then(panel => {
        if (panel) linkSlot.appendChild(panel);
      });
    }
    if (window.SixDogVideos && ev.performers && ev.performers.length) {
      window.SixDogVideos.fetchVideoPerformers(ev.event_date).then(withVideo => {
        detailCard.querySelectorAll(".chip[data-performer]").forEach(chip => {
          if (withVideo.has(chip.dataset.performer)) {
            chip.querySelector(".chip-video-icon").classList.remove("hidden");
          }
        });
      });
    }
    const editToggleBtn = detailCard.querySelector(".btn-edit-toggle");
    const editSlot = detailCard.querySelector(".edit-form-slot");
    editToggleBtn.addEventListener("click", () => {
      if (!window.SixDogEditor) return;
      editToggleBtn.classList.add("hidden");
      const form = window.SixDogEditor.buildEditForm(ev, {
        onCancel: () => { editSlot.innerHTML = ""; editToggleBtn.classList.remove("hidden"); },
        onSave: (updatedEv) => {
          eventsByDate.set(ev.event_date, updatedEv);
          const idx = events.findIndex(e => e.event_date === ev.event_date);
          if (idx >= 0) events[idx] = updatedEv; else events.push(updatedEv);
          renderCalendar();
          editSlot.innerHTML = "";
          editToggleBtn.classList.remove("hidden");
        },
      });
      editSlot.appendChild(form);
    });
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

  function showCalendarUI() {
    yearHub.classList.add("hidden");
    controlsEl.classList.remove("hidden");
    mainView.classList.remove("hidden");
  }

  function showYearHub() {
    mainView.classList.add("hidden");
    controlsEl.classList.add("hidden");
    yearHub.classList.remove("hidden");
  }

  function enterYear(year) {
    const idx = months.findIndex(m => m.year === year);
    showCalendarUI();
    selectMonth(idx >= 0 ? idx : 0);
    updateView();
  }

  function renderYearHub() {
    const countByYear = new Map();
    events.forEach(ev => {
      const y = Number(ev.event_date.slice(0, 4));
      countByYear.set(y, (countByYear.get(y) || 0) + 1);
    });
    const years = Array.from(countByYear.keys()).sort((a, b) => a - b);
    const tilt = [-2.5, 1.5, -1, 2, -1.5, 1, -2, 0.5, -0.5, 2.5, -1.5, 1.5, -1];
    yearHubGrid.innerHTML = years.map((y, i) => `
      <button type="button" class="year-tile" data-year="${y}" style="--i:${i}; --tilt:${tilt[i % tilt.length]}deg;">
        <span class="year-tile-num">${y}</span>
        <span class="year-tile-count">${countByYear.get(y)}件</span>
      </button>
    `).join("");
    yearHubGrid.querySelectorAll(".year-tile").forEach(btn => {
      btn.addEventListener("click", () => enterYear(Number(btn.dataset.year)));
    });
  }

  backToYearsBtn.addEventListener("click", showYearHub);

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
    const overrides = await (window.SixDogEditor ? window.SixDogEditor.fetchOverridesPublic() : Promise.resolve({}));
    events = window.SixDogEditor ? window.SixDogEditor.applyOverrides(data, overrides) : data;
    aliases = window.SixDogEditor ? await window.SixDogEditor.fetchAliasesPublic() : {};
    eventGroups = window.SixDogEventGroups ? await window.SixDogEventGroups.fetchGroupsMap() : {};
    if (window.SixDogTweets) await window.SixDogTweets.loadTweetIndex();
    if (window.SixDogLinks) await window.SixDogLinks.loadLinkIndex();
    if (window.SixDogVideos) await window.SixDogVideos.loadVideoIndex();
    if (window.SixDogHype) await window.SixDogHype.loadHypeIndex();
    if (window.SixDogEmoi) await window.SixDogEmoi.loadEmoiIndex();
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

    renderYearHub();

    // ?date=YYYY-MM-DD が付いている場合はその日の詳細を直接開く(BIダッシュボードの「要確認」一覧から遷移する用)
    const deepLinkDate = new URLSearchParams(location.search).get("date");
    const deepLinkEv = deepLinkDate ? eventsByDate.get(deepLinkDate) : null;
    if (deepLinkEv) {
      const idx = months.findIndex(m => m.key === deepLinkDate.slice(0, 7));
      showCalendarUI();
      selectMonth(idx >= 0 ? idx : initialIndex);
      showDetail(deepLinkEv);
      updateView();
    } else {
      showYearHub();
    }
  }

  init();
})();
