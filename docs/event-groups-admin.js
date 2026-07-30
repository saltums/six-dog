(() => {
  "use strict";

  const searchInput = document.getElementById("titleSearch");
  const titleCountEl = document.getElementById("titleCount");
  const groupedListEl = document.getElementById("evgGroupedList");
  const groupedSubEl = document.getElementById("evgGroupedSub");
  const ungroupedListEl = document.getElementById("evgUngroupedList");
  const mergeCountEl = document.getElementById("evgMergeCount");
  const mergeCanonicalInput = document.getElementById("evgMergeCanonical");
  const mergeBtn = document.getElementById("evgMergeBtn");
  const mergeStatus = document.getElementById("evgMergeStatus");

  let counts = new Map();     // タイトル -> 出現回数
  let rows = [];              // Supabaseの生の行 [{id, variant_title, group_name}]
  let groups = {};            // タイトル(バリアント) -> グループ名 (rowsから作る参照用)
  let rowIdByVariant = new Map();
  let selected = new Set();   // チェックされたタイトル
  let sortAnchor = null;      // これに近いタイトルを上位に表示する基準

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------- 文字列類似度(レーベンシュタイン距離ベース) ----------
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = new Array(n + 1);
    let curr = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      const ca = a.charCodeAt(i - 1);
      for (let j = 1; j <= n; j++) {
        const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1,      // 削除
          curr[j - 1] + 1,  // 挿入
          prev[j - 1] + cost // 置換
        );
      }
      [prev, curr] = [curr, prev];
    }
    return prev[n];
  }

  // 0(全然違う)〜1(完全一致)。長い方の文字数で正規化するだけでなく、
  // 一方がもう一方を含む(例: "Hello→" は "Hello→vol.130" に含まれる)場合は
  // 同じシリーズとして特に近いとみなし、下駄を履かせる。
  function similarity(a, b) {
    if (a === b) return 1;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    let score = 1 - levenshtein(a, b) / maxLen;
    if (a.includes(b) || b.includes(a)) score = Math.max(score, 0.85);
    return score;
  }

  async function load() {
    let events = [];
    try {
      const res = await fetch("data/events.json", { cache: "no-store" });
      events = await res.json();
    } catch (e) {
      groupedListEl.innerHTML = `<div class="panel-sub">データの読み込みに失敗しました</div>`;
      return;
    }
    await reloadGroups();

    counts = new Map();
    events.forEach(ev => {
      if (ev.title) counts.set(ev.title, (counts.get(ev.title) || 0) + 1);
    });

    render();
  }

  async function reloadGroups() {
    rows = await window.SixDogEventGroups.fetchGroupRows();
    groups = {};
    rowIdByVariant = new Map();
    rows.forEach(r => {
      groups[r.variant_title] = r.group_name;
      rowIdByVariant.set(r.variant_title, r.id);
    });
  }

  function canonicalTotal(canonicalName) {
    let total = counts.get(canonicalName) || 0;
    for (const [variant, target] of Object.entries(groups)) {
      if (target === canonicalName) total += counts.get(variant) || 0;
    }
    return total;
  }

  function render() {
    const q = searchInput.value.trim().toLowerCase();
    const allNames = Array.from(counts.keys());
    titleCountEl.textContent = `全 ${allNames.length} 件のタイトル`;

    // ---------- グループ済み ----------
    const canonicalNames = Array.from(new Set(Object.values(groups))).sort();
    groupedSubEl.textContent = canonicalNames.length ? `${canonicalNames.length} グループ` : "まだグループはありません";
    groupedListEl.innerHTML = "";

    canonicalNames.forEach(canonical => {
      const members = Object.keys(groups).filter(k => groups[k] === canonical);
      const visibleMembers = members.filter(m => !q || m.toLowerCase().includes(q) || canonical.toLowerCase().includes(q));
      if (q && !canonical.toLowerCase().includes(q) && visibleMembers.length === 0) return;

      const group = document.createElement("div");
      group.className = "artist-group";
      const total = canonicalTotal(canonical);
      group.innerHTML = `
        <div class="artist-group-head">
          <span class="artist-group-name">${escapeHtml(canonical)}</span>
          <span class="artist-group-total">合計 ${total} 回</span>
        </div>
        <div class="artist-group-members"></div>
      `;
      const membersEl = group.querySelector(".artist-group-members");

      const anchorCount = counts.get(canonical) || 0;
      if (anchorCount > 0) {
        const anchorRow = document.createElement("div");
        anchorRow.className = "artist-group-member anchor";
        anchorRow.innerHTML = `<span>${escapeHtml(canonical)}</span><span class="cnt">${anchorCount} 回(グループ名そのもの)</span>`;
        membersEl.appendChild(anchorRow);
      }

      members.forEach(m => {
        const row = document.createElement("div");
        row.className = "artist-group-member";
        row.innerHTML = `
          <span>${escapeHtml(m)}</span>
          <span class="cnt">${counts.get(m) || 0} 回</span>
          <button type="button" class="unlink-btn" title="グループを解除">✕ 解除</button>
        `;
        row.querySelector(".unlink-btn").addEventListener("click", () => unlink(m));
        membersEl.appendChild(row);
      });

      groupedListEl.appendChild(group);
    });

    // ---------- 未グループのタイトル ----------
    const groupedKeys = new Set(Object.keys(groups));
    const canonicalSet = new Set(canonicalNames);
    let ungrouped = allNames
      .filter(n => !groupedKeys.has(n) && !canonicalSet.has(n))
      .filter(n => !q || n.toLowerCase().includes(q));

    if (sortAnchor && counts.has(sortAnchor)) {
      ungrouped = ungrouped.sort((a, b) => {
        const diff = similarity(sortAnchor, b) - similarity(sortAnchor, a);
        if (Math.abs(diff) > 1e-9) return diff;
        return (counts.get(b) - counts.get(a)) || a.localeCompare(b);
      });
    } else {
      ungrouped = ungrouped.sort((a, b) => (counts.get(b) - counts.get(a)) || a.localeCompare(b));
    }

    // ---------- 類似度の基準を示すバー ----------
    const anchorBar = document.getElementById("evgAnchorBar");
    if (sortAnchor && counts.has(sortAnchor)) {
      anchorBar.classList.remove("hidden");
      anchorBar.innerHTML = `類似度の基準: <b>${escapeHtml(sortAnchor)}</b> に近い順で表示中 <button type="button" id="evgClearAnchorBtn">基準を解除</button>`;
      document.getElementById("evgClearAnchorBtn").addEventListener("click", () => { sortAnchor = null; render(); });
    } else {
      anchorBar.classList.add("hidden");
      anchorBar.innerHTML = "";
    }

    ungroupedListEl.innerHTML = "";
    if (!ungrouped.length) {
      ungroupedListEl.innerHTML = `<div class="panel-sub">該当するタイトルがありません</div>`;
    }
    ungrouped.forEach(n => {
      const row = document.createElement("div");
      row.className = "artist-row" + (n === sortAnchor ? " is-anchor" : "");
      const checked = selected.has(n) ? "checked" : "";
      const simLabel = (sortAnchor && counts.has(sortAnchor) && n !== sortAnchor)
        ? `<span class="sim">類似度 ${Math.round(similarity(sortAnchor, n) * 100)}%</span>` : "";
      row.innerHTML = `
        <label class="artist-row-main">
          <input type="checkbox" ${checked} />
          <span class="name">${escapeHtml(n)}</span>
        </label>
        ${simLabel}
        <span class="cnt">${counts.get(n)} 回</span>
        <button type="button" class="anchor-btn" title="この表記を基準に類似タイトルを探す">🔍 基準にする</button>
      `;
      row.querySelector("input").addEventListener("change", e => {
        const wasEmpty = selected.size === 0;
        if (e.target.checked) {
          selected.add(n);
          if (wasEmpty) { sortAnchor = n; render(); return; }
        } else {
          selected.delete(n);
          if (selected.size === 0) { sortAnchor = null; }
        }
        updateMergeBar();
      });
      row.querySelector(".anchor-btn").addEventListener("click", () => { sortAnchor = n; render(); });
      ungroupedListEl.appendChild(row);
    });

    updateMergeBar();
  }

  function updateMergeBar() {
    mergeCountEl.textContent = `${selected.size}件選択中`;
    mergeBtn.disabled = selected.size < 1 || !mergeCanonicalInput.value.trim();
  }

  async function unlink(variant) {
    const rowId = rowIdByVariant.get(variant);
    mergeStatus.textContent = "更新中...";
    try {
      await window.SixDogEventGroups.unlinkGroup(rowId);
      await reloadGroups();
      mergeStatus.textContent = "更新しました。";
      render();
    } catch (e) {
      mergeStatus.textContent = "更新に失敗しました: " + e.message;
    }
  }

  mergeCanonicalInput.addEventListener("input", updateMergeBar);

  mergeBtn.addEventListener("click", async () => {
    const canonical = mergeCanonicalInput.value.trim();
    if (!canonical || selected.size === 0) return;
    mergeStatus.textContent = "保存中...";
    try {
      const names = Array.from(selected).filter(name => name !== canonical);
      for (const name of names) {
        await window.SixDogEventGroups.linkGroup(name, canonical);
      }
      await reloadGroups();
      selected.clear();
      mergeCanonicalInput.value = "";
      mergeStatus.textContent = "保存しました！";
      render();
    } catch (e) {
      mergeStatus.textContent = "保存に失敗しました: " + e.message;
    }
  });

  searchInput.addEventListener("input", render);

  load();
})();
