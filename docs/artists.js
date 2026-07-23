(() => {
  "use strict";

  const searchInput = document.getElementById("artistSearch");
  const artistCountEl = document.getElementById("artistCount");
  const groupedListEl = document.getElementById("groupedList");
  const groupedSubEl = document.getElementById("groupedSub");
  const ungroupedListEl = document.getElementById("ungroupedList");
  const mergeBar = document.getElementById("mergeBar");
  const mergeCountEl = document.getElementById("mergeCount");
  const mergeCanonicalInput = document.getElementById("mergeCanonical");
  const mergeBtn = document.getElementById("mergeBtn");
  const mergeStatus = document.getElementById("mergeStatus");

  let counts = new Map();   // 表示名 -> 出現回数
  let aliases = {};         // 表示名(バリアント) -> 統合先(正式名)
  let selected = new Set(); // チェックされた表示名

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
    aliases = window.SixDogEditor ? await window.SixDogEditor.fetchAliasesPublic() : {};

    counts = new Map();
    events.forEach(ev => {
      (ev.performers || []).forEach(p => {
        counts.set(p, (counts.get(p) || 0) + 1);
      });
    });

    render();
  }

  function canonicalTotal(canonicalName) {
    // 統合先そのものの表記が実データにあればその分も、バリアント分も合算する
    let total = counts.get(canonicalName) || 0;
    for (const [variant, target] of Object.entries(aliases)) {
      if (target === canonicalName) total += counts.get(variant) || 0;
    }
    return total;
  }

  function render() {
    const q = searchInput.value.trim().toLowerCase();
    const allNames = Array.from(counts.keys());
    artistCountEl.textContent = `全 ${allNames.length} 表記`;

    // ---------- 統合済みグループ ----------
    const canonicalNames = Array.from(new Set(Object.values(aliases))).sort();
    groupedSubEl.textContent = canonicalNames.length ? `${canonicalNames.length} グループ` : "まだ統合はありません";
    groupedListEl.innerHTML = "";

    canonicalNames.forEach(canonical => {
      const members = Object.keys(aliases).filter(k => aliases[k] === canonical);
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
      const anchorRow = document.createElement("div");
      anchorRow.className = "artist-group-member anchor";
      anchorRow.innerHTML = `<span>${escapeHtml(canonical)}</span><span class="cnt">${anchorCount} 回(統合先の表記そのもの)</span>`;
      membersEl.appendChild(anchorRow);

      members.forEach(m => {
        const row = document.createElement("div");
        row.className = "artist-group-member";
        row.innerHTML = `
          <span>${escapeHtml(m)}</span>
          <span class="cnt">${counts.get(m) || 0} 回</span>
          <button type="button" class="unlink-btn" title="統合を解除">✕ 解除</button>
        `;
        row.querySelector(".unlink-btn").addEventListener("click", () => unlink(m));
        membersEl.appendChild(row);
      });

      groupedListEl.appendChild(group);
    });

    // ---------- 未統合の表記 ----------
    const groupedKeys = new Set(Object.keys(aliases));
    const canonicalSet = new Set(canonicalNames);
    const ungrouped = allNames
      .filter(n => !groupedKeys.has(n) && !canonicalSet.has(n))
      .filter(n => !q || n.toLowerCase().includes(q))
      .sort((a, b) => (counts.get(b) - counts.get(a)) || a.localeCompare(b));

    ungroupedListEl.innerHTML = "";
    if (!ungrouped.length) {
      ungroupedListEl.innerHTML = `<div class="panel-sub">該当する表記がありません</div>`;
    }
    ungrouped.forEach(n => {
      const row = document.createElement("label");
      row.className = "artist-row";
      const checked = selected.has(n) ? "checked" : "";
      row.innerHTML = `
        <input type="checkbox" ${checked} />
        <span class="name">${escapeHtml(n)}</span>
        <span class="cnt">${counts.get(n)} 回</span>
      `;
      row.querySelector("input").addEventListener("change", e => {
        if (e.target.checked) selected.add(n); else selected.delete(n);
        updateMergeBar();
      });
      ungroupedListEl.appendChild(row);
    });

    updateMergeBar();
  }

  function updateMergeBar() {
    mergeCountEl.textContent = `${selected.size}件選択中`;
    mergeBtn.disabled = selected.size < 1 || !mergeCanonicalInput.value.trim();
  }

  async function unlink(variant) {
    const next = Object.assign({}, aliases);
    delete next[variant];
    mergeStatus.textContent = "更新中...";
    try {
      await window.SixDogEditor.saveAliases(next);
      aliases = next;
      mergeStatus.textContent = "更新しました。反映まで数分かかります。";
      render();
    } catch (e) {
      mergeStatus.textContent = "更新に失敗しました: " + e.message;
    }
  }

  mergeCanonicalInput.addEventListener("input", updateMergeBar);

  mergeBtn.addEventListener("click", async () => {
    const canonical = mergeCanonicalInput.value.trim();
    if (!canonical || selected.size === 0) return;
    const next = Object.assign({}, aliases);
    selected.forEach(name => {
      if (name !== canonical) next[name] = canonical;
    });
    mergeStatus.textContent = "保存中...";
    try {
      await window.SixDogEditor.saveAliases(next);
      aliases = next;
      selected.clear();
      mergeCanonicalInput.value = "";
      mergeStatus.textContent = "保存しました。GitHub Pagesの再ビルド後(数分)に反映されます。";
      render();
    } catch (e) {
      mergeStatus.textContent = "保存に失敗しました: " + e.message;
    }
  });

  searchInput.addEventListener("input", render);

  load();
})();
