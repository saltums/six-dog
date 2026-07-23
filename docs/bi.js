(() => {
  "use strict";

  const DOW_ORDER = ["日", "月", "火", "水", "木", "金", "土"];

  const yearFilterEl = document.getElementById("yearFilter");
  const kpiRowEl = document.getElementById("kpiRow");
  const rankingSubEl = document.getElementById("rankingSub");
  const rankingChartEl = document.getElementById("rankingChart");
  const rankingTableEl = document.getElementById("rankingTable");
  const rankingToggleEl = document.getElementById("rankingToggle");
  const drilldownEl = document.getElementById("drilldown");
  const trendTitleEl = document.getElementById("trendTitle");
  const trendSubEl = document.getElementById("trendSub");
  const trendChartEl = document.getElementById("trendChart");
  const dowChartEl = document.getElementById("dowChart");
  const tooltipEl = document.getElementById("tooltip");

  let events = [];
  let selectedYear = "all";
  let rankingView = "chart";
  let selectedPerformer = null;

  function escapeText(s) { return String(s); }

  function setText(el, text) { el.textContent = text; }

  // ---------- ツールチップ ----------
  function showTooltip(x, y, lines) {
    tooltipEl.innerHTML = "";
    lines.forEach(({ label, value, strong }) => {
      const row = document.createElement("div");
      if (strong) {
        const b = document.createElement("b");
        b.textContent = value;
        row.appendChild(b);
        if (label) row.appendChild(document.createTextNode(" " + label));
      } else {
        row.textContent = label ? `${label}: ${value}` : value;
      }
      tooltipEl.appendChild(row);
    });
    tooltipEl.classList.remove("hidden");
    const pad = 14;
    let left = x + pad, top = y + pad;
    const rect = tooltipEl.getBoundingClientRect();
    if (left + rect.width > window.innerWidth) left = x - rect.width - pad;
    if (top + rect.height > window.innerHeight) top = y - rect.height - pad;
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  }
  function hideTooltip() { tooltipEl.classList.add("hidden"); }

  // ---------- フィルター ----------
  function renderYearFilter() {
    const years = Array.from(new Set(events.map(ev => ev.event_date.slice(0, 4)))).sort();
    yearFilterEl.querySelectorAll(".chip").forEach(c => c.remove());

    const allChip = document.createElement("button");
    allChip.type = "button";
    allChip.className = "chip" + (selectedYear === "all" ? " active" : "");
    allChip.textContent = "全期間";
    allChip.addEventListener("click", () => { selectedYear = "all"; selectedPerformer = null; renderAll(); });
    yearFilterEl.appendChild(allChip);

    years.forEach(y => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (selectedYear === y ? " active" : "");
      chip.textContent = `${y}年`;
      chip.addEventListener("click", () => { selectedYear = y; selectedPerformer = null; renderAll(); });
      yearFilterEl.appendChild(chip);
    });
  }

  function scopedEvents() {
    if (selectedYear === "all") return events;
    return events.filter(ev => ev.event_date.startsWith(selectedYear));
  }

  // ---------- KPI ----------
  function renderKPI(scoped) {
    kpiRowEl.innerHTML = "";

    const performerCounts = new Map();
    let totalAppearances = 0;
    scoped.forEach(ev => {
      (ev.performers || []).forEach(p => {
        totalAppearances++;
        const rec = performerCounts.get(p) || { count: 0 };
        rec.count++;
        performerCounts.set(p, rec);
      });
    });

    let topName = "—", topCount = 0;
    for (const [name, rec] of performerCounts) {
      if (rec.count > topCount) { topCount = rec.count; topName = name; }
    }

    const prices = scoped.map(ev => ev.price_adv).filter(v => v != null);
    const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;

    const tiles = [
      { label: "総公演数", value: scoped.length.toLocaleString() },
      { label: "出演者数(ユニーク)", value: performerCounts.size.toLocaleString() },
      { label: "平均出演者数/公演", value: scoped.length ? (totalAppearances / scoped.length).toFixed(1) : "0" },
      { label: "最多出演", value: topName, sub: topCount ? `${topCount} 回出演` : "", emphasis: true },
      { label: "平均チケット価格(判明分)", value: avgPrice != null ? `¥${avgPrice.toLocaleString()}` : "—", sub: `${prices.length} / ${scoped.length} 件で判明` },
    ];

    tiles.forEach(t => {
      const tile = document.createElement("div");
      tile.className = "stat-tile" + (t.emphasis ? " emphasis" : "");
      tile.innerHTML = `
        <div class="label">${t.label}</div>
        <div class="value">${escapeText(t.value)}</div>
        ${t.sub ? `<div class="sub">${escapeText(t.sub)}</div>` : ""}
      `;
      kpiRowEl.appendChild(tile);
    });

    return performerCounts;
  }

  // ---------- 出演者ランキング ----------
  function buildPerformerIndex(scoped) {
    const idx = new Map();
    scoped.forEach(ev => {
      (ev.performers || []).forEach(p => {
        if (!idx.has(p)) idx.set(p, []);
        idx.get(p).push(ev);
      });
    });
    return idx;
  }

  function renderRanking(scoped, performerIndex) {
    const scopeLabel = selectedYear === "all" ? "全期間" : `${selectedYear}年`;
    rankingSubEl.textContent = `${scopeLabel} — 出演回数の多い順(上位15組)`;

    const ranked = Array.from(performerIndex.entries())
      .map(([name, evs]) => ({ name, count: evs.length, evs }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const maxCount = ranked.length ? ranked[0].count : 1;

    // --- チャート ---
    rankingChartEl.innerHTML = "";
    ranked.forEach((r, i) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "bar-row-h" + (i === 0 ? " top1" : "");
      row.innerHTML = `
        <span class="name"></span>
        <span class="track"><span class="fill" style="width:${(r.count / maxCount * 100).toFixed(1)}%"></span></span>
        <span class="value">${r.count}</span>
      `;
      row.querySelector(".name").textContent = r.name;
      row.addEventListener("click", () => selectPerformer(r.name, r.evs));
      row.addEventListener("pointermove", e => showTooltip(e.clientX, e.clientY, [
        { value: r.name, strong: false },
        { label: "出演回数", value: `${r.count} 回`, strong: true },
        { label: "", value: `初出演 ${r.evs[0].event_date} 〜 最終 ${r.evs[r.evs.length - 1].event_date}` },
      ]));
      row.addEventListener("pointerleave", hideTooltip);
      row.addEventListener("focus", () => showTooltip(row.getBoundingClientRect().right, row.getBoundingClientRect().top, [
        { value: r.name, strong: false },
        { label: "出演回数", value: `${r.count} 回`, strong: true },
      ]));
      row.addEventListener("blur", hideTooltip);
      rankingChartEl.appendChild(row);
    });
    if (!ranked.length) {
      rankingChartEl.innerHTML = `<div class="panel-sub">この期間の出演者データがありません</div>`;
    }

    // --- テーブル ---
    const allRanked = Array.from(performerIndex.entries())
      .map(([name, evs]) => ({ name, count: evs.length, evs }))
      .sort((a, b) => b.count - a.count);

    const table = document.createElement("table");
    table.className = "data-table";
    table.innerHTML = `
      <thead><tr><th>#</th><th>出演者</th><th style="text-align:right">出演回数</th><th>初出演</th><th>最終出演</th></tr></thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");
    allRanked.forEach((r, i) => {
      const tr = document.createElement("tr");
      const nameTd = document.createElement("td");
      nameTd.textContent = r.name;
      const first = r.evs[0].event_date, last = r.evs[r.evs.length - 1].event_date;
      tr.innerHTML = `<td>${i + 1}</td><td></td><td class="num">${r.count}</td><td>${first}</td><td>${last}</td>`;
      tr.children[1].replaceWith(nameTd);
      tr.addEventListener("click", () => selectPerformer(r.name, r.evs));
      tbody.appendChild(tr);
    });
    rankingTableEl.innerHTML = "";
    rankingTableEl.appendChild(table);
  }

  function selectPerformer(name, evs) {
    selectedPerformer = { name, evs };
    renderDrilldown();
  }

  function renderDrilldown() {
    if (!selectedPerformer) { drilldownEl.classList.add("hidden"); drilldownEl.innerHTML = ""; return; }
    const { name, evs } = selectedPerformer;
    const sorted = [...evs].sort((a, b) => a.event_date.localeCompare(b.event_date));
    drilldownEl.classList.remove("hidden");
    drilldownEl.innerHTML = `
      <div class="drilldown-head">
        <h3></h3>
        <span class="count">${sorted.length} 回出演</span>
        <button type="button">✕ 閉じる</button>
      </div>
      <div class="drilldown-list"></div>
    `;
    drilldownEl.querySelector("h3").textContent = name;
    drilldownEl.querySelector("button").addEventListener("click", () => { selectedPerformer = null; renderDrilldown(); });
    const list = drilldownEl.querySelector(".drilldown-list");
    sorted.forEach(ev => {
      const row = document.createElement("div");
      row.className = "drilldown-item";
      const d = document.createElement("span");
      d.className = "d";
      d.textContent = ev.event_date + (ev.date_confidence === "estimated" ? " (月不明)" : "");
      const a = document.createElement("a");
      a.href = ev.source_snapshot_url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = (ev.title || "(タイトル不明)") + " ↗";
      row.appendChild(d);
      row.appendChild(a);
      list.appendChild(row);
    });
  }

  // ---------- 推移チャート(全期間=年別 / 単年=月別) ----------
  function renderTrend(scoped) {
    let buckets, labels, subtitle;
    if (selectedYear === "all") {
      trendTitleEl.textContent = "年別 公演数の推移";
      const years = Array.from(new Set(events.map(ev => ev.event_date.slice(0, 4)))).sort();
      buckets = years.map(y => scoped.filter(ev => ev.event_date.startsWith(y)).length);
      labels = years;
      subtitle = `記録期間全体(${years[0]}〜${years[years.length - 1]})`;
    } else {
      trendTitleEl.textContent = `月別 公演数の推移(${selectedYear}年)`;
      buckets = Array.from({ length: 12 }, (_, m) => {
        const mm = String(m + 1).padStart(2, "0");
        return scoped.filter(ev => ev.event_date.slice(5, 7) === mm).length;
      });
      labels = Array.from({ length: 12 }, (_, m) => `${m + 1}月`);
      const estimatedCount = scoped.filter(ev => ev.date_confidence === "estimated").length;
      subtitle = `${selectedYear}年の月別公演数`;
      if (estimatedCount > 0) {
        subtitle += ` — うち${estimatedCount}件は月が推定値(⚠月不明)のため実際とズレている可能性あり`;
      }
    }
    trendSubEl.textContent = subtitle;

    const max = Math.max(1, ...buckets);
    trendChartEl.innerHTML = "";
    buckets.forEach((count, i) => {
      const col = document.createElement("button");
      col.type = "button";
      col.className = "bar-col" + (count === 0 ? " empty" : "");
      const h = count === 0 ? 2 : Math.max(4, Math.round((count / max) * 120));
      col.innerHTML = `
        <span class="cap">${count > 0 ? count : ""}</span>
        <span class="stem" style="height:${h}px"></span>
        <span class="axis-label">${labels[i]}</span>
      `;
      col.addEventListener("pointermove", e => showTooltip(e.clientX, e.clientY, [
        { label: labels[i], value: `${count} 件`, strong: true },
      ]));
      col.addEventListener("pointerleave", hideTooltip);
      trendChartEl.appendChild(col);
    });
  }

  // ---------- 曜日別 ----------
  function renderDow(scoped) {
    const counts = Object.fromEntries(DOW_ORDER.map(d => [d, 0]));
    scoped.forEach(ev => { if (ev.weekday && counts.hasOwnProperty(ev.weekday)) counts[ev.weekday]++; });
    const max = Math.max(1, ...Object.values(counts));

    dowChartEl.innerHTML = "";
    DOW_ORDER.forEach(d => {
      const c = counts[d];
      const row = document.createElement("div");
      row.className = "dow-row";
      row.innerHTML = `
        <span class="dlabel">${d}</span>
        <span class="track"><span class="fill" style="width:${(c / max * 100).toFixed(1)}%"></span></span>
        <span class="value">${c}</span>
      `;
      dowChartEl.appendChild(row);
    });
  }

  // ---------- ビュー切り替え ----------
  rankingToggleEl.addEventListener("click", e => {
    const btn = e.target.closest("button[data-view]");
    if (!btn) return;
    rankingView = btn.dataset.view;
    rankingToggleEl.querySelectorAll("button").forEach(b => b.classList.toggle("active", b === btn));
    rankingChartEl.classList.toggle("hidden", rankingView !== "chart");
    rankingTableEl.classList.toggle("hidden", rankingView !== "table");
  });

  function renderAll() {
    const scoped = scopedEvents();
    renderYearFilter();
    const performerCounts = renderKPI(scoped);
    void performerCounts;
    const performerIndex = buildPerformerIndex(scoped);
    renderRanking(scoped, performerIndex);
    renderDrilldown();
    renderTrend(scoped);
    renderDow(scoped);
  }

  async function init() {
    let data = [];
    try {
      const res = await fetch("data/events.json", { cache: "no-store" });
      data = await res.json();
    } catch (e) {
      kpiRowEl.innerHTML = `<div class="panel-sub">データの読み込みに失敗しました</div>`;
      return;
    }
    const overrides = await (window.SixDogEditor ? window.SixDogEditor.fetchOverridesPublic() : Promise.resolve({}));
    events = window.SixDogEditor ? window.SixDogEditor.applyOverrides(data, overrides) : data;
    if (!events.length) {
      kpiRowEl.innerHTML = `<div class="panel-sub">まだデータがありません</div>`;
      return;
    }
    renderAll();
  }

  init();
})();
