(() => {
  "use strict";
  const view = document.getElementById("view");
  const DOW = ["日", "月", "火", "水", "木", "金", "土"];
  const DOW_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  let baseList = [], rawList = [], events = [], byDate = new Map(), artists = [], artistByName = new Map(), months = [];
  // 投稿・反応まわりは既存の部品(supabase-config.js と各モジュール)に任せる
  const Vd = window.SixDogVideos, Lk = window.SixDogLinks, Tw = window.SixDogTweets, Hy = window.SixDogHype, Em = window.SixDogEmoi;
  const Ed = window.SixDogEditor, Sh = window.SixDogShare, Rf = window.SixDogRecentFeed;
  const vidsOn = d => (Vd && Vd.getVideosByDate ? Vd.getVideosByDate(d) : []);
  const linksOn = d => (Lk ? Lk.getLinks(d) : []);
  const hypeOn = d => (Hy ? Hy.getCount(d) : 0), emoiOn = d => (Em ? Em.getCount(d) : 0);
  const post = [];
  const isAdmin = () => !!(window.SixDogAdmin && window.SixDogAdmin.isIn());
  const after = fn => post.push(fn);

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ic = (id, cls) => `<svg class="ic ${cls || ""}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const pad = n => String(n).padStart(2, "0");
  const dow = d => new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)).getDay();
  const yen = n => n == null ? null : "¥" + Number(n).toLocaleString("ja-JP");
  const fmtYM = ym => `${ym.slice(0, 4)}年${+ym.slice(5, 7)}月`;
  const fmtD = d => `${d.slice(0, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}`;
  const title = ev => ev.t || "(公演名不明)";

  // ---------- data ----------
  // 元データ(data/events.json に、Supabaseの手作業の修正を重ねたもの)から、画面用の索引を作り直す
  function build() {
    events = rawList.filter(ev => ev && /^\d{4}-\d{2}-\d{2}$/.test(ev.event_date || ""))
      .map(ev => ({ d: ev.event_date, t: ev.title || "", p: (ev.performers || []).map(x => String(x).trim()).filter(Boolean), o: ev.open_time, s: ev.start_time, a: ev.price_adv, r: ev.price_door, raw: ev }))
      .sort((x, y) => x.d.localeCompare(y.d));
    byDate = new Map(); artistByName = new Map(); months = [];
    events.forEach(ev => byDate.set(ev.d, ev));
    const m = new Map();
    events.forEach(ev => ev.p.forEach(name => {
      if (!m.has(name)) m.set(name, { name, dates: [] });
      m.get(name).dates.push(ev.d);
    }));
    artists = [...m.values()].sort((x, y) => y.dates.length - x.dates.length || x.name.localeCompare(y.name, "ja"));
    // URLには名前を使う(データが増えても同じ出演者ページを指し続けるように)
    artists.forEach(a => { a.id = encodeURIComponent(a.name); artistByName.set(a.name, a); });
    const first = events[0].d.slice(0, 7), last = events[events.length - 1].d.slice(0, 7);
    let [y, mo] = first.split("-").map(Number);
    for (;;) {
      const k = `${y}-${pad(mo)}`;
      months.push(k);
      if (k === last) break;
      if (++mo > 12) { mo = 1; y++; }
    }
  }
  const countIn = ym => events.filter(e => e.d.startsWith(ym)).length;
  const marks = d => {
    const v = vidsOn(d).length, l = linksOn(d).length, tw = Tw && Tw.hasTweet(d), h = hypeOn(d), e = emoiOn(d);
    const out = [];
    if (v) out.push(`<span>${ic("play", "s")}動画 ${v}</span>`);
    if (tw) out.push(`<span>${ic("chat", "s")}告知</span>`);
    if (l) out.push(`<span>${ic("link", "s")}関連 ${l}</span>`);
    if (h) out.push(`<span>${ic("flame", "s")}${h}</span>`);
    if (e) out.push(`<span>${ic("drop", "s")}${e}</span>`);
    return out.length ? `<span class="mk">${out.join("")}</span>` : "";
  };
  function row(ev, full) {
    const w = dow(ev.d);
    const db = full
      ? `<span class="db full"><small class="num">${ev.d.slice(0, 4)}</small><b>${ev.d.slice(5, 7)}.${ev.d.slice(8, 10)}</b><small>${DOW[w]}</small></span>`
      : `<span class="db"><b>${+ev.d.slice(8, 10)}</b><small>${DOW[w]}</small></span>`;
    return `<a class="erow" href="#event-${ev.d}">${db}<span><span class="et">${esc(title(ev))}</span>${ev.p.length ? `<span class="ep">${esc(ev.p.join(" / "))}</span>` : ""}${marks(ev.d)}</span>${ic("next", "s")}</a>`;
  }
  const sh = (jp, en, more) => `<div class="sh"><h2>${jp}</h2><span class="en">${en}</span>${more || ""}</div>`;

  // ---------- views ----------
  function vTop() {
    const byYear = new Map();
    events.forEach(e => byYear.set(+e.d.slice(0, 4), (byYear.get(+e.d.slice(0, 4)) || 0) + 1));
    const years = []; for (let y = 2006; y <= 2019; y++) years.push(y);
    const max = Math.max(...byYear.values());
    const now = new Date(), md = `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    let today = events.filter(e => e.d.slice(5) === md), todayLabel = `${now.getMonth() + 1}月${now.getDate()}日`;
    for (let k = 1; !today.length && k <= 7; k++) {
      const t = new Date(now.getTime() + k * 864e5), md2 = `${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
      today = events.filter(e => e.d.slice(5) === md2);
      todayLabel = `${t.getMonth() + 1}月${t.getDate()}日`;
    }
    return `
      <section class="sec">
        <p class="lead">2005年11月、<br>名古屋・新栄のビルの地下にできたライブハウス SiX-DOG。</p>
        <p class="lead">2019年2月24日に閉店するまでの約13年間に、<br>ここで開かれた公演と、そこに立ったバンドの記録を、<br>残っていた公式サイトや当時の投稿から集めています。</p>
        <div class="stats">
          <div class="stat"><b class="num">${events.length.toLocaleString()}</b><span>公演</span></div>
          <div class="stat"><b class="num">${artists.length.toLocaleString()}</b><span>出演者(名義)</span></div>
          <div class="stat"><b class="num">13</b><span>年(2005.11–2019.02)</span></div>
        </div>
      </section>
      <section class="sec">
        ${sh("探す", "SEARCH")}
        <label class="search"><span class="sr" hidden>バンド名・公演名で探す</span>${ic("search")}<input id="q" type="search" placeholder="バンド名・公演名で探す(例:ノーリプライ)" autocomplete="off" enterkeyhint="search"></label>
        <div class="qres" id="qres"></div>
      </section>
      <section class="sec">
        ${sh("年ごとの公演数", "YEARS", `<a class="more" href="#schedule">スケジュールへ ›</a>`)}
        <div class="years">${years.map(y => {
          const c = byYear.get(y) || 0;
          return `<a class="ycol" href="#schedule-${busiest(y)}" aria-label="${y}年 ${c}件"><span class="c num">${c}</span><span class="b" style="height:${Math.max(2, c / max * 140)}px"></span></a>`;
        }).join("")}</div>
        <div class="ylab">${years.map(y => `<span>${String(y).slice(2)}</span>`).join("")}</div>
        <p class="note" style="margin-top:8px">棒を押すと、その年でいちばん公演が多かった月を開きます。2006〜2007年は残っている記録が少ない年です。</p>
      </section>
      <section class="sec">
        ${sh(`この日のSiX-DOG`, todayLabel)}
        <div class="rows">${today.length ? today.map(e => row(e, true)).join("") : `<p class="empty">近い日付の公演は記録にありません。</p>`}</div>
      </section>
      <section class="sec" id="recent" hidden>
        ${sh("最近追加された情報", "NEW")}
        <div class="feed" id="feed"></div>
      </section>
      <section class="sec">
        ${sh("よく出ていた出演者", "REGULARS", `<a class="more" href="#artists">一覧 ›</a>`)}
        <div class="chips">${artists.slice(0, 12).map(a => `<a class="chip" href="#artist-${a.id}">${esc(a.name)}<small>${a.dates.length}回</small></a>`).join("")}</div>
      </section>`;
  }
  // みんなが足した情報の新着(公演情報の修正・関連URL・動画)
  let recentP = null;
  function fillRecent() {
    if (!Rf) return;
    recentP = recentP || Rf.fetchRecent(6).catch(() => []);
    recentP.then(list => {
      const sec = document.getElementById("recent"), box = document.getElementById("feed");
      if (!sec || !list.length) return;
      box.innerHTML = list.map(e => `<a href="#event-${esc(e.eventDate)}"><span>${esc(e.text)}</span><small>${esc(ago(e.timestamp))}</small></a>`).join("");
      sec.hidden = false;
    });
  }
  function ago(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (!(s >= 0)) return "";
    if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}分前`;
    if (s < 86400) return `${Math.floor(s / 3600)}時間前`;
    if (s < 86400 * 30) return `${Math.floor(s / 86400)}日前`;
    const d = new Date(iso);
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  }
  function busiest(y) {
    let best = `${y}-01`, n = -1;
    months.filter(m => m.startsWith(y)).forEach(m => { const c = countIn(m); if (c > n) { n = c; best = m; } });
    return best;
  }
  function bindSearch() {
    const q = document.getElementById("q"), out = document.getElementById("qres");
    if (!q) return;
    q.addEventListener("input", () => {
      const s = q.value.trim().toLowerCase();
      if (!s) { out.innerHTML = ""; return; }
      const as = artists.filter(a => a.name.toLowerCase().includes(s)).slice(0, 12);
      const es = events.filter(e => (e.t + " " + e.p.join(" ")).toLowerCase().includes(s));
      out.innerHTML = `
        ${as.length ? `<p class="qcount">出演者</p><div class="chips" style="margin-bottom:18px">${as.map(a => `<a class="chip" href="#artist-${a.id}">${esc(a.name)}<small>${a.dates.length}回</small></a>`).join("")}</div>` : ""}
        <p class="qcount">公演 ${es.length}件${es.length > 40 ? "(新しい順に40件まで表示)" : ""}</p>
        <div class="rows">${es.length ? es.slice(-40).reverse().map(e => row(e, true)).join("") : `<p class="empty">「${esc(q.value)}」に一致する公演は見つかりませんでした。</p>`}</div>`;
    });
  }

  function vSchedule(ym) {
    if (!ym || !months.includes(ym)) ym = lastYM || "2015-05";
    lastYM = ym;
    const i = months.indexOf(ym), prev = months[i - 1], next = months[i + 1];
    const [y, m] = ym.split("-").map(Number);
    const first = new Date(y, m - 1, 1).getDay(), days = new Date(y, m, 0).getDate();
    const list = events.filter(e => e.d.startsWith(ym));
    let cells = DOW.map(d => `<div class="dw">${d}</div>`).join("");
    for (let k = 0; k < first; k++) cells += `<div class="cc pad"></div>`;
    for (let d = 1; d <= days; d++) {
      const key = `${ym}-${pad(d)}`, ev = byDate.get(key);
      // 記録のない日も押せる(その日の公演を知っている人が追加できるように)
      cells += ev
        ? `<a class="cc ev" href="#event-${key}" aria-label="${d}日 ${esc(title(ev))}"><span class="cd">${d}</span><span class="ct">${esc(title(ev))}</span></a>`
        : `<a class="cc" href="#event-${key}" aria-label="${d}日 記録なし(追加できます)"><span class="cd">${d}</span></a>`;
    }
    const opts = months.map(k => `<option value="${k}"${k === ym ? " selected" : ""}>${fmtYM(k)}(${countIn(k)})</option>`).join("");
    return `
      <div class="mhead">
        <a class="mnav" href="#schedule-${prev || ym}" aria-label="前の月"${prev ? "" : ' aria-disabled="true"'}>${ic("prev")}</a>
        <h1><small>${y}</small>${pad(m)}</h1>
        <a class="mnav" href="#schedule-${next || ym}" aria-label="次の月"${next ? "" : ' aria-disabled="true"'}>${ic("next")}</a>
        <select class="msel" id="msel" aria-label="年月を選ぶ">${opts}</select>
      </div>
      <div class="cal">${cells}</div>
      <section class="sec">
        ${sh(`この月の公演 ${list.length}件`, "LIST")}
        <div class="rows">${list.length ? list.map(e => row(e, false)).join("") : `<p class="empty">この月の公演は記録に残っていません。</p>`}</div>
      </section>`;
  }
  let lastYM = null;

  function vEvent(d) {
    const ev = byDate.get(d);
    if (!ev) return vNoEvent(d);
    lastYM = d.slice(0, 7);
    const raw = ev.raw, w = dow(d), idx = events.indexOf(ev), pv = events[idx - 1], nx = events[idx + 1];
    const time = ev.o || ev.s ? `${ev.o || "—"} / ${ev.s || "—"}` : "未定・不明";
    const price = (ev.a != null || ev.r != null ? `前売 ${yen(ev.a) || "—"} / 当日 ${yen(ev.r) || "—"}` : "不明") + (raw.price_note ? ` ${raw.price_note}` : "");
    const vids = vidsOn(d);
    const hyped = Hy ? Hy.hasHyped(d) : false, emoid = Em ? Em.hasEmoi(d) : false;
    after(() => bindEvent(ev));
    return `
      <a class="back" href="#schedule-${d.slice(0, 7)}">${ic("prev", "s")}${fmtYM(d.slice(0, 7))}のスケジュール</a>
      <div class="ehead">
        <div class="edate"><span class="num">${d.slice(0, 4)}</span><b class="num">${d.slice(5, 7)}.${d.slice(8, 10)}</b><span>${DOW_EN[w]}</span></div>
        <h1>${esc(title(ev))}</h1>
      </div>
      <div class="react">
        <button type="button" class="rbtn" data-r="h" aria-pressed="${hyped}"${hyped ? " disabled" : ""}>${ic("flame")}アツかった <b class="num">${hypeOn(d)}</b></button>
        <button type="button" class="rbtn" data-r="e" aria-pressed="${emoid}"${emoid ? " disabled" : ""}>${ic("drop")}エモい <b class="num">${emoiOn(d)}</b></button>
        <span class="share-slot"></span>
      </div>
      ${raw.date_confidence === "estimated" ? `<p class="caution">この日付の年・月は推定です。元のページに月の記載がなく、ページが保存された時期から推測しているため、実際の公演日と違う可能性があります。</p>` : ""}
      <dl class="kv"><dt>OPEN/START</dt><dd class="num">${esc(time)}</dd><dt>PRICE</dt><dd class="num">${esc(price)}</dd>${raw.notes ? `<dt>NOTE</dt><dd>${esc(raw.notes)}</dd>` : ""}</dl>
      <section class="sec">
        ${sh(`出演 ${ev.p.length}組`, "LINE UP")}
        ${ev.p.length ? `<div class="lineup">${ev.p.map(n => { const a = artistByName.get(n); return `<a class="lchip" href="#artist-${a.id}"><span>${esc(n)}</span><small>SiX-DOG出演 ${a.dates.length}回</small>${ic("next", "s")}</a>`; }).join("")}</div>` : `<p class="empty">出演者はまだ分かっていません。知っていれば下の「公演情報を直す」から追加できます。</p>`}
      </section>
      <section class="sec slot${vids.length ? "" : " is-empty"}">
        ${sh("動画", "VIDEO")}
        <ul class="links">${vids.map(v => `<li><a href="${esc(v.video_url)}" target="_blank" rel="noopener noreferrer nofollow">${ic("play")}<span>${esc(v.video_title || v.video_url)}</span><small>${esc(v.performer_name || "")}</small></a>${isAdmin() ? `<button type="button" class="adm-del" data-kind="video" data-key="${v.id}">削除</button>` : ""}</li>`).join("")}</ul>
        ${ev.p.length ? `<div class="vadd">
          <label class="vpick"><span>動画を足す・直す出演者</span><select id="vpick"><option value="">選んでください</option>${ev.p.map(n => `<option>${esc(n)}</option>`).join("")}</select></label>
          <div id="vpanel"></div>
        </div>` : `<p class="note vadd">出演者が分かると、出演者ごとに動画を登録できます。</p>`}
      </section>
      <section class="sec slot" id="twSlot">${sh("当日の告知ポスト", "POST")}</section>
      <section class="sec slot" id="lkSlot">${sh("関連ページ", "SOURCE")}</section>
      <div class="addbar">
        <button type="button" id="addToggle" aria-expanded="false">${ic("plus", "s")}<span>動画・告知ポスト・関連URLを足す</span></button>
        <button type="button" id="editToggle" class="ghost">公演情報を直す</button>
        <span>ログインなしで誰でも追加・修正できます。間違えて登録したものは、追加の欄を開くと解除できます。</span>
      </div>
      <div id="editSlot"></div>
      ${window.SixDogAdmin && SixDogAdmin.isIn() ? `<p class="adm-jump"><a href="#admin-${d}">この日の投稿を管理する ›</a></p>` : ""}
      <nav class="pn" aria-label="前後の公演">
        ${pv ? `<a href="#event-${pv.d}"><small>‹ PREV ${fmtD(pv.d)}</small><span>${esc(title(pv))}</span></a>` : "<span></span>"}
        ${nx ? `<a class="nx" href="#event-${nx.d}"><small>NEXT ${fmtD(nx.d)} ›</small><span>${esc(title(nx))}</span></a>` : "<span></span>"}
      </nav>`;
  }

  // 公演ページの部品(反応・シェア・投稿欄・編集フォーム)をつなぐ
  function bindEvent(ev) {
    const d = ev.d;
    view.querySelectorAll(".rbtn").forEach(b => b.addEventListener("click", async () => {
      const mod = b.dataset.r === "h" ? Hy : Em;
      if (!mod || b.disabled) return;
      b.disabled = true;
      try {
        const n = await mod.tap(d);
        b.setAttribute("aria-pressed", "true");
        b.querySelector("b").textContent = n;
      } catch (e) {
        b.disabled = false;
        toast("送信できませんでした。通信状況を確かめて、もう一度押してください。");
      }
    }));
    // 管理者としてログイン中は、動画の行の「削除」で紐づけをその場で消せる
    view.querySelectorAll(".links .adm-del").forEach(b => b.addEventListener("click", async () => {
      const li = b.closest("li"), label = li.querySelector("span").textContent;
      if (!confirm(`この動画の紐づけを削除しますか?元に戻せません。

${label}`)) return;
      b.disabled = true; b.textContent = "削除中…";
      try {
        const r = await window.SixDogAdmin.remove("video", b.dataset.key);
        if (String(r).startsWith("ok")) { await refreshData(); toast("削除しました。"); render(); }
        else { b.disabled = false; b.textContent = "削除"; if (r === "wrong" || r === "not_set") window.SixDogAdmin.setPw(""); toast(window.SixDogAdmin.MSG[r] || "削除できませんでした。"); }
      } catch (e) { b.disabled = false; b.textContent = "削除"; toast("接続できませんでした。"); }
    }));
    const share = view.querySelector(".share-slot");
    if (Sh && share) share.appendChild(Sh.buildShareButtons(ev.raw));
    const pick = document.getElementById("vpick"), vpanel = document.getElementById("vpanel");
    pick && pick.addEventListener("change", () => {
      vpanel.innerHTML = "";
      if (pick.value && Vd) vpanel.appendChild(Vd.buildVideoPanel(d, pick.value));
    });
    const tw = document.getElementById("twSlot"), lk = document.getElementById("lkSlot");
    Tw && Tw.buildTweetPanel(d).then(p => { if (p && tw.isConnected) tw.appendChild(p); });
    Lk && Lk.buildLinkPanel(d).then(p => { if (p && lk.isConnected) lk.appendChild(p); });
    const addBtn = document.getElementById("addToggle");
    addBtn.addEventListener("click", () => {
      const on = view.classList.toggle("adding");
      addBtn.setAttribute("aria-expanded", String(on));
      addBtn.querySelector("span").textContent = on ? "追加の欄を閉じる" : "動画・告知ポスト・関連URLを足す";
      if (on) view.querySelector(".slot").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
    const editBtn = document.getElementById("editToggle");
    editBtn.addEventListener("click", () => openEdit(ev.raw, editBtn));
  }

  // 記録のない日:知っている人が公演を追加できる
  function vNoEvent(d) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(new Date(d).getTime())) return `<p class="empty">日付が正しくありません。</p>`;
    lastYM = d.slice(0, 7);
    const w = dow(d);
    after(() => {
      const b = document.getElementById("editToggle");
      b && b.addEventListener("click", () => openEdit({ event_date: d, weekday: DOW[w], performers: [] }, b));
    });
    return `
      <a class="back" href="#schedule-${d.slice(0, 7)}">${ic("prev", "s")}${fmtYM(d.slice(0, 7))}のスケジュール</a>
      <div class="ehead">
        <div class="edate"><span class="num">${d.slice(0, 4)}</span><b class="num">${d.slice(5, 7)}.${d.slice(8, 10)}</b><span>${DOW_EN[w]}</span></div>
        <h1 class="muted">この日の記録はありません</h1>
      </div>
      <div class="addbar">
        <button type="button" id="editToggle">${ic("plus", "s")}この日の公演を追加する</button>
        <span>この日にSiX-DOGで公演があったことを知っていれば、分かる範囲で入力してください。あとから誰でも追記・修正できます。</span>
      </div>
      <div id="editSlot"></div>`;
  }

  function openEdit(raw, btn) {
    const slot = document.getElementById("editSlot");
    if (!Ed || !slot) return;
    const isNew = !byDate.has(raw.event_date);
    btn.hidden = true;
    slot.innerHTML = sh(isNew ? "公演を追加する" : "公演情報を直す", "EDIT");
    slot.appendChild(Ed.buildEditForm(raw, {
      onCancel: () => { slot.innerHTML = ""; btn.hidden = false; },
      onSave: updated => {
        const i = rawList.findIndex(e => e.event_date === updated.event_date);
        updated = Object.assign({}, updated, { _edited: true });
        if (i >= 0) rawList[i] = updated; else rawList.push(updated);
        build();
        toast("保存しました。");
        render();
      },
    }));
    slot.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  let toastT;
  function toast(msg) {
    let el = document.getElementById("toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("on"), 2600);
  }

  function vArtists() {
    const max = artists[0].dates.length;
    const rows = list => list.map(a => `<a class="arow" href="#artist-${a.id}"><span>${esc(a.name)}</span><span class="tr"><i style="width:${a.dates.length / max * 100}%"></i></span><b class="num">${a.dates.length}</b></a>`).join("");
    setTimeout(() => {
      const f = document.getElementById("af"), out = document.getElementById("alist");
      f && f.addEventListener("input", () => {
        const s = f.value.trim().toLowerCase();
        out.innerHTML = rows((s ? artists.filter(a => a.name.toLowerCase().includes(s)) : artists).slice(0, 60)) || `<p class="empty">見つかりませんでした。</p>`;
      });
    });
    return `
      <div class="wip">${ic("cone")}<div><h2>出演者ページは準備中</h2><p>同じバンドの表記ゆれ(大文字小文字・空白・地名の括弧など)をまだ1つにまとめていないため、回数は名義ごとの数です。名寄せが終わると、出演者ごとのページと「よく一緒に出ていた相手」が正しくつながります。</p></div></div>
      <section class="sec">
        ${sh("出演回数の多い順", "ARTISTS")}
        <label class="search filter">${ic("search")}<input id="af" type="search" placeholder="出演者名でしぼりこむ" autocomplete="off"></label>
        <div class="rows" id="alist">${rows(artists.slice(0, 60))}</div>
      </section>`;
  }
  function vArtist(id) {
    const a = artistByName.get(id);
    if (!a) return `<p class="empty">出演者が見つかりませんでした。</p>`;
    const evs = a.dates.map(d => byDate.get(d));
    const co = new Map();
    evs.forEach(ev => ev.p.forEach(n => { if (n !== a.name) co.set(n, (co.get(n) || 0) + 1); }));
    const top = [...co.entries()].filter(([, c]) => c >= 2).sort((x, y) => y[1] - x[1]).slice(0, 10);
    const years = []; for (let y = 2006; y <= 2019; y++) years.push(y);
    const vids = Vd && Vd.getVideosByPerformer ? Vd.getVideosByPerformer(a.name) : [];
    return `
      <a class="back" href="#artists">${ic("prev", "s")}出演者一覧</a>
      <div class="ahead"><h1>${esc(a.name)}</h1></div>
      <div class="astats">
        <div><b class="num">${a.dates.length}</b><span>SiX-DOG出演回数</span></div>
        <div><b class="num">${fmtD(a.dates[0])}</b><span>初めての出演</span></div>
        <div><b class="num">${fmtD(a.dates[a.dates.length - 1])}</b><span>最後の出演</span></div>
      </div>
      <section class="sec">
        ${sh("年ごとの出演", "TIMELINE")}
        <div class="ydots">${years.map(y => `<div title="${y}年">${"<i></i>".repeat(a.dates.filter(d => d.startsWith(y)).length)}</div>`).join("")}</div>
        <div class="ylab">${years.map(y => `<span>${String(y).slice(2)}</span>`).join("")}</div>
      </section>
      ${top.length ? `<section class="sec">${sh("よく一緒に出ていた相手", "SAME NIGHT", `<a class="more" href="#encounter-${a.id}">邂逅分析で見る ›</a>`)}<div class="chips">${top.map(([n, c]) => `<a class="chip" href="#artist-${artistByName.get(n).id}">${esc(n)}<small>${c}回</small></a>`).join("")}</div></section>` : ""}
      ${vids.length ? `<section class="sec">${sh("動画", "VIDEO")}<ul class="links">${vids.map(v => `<li><a href="${esc(v.video_url)}" target="_blank" rel="noopener noreferrer nofollow">${ic("play")}<span>${esc(v.video_title || v.video_url)}</span><small>${fmtD(v.event_date)}</small></a></li>`).join("")}</ul></section>` : ""}
      <section class="sec">${sh(`出演した公演 ${evs.length}件`, "SHOWS")}<div class="rows">${evs.slice().reverse().map(e => row(e, true)).join("")}</div></section>`;
  }

  function vVenue() {
    const s = 36, R = (x, y, w, h, cls) => `<rect class="${cls}" x="${x * s}" y="${y * s}" width="${w * s}" height="${h * s}"/>`;
    const T = (x, y, t, cls) => `<text class="${cls || "lbl"}" x="${x * s}" y="${y * s}">${t}</text>`;
    setTimeout(() => {
      const b = document.getElementById("enter3d");
      b && b.addEventListener("click", () => V3D.enter(0));
    });
    return `
      <div class="wip">${ic("cone")}<div><h2>3Dの会場は仮組みです</h2><p>残っていた会場見取り図(寸法入り)と写真をもとに組んだ仮の3Dです。機材や壁の色などは推測で、思い出や写真が集まるほど本物に近づけていきます。</p></div></div>
      <div class="enter">${ic("cube")}<p><b>ENTER SiX-DOG</b>スマホは縦でも横でも歩けます(横向きのほうが広く見えます)。左下で歩いて、画面をなぞって見回します。パソコンは W A S D で歩いて、ドラッグで見回します。<br>お客さんのつぶやきは、当時のXに投稿されたSiX-DOGへの声を、名前を出さずに短く言い換えたものです。</p><button type="button" id="enter3d">${ic("cube", "s")}中に入る</button></div>
      <section class="sec">
        ${sh("会場の略図", "FLOOR MAP")}
        <div class="planbox"><svg class="plan" viewBox="-40 -110 650 470" role="img" aria-label="SiX-DOGの見取り図。左にステージとホール、右に楽屋・受付・ドリンクカウンター・階段">
          ${R(8.46, -2.57, 1.68, 2.57, "room")}${R(10.14, -2.57, 6.16, 2.57, "room")}
          ${R(10.14, 0, 4.14, 0.81, "room")}${R(10.14, 0.81, 4.14, 2.13, "room")}${R(14.28, 0, 2.02, 2.94, "room")}
          ${R(6.8, 0, 1.66, 5.12, "room")}${R(11.41, 2.94, 3.37, 1.38, "room")}${R(14.78, 2.94, 1.52, 6.21, "room")}
          ${R(11.0, 4.34, 1.24, 2.39, "room")}${R(12.24, 4.34, 2.54, 2.95, "room")}${R(8.46, 7.85, 3.81, 1.3, "room")}
          ${R(0, 0, 6.8, 9.1, "hall")}${R(0, 0, 6.8, 3.7, "stage")}${R(2.1, 7.5, 2.6, 1.6, "room")}
          ${T(3.4, 2.05, "ステージ")}${T(3.4, 2.55, "床から天井まで 2.05m", "dim")}
          ${T(3.4, 5.4, "ホール")}${T(3.4, 5.9, "天井まで 2.4m", "dim")}${T(3.4, 8.45, "PA")}
          ${T(7.63, 2.0, "楽屋")}${T(9.3, -1.1, "喫煙所")}${T(13.2, -1.1, "楽屋")}${T(12.2, 0.55, "トイレ")}
          ${T(12.2, 2.0, "エントランス")}${T(15.3, 1.6, "EV")}${T(13.1, 3.75, "階段")}${T(15.55, 6.4, "階段")}
          ${T(11.62, 5.65, "受付")}${T(13.5, 6.0, "事務所")}${T(10.37, 8.65, "ドリンク")}
          <line class="dl" x1="0" y1="-${0.5 * s}" x2="${6.8 * s}" y2="-${0.5 * s}"/>${T(3.4, -0.7, "6.8m", "dim")}
          <line class="dl" x1="-${0.5 * s}" y1="0" x2="-${0.5 * s}" y2="${3.7 * s}"/><line class="dl" x1="-${0.5 * s}" y1="${3.7 * s}" x2="-${0.5 * s}" y2="${9.1 * s}"/>
          <text class="dim" transform="translate(${-0.75 * s} ${1.85 * s}) rotate(-90)">3.7m</text>
          <text class="dim" transform="translate(${-0.75 * s} ${6.4 * s}) rotate(-90)">5.4m</text>
        </svg></div>
        <p class="note">寸法は当時の公式サイトの見取り図の記載どおり。部屋の大きさや位置は見取り図からの読み取りで、おおよそです。</p>
      </section>
      <section class="sec">
        ${sh("もとにした資料", "REFERENCE")}
        <div class="photos">
          <figure><img src="img/venue/hall2008.jpg" alt="お客さんのいないホール。天井のむき出しの配管、横一列の照明、黒い幕、銀色の柵、グレーの床" loading="lazy"><figcaption>開演前のホール(公式サイト、2008年頃)</figcaption></figure>
          <figure><img src="img/venue/stage.jpg" alt="正面から見たステージ。ドラム、Marshallのアンプ、柵、色とりどりの照明" loading="lazy"><figcaption>ステージ正面(公式サイト、2016年)</figcaption></figure>
          <figure><img src="img/venue/floor.jpg" alt="フロア後方から見たステージと天井の設備" loading="lazy"><figcaption>フロアの後ろから(公式サイト、2008年頃)</figcaption></figure>
          <figure><img src="img/venue/entrance.jpg" alt="赤い床の入口と、ポスターで埋まった壁" loading="lazy"><figcaption>入口の階段</figcaption></figure>
          <figure><img src="img/venue/greenroom.jpg" alt="鏡とカウンター、丸椅子のある楽屋" loading="lazy"><figcaption>楽屋(公式サイト、2016年)</figcaption></figure>
        </div>
      </section>`;
  }

  // ---------- 邂逅(かいこう)分析:選んだ出演者が、いつ出ていて、どの夜に同じステージに立ったか ----------
  let encSel = [];
  const ENC_MAX = 6;
  function coStars(name) {
    const co = new Map();
    artistByName.get(name).dates.forEach(d => byDate.get(d).p.forEach(n => { if (n !== name) co.set(n, (co.get(n) || 0) + 1); }));
    return [...co.entries()].sort((a, b) => b[1] - a[1]);
  }
  // 起点の出演者と、いちばん多く一緒に出ていた2組
  const encSeed = name => [name, ...coStars(name).slice(0, 2).map(x => x[0])];

  function vData(seedId) {
    if (seedId != null && artistByName.has(seedId)) encSel = encSeed(seedId);
    encSel = encSel.filter(n => artistByName.has(n));
    if (!encSel.length) encSel = encSeed(artists[0].name);
    const max = artists[0].dates.length;
    setTimeout(bindEnc);
    return `
      <section class="sec">
        ${sh("邂逅分析", "ENCOUNTERS")}
        <p class="note" style="margin:-6px 0 16px;font-size:.9rem">出演者を並べると、それぞれがいつSiX-DOGに出ていて、どの夜に同じステージに立っていたかが分かります。点を押すとその公演へ。</p>
        <div class="encpick">
          <label class="search">${ic("search")}<input id="encq" type="search" placeholder="出演者を追加(最大${ENC_MAX}組)" autocomplete="off"></label>
          <div class="chips encsug" id="encsug"></div>
          <div class="chips" id="encsel"></div>
        </div>
        <div id="enc"></div>
      </section>
      <section class="sec">
        ${sh("出演回数 TOP10", "RANKING")}
        <div class="rows">${artists.slice(0, 10).map(a => `<a class="arow" href="#artist-${a.id}"><span>${esc(a.name)}</span><span class="tr"><i style="width:${a.dates.length / max * 100}%"></i></span><b class="num">${a.dates.length}</b></a>`).join("")}</div>
      </section>
      ${dataTrend()}
      ${dataReactions()}
      ${dataNeedsReview()}
      <p class="note">記録は残っていた公式サイトの写しや当時の投稿から集めたもので、抜けている月や推定を含みます。数字は「残っている記録の中では」という目安です。</p>`;
  }
  // 年ごとの公演数と、その年に出ていた出演者(名義)の数
  function dataTrend() {
    const ys = new Map();
    events.forEach(e => {
      const y = +e.d.slice(0, 4), o = ys.get(y) || { n: 0, who: new Set(), fresh: 0 };
      o.n++; e.p.forEach(p => o.who.add(p)); ys.set(y, o);
    });
    artists.forEach(a => { const o = ys.get(+a.dates[0].slice(0, 4)); if (o) o.fresh++; });
    const list = [...ys.entries()].sort((a, b) => a[0] - b[0]);
    const max = Math.max(...list.map(([, o]) => o.n));
    return `<section class="sec">
        ${sh("年ごとの推移", "TREND")}
        <div class="trend" role="table" aria-label="年ごとの公演数・出演者数・初登場の数">
          <div class="tr-h" role="row"><span role="columnheader">年</span><span role="columnheader">公演数</span><span role="columnheader" class="num">出演者</span><span role="columnheader" class="num">初登場</span></div>
          ${list.map(([y, o]) => `<a class="tr-r" role="row" href="#schedule-${busiest(y)}"><span role="cell" class="en">${y}</span><span role="cell" class="tr-bar"><i style="width:${o.n / max * 100}%"></i><b class="num">${o.n}</b></span><span role="cell" class="num">${o.who.size}</span><span role="cell" class="num">${o.fresh}</span></a>`).join("")}
        </div>
        <p class="note">「初登場」は、その年に初めてSiX-DOGの記録に出てくる出演者の数です。行を押すと、その年でいちばん公演が多かった月を開きます。</p>
      </section>`;
  }
  // 「アツかった」「エモい」が多い公演
  function dataReactions() {
    const ranked = events.map(e => ({ e, h: hypeOn(e.d), m: emoiOn(e.d) })).filter(x => x.h + x.m > 0)
      .sort((a, b) => (b.h + b.m) - (a.h + a.m) || b.e.d.localeCompare(a.e.d)).slice(0, 10);
    return `<section class="sec">
        ${sh("反応の多い公演", "REACTIONS")}
        ${ranked.length ? `<div class="rows">${ranked.map(x => row(x.e, true)).join("")}</div>` : `<p class="empty">まだ反応がありません。公演ページの「アツかった」「エモい」を押すと、ここに並びます。</p>`}
      </section>`;
  }
  // 関連ページはあるのに出演者が空の公演(出典から出演者を埋められる候補)
  function dataNeedsReview() {
    const list = events.filter(e => !e.p.length && linksOn(e.d).length).reverse();
    return `<section class="sec">
        ${sh("出演者を埋められそうな公演", "TO DO")}
        <p class="note" style="margin:-6px 0 12px">関連ページは登録されているのに、出演者がまだ入っていない公演です。関連ページを見て出演者が分かったら、公演ページの「公演情報を直す」から入れてください。</p>
        ${list.length ? `<div class="rows">${list.slice(0, 30).map(e => row(e, true)).join("")}</div>${list.length > 30 ? `<p class="note">ほか${list.length - 30}件</p>` : ""}` : `<p class="empty">いまは該当する公演はありません。</p>`}
      </section>`;
  }
  function bindEnc() {
    const q = document.getElementById("encq"), sug = document.getElementById("encsug");
    if (!q) return;
    renderEnc();
    q.addEventListener("input", () => {
      const s = q.value.trim().toLowerCase();
      sug.innerHTML = !s ? "" : artists.filter(a => a.name.toLowerCase().includes(s) && !encSel.includes(a.name)).slice(0, 8)
        .map(a => `<button type="button" class="chip" data-add="${esc(a.name)}">${ic("plus", "s")}${esc(a.name)}<small>${a.dates.length}回</small></button>`).join("");
    });
    if (bindEnc.done) return;
    bindEnc.done = true;
    view.addEventListener("click", e => {
      const q = document.getElementById("encq"), sug = document.getElementById("encsug");
      if (!q) return;
      const add = e.target.closest("[data-add]"), del = e.target.closest("[data-del]");
      if (add && encSel.length < ENC_MAX && !encSel.includes(add.dataset.add)) { encSel.push(add.dataset.add); q.value = ""; sug.innerHTML = ""; renderEnc(); }
      else if (add && encSel.length >= ENC_MAX) { sug.innerHTML = `<p class="note">並べられるのは${ENC_MAX}組までです。どれかを外してから追加してください。</p>`; }
      if (del) { encSel = encSel.filter(n => n !== del.dataset.del); renderEnc(); }
    });
  }
  function renderEnc() {
    const selEl = document.getElementById("encsel"), out = document.getElementById("enc");
    if (!out) return;
    selEl.innerHTML = encSel.map(n => `<span class="chip on">${esc(n)}<button type="button" data-del="${esc(n)}" aria-label="${esc(n)}を外す">${ic("x", "s")}</button></span>`).join("");
    if (!encSel.length) { out.innerHTML = `<p class="empty">出演者を追加すると、ここに並びます。</p>`; return; }
    const sets = encSel.map(n => new Set(artistByName.get(n).dates));
    // 2組以上がそろった夜
    const shared = new Map();
    sets.forEach((st, i) => st.forEach(d => { if (!shared.has(d)) shared.set(d, []); shared.get(d).push(i); }));
    const together = [...shared.entries()].filter(([, idx]) => idx.length >= 2).sort((a, b) => a[0].localeCompare(b[0]));
    // 時間軸(選んだ出演者の出演期間を年単位で)
    const all = [...shared.keys()].sort();
    const y0 = +all[0].slice(0, 4), y1 = +all[all.length - 1].slice(0, 4) + 1;
    const t = d => new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)).getTime();
    const T0 = new Date(y0, 0, 1).getTime(), T1 = new Date(y1, 0, 1).getTime();
    const W = 900, L = 170, R = 20, top = 30, rowH = 40, H = top + encSel.length * rowH + 10;
    const X = d => L + (t(d) - T0) / (T1 - T0) * (W - L - R);
    const Y = i => top + i * rowH + rowH / 2;
    let svg = "";
    for (let y = y0; y <= y1; y++) {
      const x = L + (new Date(y, 0, 1).getTime() - T0) / (T1 - T0) * (W - L - R);
      svg += `<line class="gl" x1="${x}" y1="${top - 6}" x2="${x}" y2="${H - 6}"/>`;
      if (y < y1) svg += `<text class="yl" x="${x + 4}" y="${top - 12}">${y}</text>`;
    }
    together.forEach(([d, idx]) => { svg += `<line class="link" x1="${X(d)}" y1="${Y(Math.min(...idx))}" x2="${X(d)}" y2="${Y(Math.max(...idx))}"/>`; });
    encSel.forEach((n, i) => {
      const a = artistByName.get(n);
      svg += `<text class="nm" x="${L - 12}" y="${Y(i) + 4}">${esc(n.length > 13 ? n.slice(0, 12) + "…" : n)} <tspan class="ct">${a.dates.length}</tspan></text>`;
      svg += `<line class="lane" x1="${L}" y1="${Y(i)}" x2="${W - R}" y2="${Y(i)}"/>`;
      a.dates.forEach(d => {
        const ev = byDate.get(d), hit = shared.get(d).length >= 2;
        svg += `<a href="#event-${d}"><circle class="dot${hit ? " hit" : ""}" cx="${X(d)}" cy="${Y(i)}" r="${hit ? 6 : 5}"><title>${fmtD(d)} ${esc(title(ev))}</title></circle></a>`;
      });
    });
    // 組み合わせごとの回数
    const pairs = [];
    for (let i = 0; i < encSel.length; i++) for (let j = i + 1; j < encSel.length; j++) {
      let c = 0; sets[i].forEach(d => { if (sets[j].has(d)) c++; });
      if (c) pairs.push([encSel[i], encSel[j], c]);
    }
    pairs.sort((a, b) => b[2] - a[2]);
    // 選んだ出演者たちと、何組とも同じ夜に出ていた相手(次に並べる候補)
    const bridge = new Map();
    encSel.forEach((n, i) => artistByName.get(n).dates.forEach(d => byDate.get(d).p.forEach(o => {
      if (encSel.includes(o)) return;
      const b = bridge.get(o) || { who: new Set(), nights: new Set() };
      b.who.add(i); b.nights.add(d); bridge.set(o, b);
    })));
    const need = Math.min(2, encSel.length);
    const bridges = [...bridge.entries()].filter(([, b]) => b.who.size >= need)
      .sort((a, b) => b[1].who.size - a[1].who.size || b[1].nights.size - a[1].nights.size).slice(0, 8);
    out.innerHTML = `
      <p class="encsum">${encSel.length >= 2 ? `この${encSel.length}組のうち2組以上が同じ夜に出ていたのは <b class="num">${together.length}</b> 回。` : `${esc(encSel[0])}の出演は <b class="num">${artistByName.get(encSel[0]).dates.length}</b> 回。もう1組足すと、同じ夜が線でつながります。`}</p>
      <div class="encbox"><svg class="encsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="出演者ごとの出演日と、同じ夜に出ていた日のつながり">${svg}</svg></div>
      <p class="note">点がそれぞれの出演日、ターコイズの点と縦線が「同じ夜に出ていた」日です。</p>
      ${pairs.length ? `<h3 class="enc-h">組み合わせごとの共演回数</h3><ul class="pairs">${pairs.map(([a, b, c]) => `<li><span>${esc(a)}</span><i>×</i><span>${esc(b)}</span><b class="num">${c}回</b></li>`).join("")}</ul>` : ""}
      ${together.length ? `<h3 class="enc-h">同じ夜 ${together.length}回</h3><div class="rows">${together.slice().reverse().slice(0, 30).map(([d]) => row(byDate.get(d), true)).join("")}</div>${together.length > 30 ? `<p class="note">ほか${together.length - 30}回</p>` : ""}` : ""}
      ${bridges.length ? `<h3 class="enc-h">この顔ぶれとつながっていた相手</h3><p class="note" style="margin:-4px 0 10px">${encSel.length >= 2 ? "並べた出演者のうち2組以上と同じ夜に出ていた相手です。" : "同じ夜に出ていた回数の多い相手です。"}押すと並べられます。</p><div class="chips">${bridges.map(([n, b]) => `<button type="button" class="chip" data-add="${esc(n)}">${ic("plus", "s")}${esc(n)}<small>${b.nights.size}夜</small></button>`).join("")}</div>` : ""}`;
  }
  function vHowto() {
    after(fillChangelog);
    return `
      <section class="sec howto">
        ${sh("使い方", "HOW TO")}
        <h3>見る</h3><p>SCHEDULEで年と月を選ぶと、その月の公演が並びます。公演を開くと、出演者・時間・料金と、残っている動画・告知ポスト・関連ページを見られます。出演者名を押すと、そのバンドがSiX-DOGに出たすべての日と、よく一緒に出ていた相手が分かります。</p>
        <h3>足す・直す</h3><p>公演ページの「動画・告知ポスト・関連URLを足す」から、出演者ごとの動画、当日のXの告知ポスト、関連ページのURLを登録できます。分かっていない出演者や間違っている情報は「公演情報を直す」から直せます。記録のない日も、カレンダーでその日を押すと公演を追加できます。ログインは要りません。</p>
        <h3>思い出す</h3><p>「アツかった」「エモい」で、その夜への気持ちを残せます(1つの公演につき、それぞれ1回ずつ)。VENUEでは、仮組みの3DでSiX-DOGの中を歩けます。</p>
        <h3>調べる</h3><p>DATAの「邂逅分析」で出演者を並べると、それぞれがいつ出ていて、どの夜に同じステージに立っていたかが分かります。ヘッダーの柴犬を押すと、公演記録について質問できます(このページの中で記録を調べて答えます。AIは使っていません)。</p>
        <p class="note">データは有志による調査と復元のため、一部に推定を含みます。</p>
      </section>
      <section class="sec">
        ${sh("更新履歴", "CHANGELOG")}
        <div id="changelog"><p class="note">読み込んでいます…</p></div>
      </section>`;
  }
  // ---------- 管理(投稿の削除) ----------
  const Ad = window.SixDogAdmin;
  let admData = null;
  async function refreshData() {
    const overrides = Ed ? await Ed.fetchOverridesPublic().catch(() => ({})) : {};
    rawList = Ed ? Ed.applyOverrides(baseList, overrides) : baseList;
    await Promise.all([Vd && Vd.loadVideoIndex(), Lk && Lk.loadLinkIndex(), Tw && Tw.loadTweetIndex(), Hy && Hy.loadHypeIndex(), Em && Em.loadEmoiIndex()].map(x => Promise.resolve(x).catch(() => null)));
    build();
  }
  function vAdmin(filter) {
    after(() => bindAdmin(filter));
    return `
      <section class="sec">
        ${sh("投稿の管理", "ADMIN")}
        <p class="note" style="margin:-6px 0 16px;font-size:.88rem">みんなが登録した動画・関連URL・告知ポスト・公演情報の修正や追加・反応を、管理者だけが削除できます。パスワードはサーバー側で確かめます。</p>
        <div id="adm"><p class="note">読み込んでいます…</p></div>
      </section>`;
  }
  async function bindAdmin(filter) {
    const box = document.getElementById("adm");
    if (!Ad) { box.innerHTML = `<p class="empty">管理機能を読み込めませんでした。</p>`; return; }
    if (!Ad.isIn()) {
      let set = true;
      try { set = await Ad.status(); } catch (e) { box.innerHTML = `<p class="empty">接続できませんでした。時間をおいてもう一度お試しください。</p>`; return; }
      if (!box.isConnected) return;
      box.innerHTML = set ? `
        <form class="adm-form" id="admLogin">
          <label>管理パスワード<input type="password" id="admPw" autocomplete="current-password" required></label>
          <button type="submit">ログイン</button><span class="adm-msg" id="admMsg"></span>
        </form>` : `
        <form class="adm-form" id="admSetup">
          <p class="note">最初に管理パスワードを決めてください(8文字以上)。決められるのは1回だけで、あとから変えるには今のパスワードが必要です。</p>
          <label>新しいパスワード<input type="password" id="admNew" autocomplete="new-password" minlength="8" required></label>
          <label>もう一度<input type="password" id="admNew2" autocomplete="new-password" minlength="8" required></label>
          <button type="submit">設定する</button><span class="adm-msg" id="admMsg"></span>
        </form>`;
      const msg = document.getElementById("admMsg");
      const fl = document.getElementById("admLogin"), fs = document.getElementById("admSetup");
      fl && fl.addEventListener("submit", async e => {
        e.preventDefault(); const v = document.getElementById("admPw").value; msg.textContent = "確認中…";
        try { const r = await Ad.login(v); if (r === "ok") { Ad.setPw(v); bindAdmin(filter); } else msg.textContent = Ad.MSG[r] || r; }
        catch (err) { msg.textContent = "接続できませんでした。"; }
      });
      fs && fs.addEventListener("submit", async e => {
        e.preventDefault(); const a = document.getElementById("admNew").value, b = document.getElementById("admNew2").value;
        if (a !== b) { msg.textContent = "2つのパスワードが一致しません。"; return; }
        msg.textContent = "設定中…";
        try { const r = await Ad.setup(a); if (r === "ok") { Ad.setPw(a); bindAdmin(filter); } else msg.textContent = Ad.MSG[r] || r; }
        catch (err) { msg.textContent = "接続できませんでした。"; }
      });
      return;
    }
    box.innerHTML = `<p class="note">読み込んでいます…</p>`;
    admData = await Ad.fetchAll();
    if (!box.isConnected) return;
    box.innerHTML = `
      <div class="adm-bar">
        <label class="search filter">${ic("search")}<input id="admQ" type="search" placeholder="日付(2015-09 など)や言葉でしぼりこむ" value="${esc(filter)}" autocomplete="off"></label>
        <button type="button" class="adm-out" id="admOut">ログアウト</button>
      </div>
      <div id="admList"></div>
      <details class="adm-pw"><summary>管理パスワードを変える</summary>
        <form class="adm-form" id="admChange">
          <label>新しいパスワード<input type="password" id="admNew" autocomplete="new-password" minlength="8" required></label>
          <button type="submit">変える</button><span class="adm-msg" id="admMsg2"></span>
        </form>
      </details>`;
    const q = document.getElementById("admQ");
    q.addEventListener("input", () => renderAdmin(q.value.trim()));
    document.getElementById("admOut").addEventListener("click", () => { Ad.setPw(""); render(); });
    document.getElementById("admChange").addEventListener("submit", async e => {
      e.preventDefault(); const m2 = document.getElementById("admMsg2"), n = document.getElementById("admNew").value;
      try { const r = await Ad.change(Ad.pw(), n); if (r === "ok") { Ad.setPw(n); m2.textContent = "変えました。"; } else m2.textContent = Ad.MSG[r] || r; }
      catch (err) { m2.textContent = "接続できませんでした。"; }
    });
    document.getElementById("admList").addEventListener("click", onAdminDelete);
    renderAdmin(filter);
  }
  const when = iso => { const t = new Date(iso); return isNaN(t) ? "" : `${t.getFullYear()}.${pad(t.getMonth() + 1)}.${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}`; };
  function renderAdmin(f) {
    const out = document.getElementById("admList");
    if (!out || !admData) return;
    const hit = (d, text) => !f || d.startsWith(f) || (text || "").toLowerCase().includes(f.toLowerCase());
    const base = new Set(baseList.map(e => e.event_date));
    const row = (kind, key, d, main, sub, at) => `
      <div class="adm-row"><a href="#event-${esc(d)}" class="adm-d en num">${esc(d.replace(/-/g, "."))}</a>
        <div class="adm-main"><b>${main}</b>${sub ? `<small>${sub}</small>` : ""}<small>${esc(when(at))}</small></div>
        <button type="button" class="adm-del" data-kind="${kind}" data-key="${esc(key)}">削除</button></div>`;
    const group = (title, en, list) => `<section class="adm-sec"><h3>${title} <span class="en">${en}</span> <small>${list.length}件</small></h3>${list.length ? list.join("") : `<p class="note">ありません。</p>`}</section>`;
    const D = admData;
    const vids = D.videos.filter(v => hit(v.event_date, [v.performer_name, v.video_title, v.video_url, v.submitted_by].join(" "))).map(v => row("video", v.id, v.event_date, esc(v.video_title || v.video_url), `${esc(v.performer_name || "")} ・ <a href="${esc(v.video_url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(v.video_url)}</a>${v.submitted_by ? ` ・ 投稿者:${esc(v.submitted_by)}` : ""}`, v.submitted_at));
    const lks = D.links.filter(l => hit(l.event_date, [l.title, l.url].join(" "))).map(l => row("link", l.id, l.event_date, esc(l.title || l.url), `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(l.url)}</a>`, l.submitted_at));
    const tws = D.tweets.filter(t => hit(t.event_date, t.tweet_id)).map(t => row("tweet", t.id, t.event_date, `Xの投稿 ${esc(t.tweet_id)}`, `<a href="https://x.com/i/status/${esc(t.tweet_id)}" target="_blank" rel="noopener noreferrer">開く</a>`, t.submitted_at));
    const ovs = D.overrides.filter(o => hit(o.event_date, [o.title, (o.performers || []).join(" ")].join(" "))).map(o => row("override", o.event_date, o.event_date, esc(o.title || "(タイトルなし)"), `${base.has(o.event_date) ? "元の記録への修正(削除すると元の記録に戻ります)" : "みんなが追加した公演(削除するとこの日の公演が消えます)"}${(o.performers || []).length ? ` ・ ${esc(o.performers.join(" / "))}` : ""}`, o.updated_at));
    const rx = [...D.hype.map(h => ["hype", h]), ...D.emoi.map(e => ["emoi", e])].filter(([, r]) => hit(r.event_date, "")).sort((a, b) => b[1].created_at.localeCompare(a[1].created_at))
      .map(([k, r]) => row(k, r.id, r.event_date, k === "hype" ? "アツかった" : "エモい", "", r.created_at));
    out.innerHTML = group("動画", "VIDEO", vids) + group("関連ページ", "SOURCE", lks) + group("告知ポスト", "POST", tws) + group("公演情報の修正・追加", "EDIT", ovs) + group("反応", "REACTION", rx);
  }
  async function onAdminDelete(e) {
    const b = e.target.closest(".adm-del");
    if (!b) return;
    const kind = b.dataset.kind, key = b.dataset.key, label = b.closest(".adm-row").querySelector(".adm-main b").textContent;
    if (!confirm(`削除しますか?元に戻せません。\n\n${label}`)) return;
    b.disabled = true; b.textContent = "削除中…";
    try {
      const r = await Ad.remove(kind, key);
      if (String(r).startsWith("ok")) {
        const k = { video: "videos", link: "links", tweet: "tweets", hype: "hype", emoi: "emoi", override: "overrides" }[kind];
        admData[k] = admData[k].filter(x => String(kind === "override" ? x.event_date : x.id) !== key);
        renderAdmin((document.getElementById("admQ") || {}).value || "");
        toast("削除しました。");
        refreshData();
      } else {
        b.disabled = false; b.textContent = "削除";
        if (r === "wrong" || r === "not_set") { Ad.setPw(""); toast(Ad.MSG[r]); render(); } else toast(Ad.MSG[r] || "削除できませんでした。");
      }
    } catch (err) { b.disabled = false; b.textContent = "削除"; toast("接続できませんでした。"); }
  }

  // 更新履歴(data/changelog.json)。新しい順。最初の数日分だけ開いておく
  let logP = null;
  function fillChangelog() {
    logP = logP || fetch("data/changelog.json", { cache: "no-cache" }).then(r => r.json()).catch(() => null);
    logP.then(log => {
      const box = document.getElementById("changelog");
      if (!box) return;
      if (!log || !log.length) { box.innerHTML = `<p class="note">更新履歴を読み込めませんでした。</p>`; return; }
      box.innerHTML = log.map((day, i) => `
        <details class="log"${i < 3 ? " open" : ""}>
          <summary><span class="en num">${esc(day.date.replace(/-/g, "."))}</span>${day.title ? `<b>${esc(day.title)}</b>` : ""}</summary>
          <ul>${day.items.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
        </details>`).join("");
    });
  }

  // ---------- router ----------
  const TAB_TITLE = { top: "", schedule: "スケジュール", artists: "出演者", venue: "3D会場", data: "データ", howto: "使い方" };
  function render() {
    let h = "top";
    try { h = decodeURIComponent(location.hash.slice(1)) || "top"; } catch (e) { /* 壊れたURLはトップへ */ }
    let html, tab = "top", m, name = "";
    post.length = 0;
    if (h === "top") html = vTop();
    else if ((m = h.match(/^schedule(?:-(\d{4}-\d{2}))?$/))) { html = vSchedule(m[1]); tab = "schedule"; name = lastYM ? fmtYM(lastYM) : ""; }
    else if ((m = h.match(/^event-(\d{4}-\d{2}-\d{2})$/))) { html = vEvent(m[1]); tab = "schedule"; const ev = byDate.get(m[1]); name = `${fmtD(m[1])} ${ev ? title(ev) : "記録なし"}`; }
    else if (h === "artists") { html = vArtists(); tab = "artists"; }
    else if ((m = h.match(/^artist-(.+)$/))) { html = vArtist(m[1]); tab = "artists"; name = m[1]; }
    else if (h === "venue") { html = vVenue(); tab = "venue"; }
    else if (h === "data") { html = vData(); tab = "data"; }
    else if ((m = h.match(/^encounter-(.+)$/))) { html = vData(m[1]); tab = "data"; }
    else if (h === "howto") { html = vHowto(); tab = "howto"; }
    else if ((m = h.match(/^admin(?:-(.+))?$/))) { html = vAdmin(m[1] || ""); tab = "admin"; name = "管理"; }
    else html = vTop();
    document.body.classList.toggle("compact", tab !== "top");
    view.classList.remove("fade", "adding"); void view.offsetWidth; view.classList.add("fade");
    view.classList.toggle("admin", isAdmin());
    view.innerHTML = html;
    document.title = [name || TAB_TITLE[tab], "SiX-DOG ARCHIVE"].filter(Boolean).join(" — ");
    document.querySelectorAll("#tabs a").forEach(a => a.removeAttribute("aria-current"));
    document.querySelectorAll('#tabs a[data-tab="' + tab + '"]').forEach(a => a.setAttribute("aria-current", "page"));
    const navTop = document.querySelector("nav.tabs").offsetTop;
    if (window.scrollY > navTop) window.scrollTo(0, navTop);
    bindSearch();
    if (tab === "top") fillRecent();
    const sel = document.getElementById("msel");
    sel && sel.addEventListener("change", () => { location.hash = "schedule-" + sel.value; });
    post.splice(0).forEach(fn => fn());
  }

  // ---------- 柴犬:押すと鳴いて、公演記録の質問画面を開く ----------
  const dogwin = document.getElementById("dogwin"), headDog = document.getElementById("dog");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function bark(el) {
    el.classList.remove("say"); void el.offsetWidth; el.classList.add("say");
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("say"), 1200);
  }
  headDog.addEventListener("click", () => { bark(dogwin); openChat(); });

  // ---------- 柴犬:公演記録に答える(ページの中だけで調べる。AIや外部サービスは使わない) ----------
  const chat = document.getElementById("chat"), chatLog = document.getElementById("chatLog");
  const chatForm = document.getElementById("chatForm"), chatIn = document.getElementById("chatIn"), chatSend = document.getElementById("chatSend");
  const SUGG = ["いちばん多く出ていたバンドは?", "2013年11月の8周年イベントの出演者は?", "緑黄色社会はいつ出てた?", "閉店前の最後の1週間は何があった?"];
  function fmtAnswer(text) {
    return esc(text).replace(/(\d{4})[.\-\/年](\d{1,2})[.\-\/月](\d{1,2})日?/g, (m, y, mo, d) => {
      const key = `${y}-${pad(mo)}-${pad(d)}`;
      return byDate.has(key) ? `<a href="#event-${key}">${m}</a>` : m;
    }).replace(/\n/g, "<br>");
  }
  function bubble(cls, html) {
    const el = document.createElement("div");
    el.className = "msg " + cls; el.innerHTML = html;
    chatLog.appendChild(el); chatLog.scrollTop = chatLog.scrollHeight;
    return el;
  }
  function openChat() {
    chat.hidden = false;
    if (!chatLog.children.length) {
      bubble("bot", `SiX-DOGの記録のことなら聞いてね。${events.length.toLocaleString()}件の公演から調べて答えるワン。バンド名、年月、「8周年」「閉店」などで聞いてみて。`);
      const s = document.createElement("div");
      s.className = "sugg";
      s.innerHTML = SUGG.map(q => `<button type="button">${esc(q)}</button>`).join("");
      s.addEventListener("click", e => { const b = e.target.closest("button"); if (b) ask(b.textContent); });
      chatLog.appendChild(s);
    }
    if (matchMedia("(pointer:fine)").matches) chatIn.focus();
  }
  document.getElementById("chatClose").addEventListener("click", () => { chat.hidden = true; });
  // ---- ページの中だけで答える(AIを使わない・利用枠を使わない) ----
  const z2h = s => String(s).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  const lineOf = e => `・${fmtD(e.d)} ${e.t || "(公演名不明)"}${e.p.length ? `\n  出演:${e.p.join(" / ")}` : ""}`;
  const listOf = (evs, max) => evs.slice(0, max).map(lineOf).join("\n") + (evs.length > max ? `\n…ほか${evs.length - max}件` : "");
  const annivNo = e => { const m = z2h(e.t).match(/(\d+)\s*(?:[周週]年|(?:st|nd|rd|th)\s*Anniversary)/i); return m ? +m[1] : null; };
  function localAnswer(raw) {
    const q = z2h(raw).trim(), lq = q.toLowerCase();
    const ym = q.match(/(\d{4})\s*年\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*日)?/);
    const yOnly = !ym && q.match(/(\d{4})\s*年/);
    const md = !ym && q.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    const prefix = ym ? `${ym[1]}-${pad(ym[2])}${ym[3] ? "-" + pad(ym[3]) : ""}` : yOnly ? yOnly[1] : "";

    // 周年イベント(「8周年」「12th Anniversary」など)
    if (/周年|週年|anniversary/i.test(q)) {
      const n = (q.match(/(\d+)\s*周年/) || [])[1];
      const hits = events.filter(e => annivNo(e) != null && (!n || annivNo(e) === +n) && (!prefix || e.d.startsWith(prefix)));
      if (hits.length) return `${n ? n + "周年" : "周年"}の記念イベントの記録は${hits.length}件あるワン。\n${listOf(hits, 10)}`;
    }
    // 閉店前・開店直後
    if (/閉店|最後|ラスト|ファイナル/.test(q) && !prefix) {
      const lastD = events[events.length - 1].d, from = new Date(lastD); from.setDate(from.getDate() - 7);
      const f = `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`;
      const hits = events.filter(e => e.d >= f);
      return `SiX-DOGは${fmtD(lastD)}に閉店したワン。最後の1週間の記録はこれ。\n${listOf(hits, 10)}`;
    }
    if (/開店|オープン|最初|いちばん古|一番古/.test(q) && !prefix) {
      return `開店は2005年11月ごろ。記録が残っているいちばん古い公演はこれだワン。\n${listOf(events.slice(0, 5), 5)}`;
    }
    // 出演回数のランキング(年の指定があればその年)
    if (/(いちばん|一番|最も|もっとも|多く|ランキング|常連|トップ|top)/i.test(q) && /(出|バンド|出演|アーティスト|常連)/.test(q)) {
      const pool = prefix ? events.filter(e => e.d.startsWith(prefix)) : events;
      const cnt = new Map();
      pool.forEach(e => e.p.forEach(n => cnt.set(n, (cnt.get(n) || 0) + 1)));
      const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      if (top.length) return `${prefix ? prefix.replace("-", "年") + (prefix.length > 4 ? "月" : "年") + "に" : ""}いちばん多く出ていたのは「${top[0][0]}」で${top[0][1]}回だワン。\n${top.map(([n, c], i) => `${i + 1}. ${n}(${c}回)`).join("\n")}\n※表記ゆれは別名義として数えています。`;
    }
    // 出演者の名前が質問に入っている
    const named = artists.filter(a => a.name.length >= 2 && lq.includes(a.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length);
    if (named.length) {
      const a = named[0];
      const evs = a.dates.filter(d => !prefix || d.startsWith(prefix)).map(d => byDate.get(d));
      if (!evs.length) return `「${a.name}」は${prefix}の記録には見つからなかったワン。全期間では${a.dates.length}回出ているよ。`;
      const co = new Map();
      a.dates.forEach(d => byDate.get(d).p.forEach(n => { if (n !== a.name) co.set(n, (co.get(n) || 0) + 1); }));
      const often = [...co.entries()].filter(([, c]) => c >= 2).sort((x, y) => y[1] - x[1]).slice(0, 3);
      return `「${a.name}」はSiX-DOGに${a.dates.length}回出ているワン。はじめては${fmtD(a.dates[0])}、最後は${fmtD(a.dates[a.dates.length - 1])}。\n${listOf(evs.slice().reverse(), 8)}${often.length ? `\nよく一緒に出ていた相手:${often.map(([n, c]) => `${n}(${c}回)`).join("、")}` : ""}`;
    }
    // 日付・月・年
    if (prefix) {
      const hits = events.filter(e => e.d.startsWith(prefix));
      if (!hits.length) return `${raw.match(/\d{4}\s*年[^のはにでを?？]*/)[0]}の公演は記録に見つからなかったワン。`;
      if (prefix.length === 4) {
        const byM = new Map(); hits.forEach(e => byM.set(e.d.slice(5, 7), (byM.get(e.d.slice(5, 7)) || 0) + 1));
        const best = [...byM.entries()].sort((a, b) => b[1] - a[1])[0];
        return `${prefix}年の公演の記録は${hits.length}件。いちばん多いのは${+best[0]}月の${best[1]}件だワン。月ごとの一覧はSCHEDULEから見られるよ。`;
      }
      return `${prefix.slice(0, 4)}年${+prefix.slice(5, 7)}月${prefix.length > 7 ? +prefix.slice(8) + "日" : ""}の記録は${hits.length}件だワン。\n${listOf(hits, 12)}`;
    }
    if (md) {
      const key = `-${pad(md[1])}-${pad(md[2])}`;
      const hits = events.filter(e => e.d.endsWith(key));
      return hits.length ? `${+md[1]}月${+md[2]}日の公演は、年をまたいで${hits.length}件あるワン。\n${listOf(hits, 10)}` : `${+md[1]}月${+md[2]}日の公演は記録に見つからなかったワン。`;
    }
    // 言葉で探す(公演名・出演者名に含まれる語)
    const stop = /(は|が|を|に|の|で|と|って|いつ|どこ|何|なに|どんな|だれ|誰|出て|出た|出てた|出演|ライブ|イベント|公演|ですか|でしたか|ました|教えて|ください|ある|あった|あります|知りたい|について|[?？!！。、\s])/g;
    const words = q.replace(stop, " ").split(" ").filter(w => w.length >= 2);
    for (const w of words) {
      const hits = events.filter(e => (e.t + " " + e.p.join(" ")).toLowerCase().includes(w.toLowerCase()));
      if (hits.length) return `「${w}」が入っている公演の記録は${hits.length}件だワン。\n${listOf(hits.slice().reverse(), 10)}`;
    }
    return null;
  }

  function ask(q) {
    q = String(q || "").trim();
    if (!q) return;
    bubble("me", esc(q));
    chatIn.value = "";
    const local = localAnswer(q);
    if (local) { bubble("bot", fmtAnswer(local)); return; }
    bubble("bot", "記録からは見つけられなかったワン。バンド名や「2015年5月」「8周年」「閉店」のように聞いてみてね。");
  }
  chatForm.addEventListener("submit", e => { e.preventDefault(); ask(chatIn.value); });

  // ---------- 3D会場(仮組み) ----------
  // 座標は見取り図のメートル。xは右(ホール→階段)、zは下(ステージ→客席)、yは高さ。
  const STOPS = [
    { name: "階段の上(入口)", note: "地上から地下へ。赤い床とポスターの壁", x: 15.5, z: 8.6, yaw: 0 },
    { name: "踊り場", note: "折り返して、もう一段下へ", x: 15.5, z: 3.6, yaw: Math.PI / 2 },
    { name: "受付", note: "チケットとドリンク代", x: 10.2, z: 5.5, yaw: -Math.PI / 2 },
    { name: "ドリンクカウンター", note: "ドリンクチケットと交換", x: 10.3, z: 7.2, yaw: Math.PI },
    { name: "ホールの入口", note: "防音扉を抜けると、低い天井の箱", x: 6.0, z: 7.1, yaw: 0.46 },
    { name: "PA卓の横", note: "いちばん後ろからステージを見る", x: 5.3, z: 8.3, yaw: 0.35 },
    { name: "柵の前", note: "ステージまで手が届く距離", x: 3.4, z: 4.5, yaw: 0 },
    { name: "ステージの上", note: "ボーカルマイクの後ろから客席を見る", x: 3.4, z: 2.5, yaw: Math.PI },
    { name: "楽屋", note: "鏡とカウンターと丸椅子", x: 7.6, z: 2.6, yaw: -Math.PI / 2 },
  ];
  // 歩ける範囲(壁の内側)。高さは床の高さ。階段は位置に応じて上がる
  const WALK = [
    ["ステージ", 0.35, 0.35, 6.45, 3.55, 0.35],
    ["楽屋への扉", 6.35, 0.6, 7.0, 1.25, 0.18],
    ["ホール", 0.35, 4.15, 6.45, 7.4, 0], ["ホール", 0.35, 7.4, 2.0, 8.75, 0], ["ホール", 4.8, 7.4, 6.45, 8.75, 0],
    ["ホールの入口", 6.3, 6.6, 7.0, 7.6, 0],
    ["通路", 6.9, 5.25, 10.9, 7.7, 0], ["ドリンクカウンター前", 10.9, 7.35, 14.6, 7.7, 0],
    ["ロビー", 8.6, 0.15, 11.35, 4.3, 0], ["ロビー", 8.6, 4.3, 10.95, 5.25, 0],
    ["エントランス", 10.25, 0.95, 14.15, 2.85, 0],
    ["階段", 11.35, 3.05, 14.85, 4.2, (x) => Math.max(0, (x - 11.35) / 3.5 * 1.5)],
    ["踊り場", 14.85, 3.05, 16.2, 4.2, 1.5],
    ["階段", 14.85, 4.2, 16.2, 9.05, (x, z) => 1.5 + (z - 4.2) / 4.85 * 1.5],
    ["楽屋", 6.9, 0.15, 8.36, 5.0, 0], ["楽屋の扉", 8.3, 0.4, 8.7, 1.1, 0],
  ];
  function walkAt(x, z) {
    for (const r of WALK) if (x >= r[1] && x <= r[3] && z >= r[2] && z <= r[4]) return r;
    return null;
  }
  const floorAt = (x, z, r) => { r = r || walkAt(x, z); return !r ? 0 : typeof r[5] === "function" ? r[5](x, z) : r[5]; };

  const V3D = (() => {
    let threeP = null, S = null;
    const loadThree = () => window.THREE ? Promise.resolve(window.THREE) : (threeP || (threeP = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      s.onload = () => res(window.THREE);
      s.onerror = () => { threeP = null; rej(new Error("load")); };
      document.head.appendChild(s);
    })));
    const coarse = () => matchMedia("(pointer:coarse)").matches;

    function signTex(T, draw, w, h) {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      draw(c.getContext("2d"), w, h);
      const t = new T.CanvasTexture(c);
      t.encoding = T.sRGBEncoding;
      return t;
    }

    // ---- 質感:写真のない部分は、キャンバスで描いた繰り返し模様で「それらしい」塗装・床・木目にする ----
    // 模様は1メートルあたりの大きさで貼る(箱や床の大きさが違っても、模様の細かさがそろうように)
    function makeKit(T, aniso) {
      let seed = 20051123;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const lin = c => new T.Color(c).convertSRGBToLinear();
      const draw = (size, fn) => { const c = document.createElement("canvas"); c.width = c.height = size; fn(c.getContext("2d"), size); return c; };
      const tex = (c, meters, srgb) => {
        const t = new T.CanvasTexture(c);
        t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1 / meters, 1 / meters); t.anisotropy = aniso;
        if (srgb) t.encoding = T.sRGBEncoding;
        return t;
      };
      // 端でつながるように、はみ出した分は反対側にも描く
      const around = (s, x, y, r, fn) => { for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) if (x + dx > -r && x + dx < s + r && y + dy > -r && y + dy < s + r) fn(x + dx, y + dy); };
      const blotch = (g, s, n, r0, cols) => {
        for (let i = 0; i < n; i++) {
          const x = rnd() * s, y = rnd() * s, r = r0 * (0.35 + rnd()), col = cols[(rnd() * cols.length) | 0];
          around(s, x, y, r, (cx, cy) => { const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2); });
        }
      };
      const speck = (g, s, n, sz, cols) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[(rnd() * cols.length) | 0]; const z = sz * (0.4 + rnd()); g.fillRect(rnd() * s, rnd() * s, z, z); } };
      const scratch = (g, s, n, len, col) => {
        g.strokeStyle = col; g.lineWidth = 1;
        for (let i = 0; i < n; i++) {
          const x = rnd() * s, y = rnd() * s, a = rnd() * Math.PI, l = len * (0.3 + rnd());
          around(s, x, y, l, (cx, cy) => { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); g.stroke(); });
        }
      };
      const surf = (size, meters, paint, opt) => {
        const c = draw(size, paint), o = Object.assign({ roughness: 0.85, metalness: 0, envMapIntensity: 0.25 }, opt || {});
        o.map = tex(c, meters, true);
        if (o.bump) { o.bumpMap = tex(o.relief ? draw(size, o.relief) : c, meters, false); o.bumpScale = o.bump; }
        // wear: つやのむら（明るい所ほどざらつく、暗い所ほど光る）。three.js は緑の成分をざらつきとして読む
        if (o.wear) { o.roughnessMap = tex(draw(size, o.wear), meters, false); o.roughness = 1; }
        delete o.bump; delete o.wear; delete o.relief;
        return new T.MeshStandardMaterial(o);
      };
      // 模様のない素材（金属・扉・配管・服など）にも、手あか・ほこり・こすれのつやむらを共通で乗せる
      const grimeC = draw(256, (g, s) => {
        g.fillStyle = "#b4b4b4"; g.fillRect(0, 0, s, s);
        blotch(g, s, 70, 46, ["rgba(255,255,255,.3)", "rgba(0,0,0,.3)", "rgba(0,0,0,.18)"]);
        speck(g, s, 2600, 1.6, ["rgba(255,255,255,.22)", "rgba(0,0,0,.25)"]);
        scratch(g, s, 90, 40, "rgba(0,0,0,.22)"); scratch(g, s, 60, 18, "rgba(255,255,255,.2)");
      });
      const grimeR = tex(grimeC, 0.9, false), grimeB = tex(grimeC, 0.9, false);
      const plain = (c, o) => { const q = Object.assign({ color: lin(c), roughness: 0.75, metalness: 0, envMapIntensity: 0.3 }, o || {});
        if (q.metalness > 0 || q.roughness < 0.68) { q.roughness = Math.min(1, q.roughness * 1.4); q.roughnessMap = grimeR; q.bumpMap = grimeB; q.bumpScale = 0.0012; }
        return new T.MeshStandardMaterial(q); };
      const m = {
        // ホールの壁:黒い塗装。ローラーの跡、こすれ、ほこり
        wall: surf(256, 1.6, (g, s) => {
          g.fillStyle = "#1c1d1f"; g.fillRect(0, 0, s, s);
          blotch(g, s, 60, 22, ["rgba(255,255,255,.03)", "rgba(0,0,0,.18)"]);
          for (let x = 0; x < s; x += 3) { g.fillStyle = `rgba(255,255,255,${(rnd() * 0.03).toFixed(3)})`; g.fillRect(x, 0, 2, s); }
          speck(g, s, 220, 1.2, ["rgba(255,255,255,.035)", "rgba(0,0,0,.4)"]);
          scratch(g, s, 9, 12, "rgba(255,255,255,.035)");
        }, { bump: 0.003, envMapIntensity: 0.2, wear: (g, s) => {
          g.fillStyle = "#ececec"; g.fillRect(0, 0, s, s);
          blotch(g, s, 46, 52, ["rgba(0,0,0,.14)", "rgba(255,255,255,.2)"]);
          speck(g, s, 400, 1.3, ["rgba(0,0,0,.1)"]);
        } }),
        ceil: surf(512, 3.6, (g, s) => {
          g.fillStyle = "#0f0f10"; g.fillRect(0, 0, s, s);
          blotch(g, s, 90, 70, ["rgba(255,255,255,.035)", "rgba(0,0,0,.4)", "rgba(70,60,45,.05)"]);
          for (let y = 0; y < s; y += s / 4) { g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(0, y, s, 2); g.fillStyle = "rgba(255,255,255,.035)"; g.fillRect(0, y + 2, s, 1); }
          for (let x = 0; x < s; x += s / 2) { g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(x, 0, 2, s); }
          speck(g, s, 5200, 1.7, ["rgba(255,255,255,.06)", "rgba(0,0,0,.5)", "rgba(255,255,255,.03)"]);
          for (let i = 0; i < 14; i++) { const x = rnd() * s, y = rnd() * s; g.strokeStyle = "rgba(120,100,70,.07)"; g.lineWidth = 2 + rnd() * 5; g.beginPath(); g.arc(x, y, 8 + rnd() * 26, 0, 7); g.stroke(); }
        }, { roughness: 1, bump: 0.006, envMapIntensity: 0.1 }),
        // ホールの床:塗装したコンクリート。踏まれて色が抜けたところと、細かい傷
        // ホールの床:2008年の写真のとおり、グレーに白黒の細かい粒が入った床。踏まれて黒ずんだところ
        hall: surf(512, 2.5, (g, s) => {
          g.fillStyle = "#4b4b4d"; g.fillRect(0, 0, s, s);
          blotch(g, s, 70, 60, ["rgba(0,0,0,.28)", "rgba(255,255,255,.04)", "rgba(60,45,30,.1)"]);
          speck(g, s, 9000, 1.3, ["rgba(255,255,255,.18)", "rgba(0,0,0,.35)", "rgba(150,150,150,.25)"]);
          scratch(g, s, 120, 36, "rgba(255,255,255,.07)"); scratch(g, s, 80, 24, "rgba(0,0,0,.4)");
          for (let i = 0; i < 22; i++) { const x = rnd() * s, y = rnd() * s, r = 5 + rnd() * 16; around(s, x, y, r + 4, (cx, cy) => { g.strokeStyle = "rgba(20,14,8,.22)"; g.lineWidth = 1.5 + rnd() * 2; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); g.fillStyle = "rgba(20,14,8,.06)"; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); }); }
          for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(8,8,8,.5)"; g.beginPath(); g.ellipse(rnd() * s, rnd() * s, 1.5 + rnd() * 2.5, 1.5 + rnd() * 2, rnd() * 3, 0, 7); g.fill(); }
          for (let i = 0; i < 8; i++) { g.save(); g.translate(rnd() * s, rnd() * s); g.rotate(rnd() * 3); g.fillStyle = "rgba(210,205,190,.1)"; g.fillRect(0, 0, 26 + rnd() * 30, 6); g.restore(); }
        }, { bump: 0.004, envMapIntensity: 0.7, wear: (g, s) => {
          g.fillStyle = "#8a8a8a"; g.fillRect(0, 0, s, s);
          blotch(g, s, 90, 90, ["rgba(0,0,0,.5)", "rgba(0,0,0,.35)", "rgba(255,255,255,.4)"]);   // 暗い所 = すり減って光る所
          speck(g, s, 6000, 1.6, ["rgba(255,255,255,.3)", "rgba(0,0,0,.2)"]);
          scratch(g, s, 260, 44, "rgba(255,255,255,.4)");                                          // 傷はざらつく
          for (let i = 0; i < 22; i++) { g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.arc(rnd() * s, rnd() * s, 5 + rnd() * 16, 0, 7); g.fill(); }
        } }),
        // ステージの床:黒く塗った合板(継ぎ目つき)
        stage: surf(512, 1.8, (g, s) => {
          g.fillStyle = "#1d1d1f"; g.fillRect(0, 0, s, s);
          blotch(g, s, 60, 50, ["rgba(255,255,255,.05)", "rgba(0,0,0,.3)"]);
          scratch(g, s, 260, 34, "rgba(255,255,255,.08)");
          speck(g, s, 900, 1.4, ["rgba(255,255,255,.05)", "rgba(0,0,0,.4)"]);
          g.fillStyle = "rgba(0,0,0,.75)"; g.fillRect(0, 0, s, 2); g.fillRect(0, s / 2, s, 2); g.fillRect(0, 0, 2, s);
          for (let i = 0; i < 36; i++) { g.fillStyle = "rgba(150,120,85," + (0.1 + rnd() * 0.2).toFixed(2) + ")"; g.beginPath(); g.ellipse(rnd() * s, rnd() * s, 2 + rnd() * 9, 1 + rnd() * 3, rnd() * 3, 0, 7); g.fill(); }
          for (let i = 0; i < 12; i++) { g.strokeStyle = "rgba(170,165,150,.12)"; g.lineWidth = 2 + rnd() * 3; const x = rnd() * s, y = rnd() * s, a = rnd() * 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 90, y + Math.sin(a) * 90); g.stroke(); }
        }, { bump: 0.004, envMapIntensity: 0.6, wear: (g, s) => {
          g.fillStyle = "#909090"; g.fillRect(0, 0, s, s);
          blotch(g, s, 70, 70, ["rgba(0,0,0,.45)", "rgba(255,255,255,.35)"]);
          scratch(g, s, 420, 40, "rgba(255,255,255,.45)"); speck(g, s, 3000, 1.5, ["rgba(255,255,255,.3)"]);
        } }),
        // ロビーの床:30cm角のタイル
        tile: surf(256, 0.6, (g, s) => {
          g.fillStyle = "#1f2022"; g.fillRect(0, 0, s, s);
          const n = 2, t = s / n;
          for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 52 + ((rnd() * 10) | 0); g.fillStyle = `rgb(${v},${v + 2},${v + 5})`; g.fillRect(i * t + 2, j * t + 2, t - 4, t - 4); }
          blotch(g, s, 20, 40, ["rgba(0,0,0,.25)", "rgba(255,255,255,.04)"]);
          speck(g, s, 600, 1.4, ["rgba(255,255,255,.08)", "rgba(0,0,0,.35)"]);
        }, { bump: 0.003, envMapIntensity: 0.8, wear: (g, s) => {
          g.fillStyle = "#f0f0f0"; g.fillRect(0, 0, s, s); const n = 2, t = s / n;
          for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 70 + ((rnd() * 60) | 0); g.fillStyle = "rgb(" + v + "," + v + "," + v + ")"; g.fillRect(i * t + 3, j * t + 3, t - 6, t - 6); }
          blotch(g, s, 26, 40, ["rgba(255,255,255,.3)", "rgba(0,0,0,.25)"]); scratch(g, s, 50, 22, "rgba(255,255,255,.35)");
        } }),
        // 楽屋の白い壁:手あかと、こすれた跡
        white: surf(256, 2, (g, s) => {
          g.fillStyle = "#aaa79e"; g.fillRect(0, 0, s, s);
          blotch(g, s, 40, 46, ["rgba(90,80,60,.08)", "rgba(0,0,0,.05)", "rgba(255,255,255,.2)"]);
          scratch(g, s, 30, 16, "rgba(40,40,40,.07)"); speck(g, s, 300, 1.4, ["rgba(0,0,0,.08)"]);
        }, { roughness: 0.85, bump: 0.002 }),
        // 階段の赤:塗装の色むらと、すり減り
        red: surf(256, 1, (g, s) => {
          g.fillStyle = "#8b1c21"; g.fillRect(0, 0, s, s);
          blotch(g, s, 40, 40, ["rgba(0,0,0,.25)", "rgba(255,200,200,.06)"]);
          speck(g, s, 700, 1.5, ["rgba(0,0,0,.3)", "rgba(255,255,255,.06)"]); scratch(g, s, 60, 20, "rgba(0,0,0,.3)");
        }, { roughness: 0.7, bump: 0.002 }),
        // カウンターの木目
        wood: surf(256, 1.2, (g, s) => {
          g.fillStyle = "#6a4e36"; g.fillRect(0, 0, s, s);
          for (let i = 0; i < 90; i++) {
            const y = rnd() * s, a = 1.5 + rnd() * 4, f = (1 + ((rnd() * 3) | 0)) * Math.PI * 2 / s, ph = rnd() * 6;
            g.strokeStyle = rnd() < 0.6 ? `rgba(40,25,12,${(0.1 + rnd() * 0.25).toFixed(2)})` : "rgba(255,230,190,.06)"; g.lineWidth = 0.6 + rnd() * 1.6;
            g.beginPath(); for (let x = 0; x <= s; x += 4) { const yy = y + Math.sin(x * f + ph) * a; x ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke();
          }
        }, { roughness: 0.5, bump: 0.002 }),
        // スピーカーやアンプの外装(トーレックス)
        black: surf(128, 0.25, (g, s) => { g.fillStyle = "#141415"; g.fillRect(0, 0, s, s); speck(g, s, 1800, 1.3, ["rgba(255,255,255,.06)", "rgba(0,0,0,.5)"]); }, { roughness: 0.72, bump: 0.003 }),
        // スピーカーの網
        grille: surf(64, 0.04, (g, s) => { g.fillStyle = "#151617"; g.fillRect(0, 0, s, s); g.fillStyle = "#3a3c40"; for (let x = 0; x < s; x += 8) for (let y = 0; y < s; y += 8) g.fillRect(x + 2, y + 2, 3, 3); }, { roughness: 0.8 }),
        green: surf(128, 0.6, (g, s) => { g.fillStyle = "#1f4f30"; g.fillRect(0, 0, s, s); speck(g, s, 900, 1.4, ["rgba(0,0,0,.35)", "rgba(255,255,255,.06)"]); }, { roughness: 0.95 }),
        metal: plain(0x8a8f95, { metalness: 0.85, roughness: 0.38, envMapIntensity: 0.55 }),
        door: plain(0x3b424a, { metalness: 0.45, roughness: 0.45 }),
        shell: plain(0x7a1717, { metalness: 0.25, roughness: 0.22, envMapIntensity: 0.8 }),
        ceilPipe: plain(0x1a1b1d, { metalness: 0.4, roughness: 0.6, envMapIntensity: 0.2 }),
        acWhite: plain(0xd8d8d2, { roughness: 0.7 }),
        duct: surf(256, 0.8, (g, s) => {
          g.fillStyle = "#8b9095"; g.fillRect(0, 0, s, s);
          for (let i = 0; i < 520; i++) { const x = rnd() * s, y = rnd() * s, r = 5 + rnd() * 11, a = rnd() * 6; g.fillStyle = rnd() < 0.5 ? "rgba(255,255,255," + (0.03 + rnd() * 0.07).toFixed(2) + ")" : "rgba(0,0,0," + (0.03 + rnd() * 0.08).toFixed(2) + ")";
            g.beginPath(); for (let k = 0; k < 5; k++) { const b = a + k * 1.26, rr = r * (0.6 + rnd() * 0.6); k ? g.lineTo(x + Math.cos(b) * rr, y + Math.sin(b) * rr) : g.moveTo(x + Math.cos(b) * rr, y + Math.sin(b) * rr); } g.fill(); }
          blotch(g, s, 30, 50, ["rgba(60,50,35,.1)", "rgba(0,0,0,.12)"]);
          g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, 0, s, 2); g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(0, 3, s, 1);
        }, { metalness: 0.75, bump: 0.002, envMapIntensity: 0.6, wear: (g, s) => { g.fillStyle = "#7c7c7c"; g.fillRect(0, 0, s, s); blotch(g, s, 60, 30, ["rgba(255,255,255,.35)", "rgba(0,0,0,.3)"]); speck(g, s, 1500, 1.5, ["rgba(255,255,255,.3)"]); } }),
        gold: plain(0xc9a34a, { metalness: 1, roughness: 0.28, envMapIntensity: 1 }),
      };
      return { m, plain, rnd, lin };
    }
    // 箱・板の模様を1メートル単位で貼るため、面ごとにUVを実寸に引き伸ばす
    function scaleUV(geo, sizes) {
      const uv = geo.attributes.uv;
      sizes.forEach(([a, b], f) => { for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * a, uv.getY(i) * b); } });
      uv.needsUpdate = true;
      return geo;
    }
    // ステージの照明が映り込む先(金属やドラムの塗装に色が乗るように)
    function makeEnv(T, renderer) {
      const env = new T.Scene();
      env.background = new T.Color(0x020203);
      const panel = (col, k, x, y, z, w, h) => { const o = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(k), side: T.DoubleSide })); o.position.set(x, y, z); o.lookAt(0, 0, 0); env.add(o); };
      panel(0xff3344, 2.2, -3, 2.2, -2, 2.2, 1); panel(0x3355ff, 2.2, 3, 2.2, -2, 2.2, 1); panel(0xffe6c4, 1.8, 0, 3, 0.5, 3.5, 1.2);
      panel(0xffa23a, 1.2, 0, 1.4, -4, 2, 0.8); panel(0xffd9a8, 0.5, 0, 1.4, 4, 3, 1);
      const pm = new T.PMREMGenerator(renderer);
      const rt = pm.fromScene(env, 0.03);
      pm.dispose();
      return rt.texture;
    }


    function build(T, renderer, hi) {
      const scene = new T.Scene();
      const kit = makeKit(T, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
      const { m, plain, rnd, lin } = kit;
      scene.background = lin(0x030405);
      scene.fog = new T.Fog(lin(0x030405), 7, 26);
      scene.environment = makeEnv(T, renderer);
      const P = (c, o) => plain(c, o);
      const glow = (c, k) => new T.MeshBasicMaterial({ color: lin(c).multiplyScalar(k), toneMapped: false });
      const add = o => { scene.add(o); return o; };
      const box = (w, h, d, mat, x, y, z) => { const o = new T.Mesh(scaleUV(new T.BoxGeometry(w, h, d), [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]), mat); o.position.set(x, y, z); return add(o); };
      const cyl = (rt, rb, h, mat, x, y, z, seg) => { const o = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 20), mat); o.position.set(x, y, z); return add(o); };
      const fadeTex = signTex(T, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.55, "rgba(0,0,0,.35)"); gr.addColorStop(1, "rgba(0,0,0,.92)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, 4, 64);
      const shadeMat = k => new T.MeshBasicMaterial({ map: fadeTex, transparent: true, opacity: k, depthWrite: false, toneMapped: false });
      const shadeLow = shadeMat(0.75), shadeTop = shadeMat(0.6);
      const blobTex = signTex(T, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.22, "rgba(255,255,255,.5)"); gr.addColorStop(0.55, "rgba(255,255,255,.12)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, 64, 64);
      // 床に落ちる丸い影（人や機材の足元）と、床に映る光
      const onFloor = (x, z, w, d, mat, y) => { const o = new T.Mesh(new T.PlaneGeometry(w, d), mat); o.rotation.x = -Math.PI / 2; o.position.set(x, y || 0.012, z); o.renderOrder = 2; return add(o); };
      const blobMat = new T.MeshBasicMaterial({ map: blobTex, color: 0x000000, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false });
      const sheen = (x, z, w, d, col, k, y) => onFloor(x, z, w, d, new T.MeshBasicMaterial({ map: blobTex, color: lin(col).multiplyScalar(k), transparent: true, blending: T.AdditiveBlending, depthWrite: false }), y);
      const wall = (x1, z1, x2, z2, y0, y1, mat) => {
        y0 = y0 || 0; y1 = y1 || 2.4;
        const len = Math.hypot(x2 - x1, z2 - z1) + 0.12, ry = -Math.atan2(z2 - z1, x2 - x1);
        const o = box(len, y1 - y0, 0.12, mat || m.wall, (x1 + x2) / 2, (y0 + y1) / 2, (z1 + z2) / 2);
        o.rotation.y = ry;
        const nx = Math.sin(ry) * 0.064, nz = Math.cos(ry) * 0.064;
        for (const sd of [1, -1]) {
          if (y0 === 0) { const a = new T.Mesh(new T.PlaneGeometry(len, 0.55), shadeLow); a.position.set((x1 + x2) / 2 + nx * sd, 0.275, (z1 + z2) / 2 + nz * sd); a.rotation.y = ry + (sd < 0 ? Math.PI : 0); add(a); }
          if (y1 >= 2.4) { const a = new T.Mesh(new T.PlaneGeometry(len, 0.4), shadeTop); a.position.set((x1 + x2) / 2 + nx * sd, y1 - 0.2, (z1 + z2) / 2 + nz * sd); a.rotation.y = ry + (sd < 0 ? Math.PI : 0); a.rotation.z = Math.PI; add(a); }
        }
        return o;
      };
      const plane = (x1, z1, x2, z2, y, mat, up) => {
        const o = new T.Mesh(scaleUV(new T.PlaneGeometry(x2 - x1, z2 - z1), [[x2 - x1, z2 - z1]]), mat);
        o.rotation.x = up ? Math.PI / 2 : -Math.PI / 2; o.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); return add(o);
      };
      const facePlane = (w, h, mat, x, y, z, ry) => { const o = new T.Mesh(new T.PlaneGeometry(w, h), mat); o.position.set(x, y, z); o.rotation.y = ry || 0; return add(o); };

      // 床と天井
      plane(0, 3.7, 6.8, 9.1, 0, m.hall);
      plane(6.8, 0, 14.78, 9.15, 0, m.tile);
      // 階段下の床は赤い鱗(うろこ)柄タイル(LiveWalkerの入口写真)
      const scale = signTex(T, (g, w, h) => {
        g.fillStyle = "#7d1418"; g.fillRect(0, 0, w, h); g.strokeStyle = "#b8343a"; g.lineWidth = 3;
        for (let y = -16; y < h + 32; y += 16) for (let x = (y / 16) % 2 ? 16 : 0; x < w + 32; x += 32) { g.beginPath(); g.arc(x, y, 16, 0, Math.PI); g.stroke(); }
      }, 128, 128);
      scale.wrapS = scale.wrapT = T.RepeatWrapping; scale.repeat.set(8, 4);
      const scaleMat = new T.MeshStandardMaterial({ map: scale, roughness: 0.4 });
      plane(10.14, 0.81, 14.28, 2.94, 0.005, scaleMat);
      plane(8.6, 2.94, 11.35, 4.32, 0.006, scaleMat);
      [[0, 0, 6.8, 9.1], [6.8, 0, 11.35, 9.15], [11.35, 4.32, 14.78, 9.15], [11.35, 0, 14.28, 2.94]].forEach(r => plane(r[0], r[1], r[2], r[3], 2.4, m.ceil, true));
      plane(11.35, 2.94, 16.3, 9.15, 4.8, m.ceil, true);

      // 壁(高さ2.4m。階段まわりは吹き抜けなので4.8m)
      [[0, 0, 6.8, 0], [0, 0, 0, 9.1], [0, 9.1, 6.8, 9.1], [6.8, 0, 6.8, 0.5], [6.8, 1.3, 6.8, 6.55], [6.8, 7.65, 6.8, 9.1],
       [8.46, 0, 10.14, 0], [10.14, 0, 10.14, 0.81], [10.14, 0.81, 14.28, 0.81], [14.28, 0.81, 14.28, 2.94],
       [6.8, 7.85, 8.46, 7.85], [8.46, 7.85, 8.46, 9.15], [8.46, 9.15, 12.27, 9.15], [12.27, 7.85, 12.27, 9.15], [12.27, 7.85, 14.78, 7.85],
       [11.0, 4.32, 11.0, 4.6], [11.0, 5.9, 11.0, 7.29], [11.0, 7.29, 14.78, 7.29]].forEach(w => wall(w[0], w[1], w[2], w[3]));
      [[6.8, 0, 8.46, 0], [8.46, 0, 8.46, 0.35], [8.46, 1.15, 8.46, 5.12], [6.8, 5.12, 8.46, 5.12]].forEach(w => wall(w[0], w[1], w[2], w[3], 0, 2.4, m.white));
      wall(11.0, 4.6, 11.0, 5.9, 0, 1.0); wall(11.0, 4.6, 11.0, 5.9, 1.75, 2.4);
      [[11.35, 2.94, 16.3, 2.94], [11.35, 4.32, 14.78, 4.32], [14.78, 4.32, 14.78, 9.15], [16.3, 2.94, 16.3, 9.15]].forEach(w => wall(w[0], w[1], w[2], w[3], 0, 4.8));

      // 階段(赤い床)。地上(3.0m)から踊り場(1.5m)、さらに地下(0m)へ
      for (let i = 0; i < 10; i++) { const x0 = 11.35 + i * 0.35, h = (i + 1) * 0.15; box(0.35, h, 1.38, m.red, x0 + 0.175, h / 2, 3.63); }
      box(1.52, 1.5, 1.38, m.red, 15.54, 0.75, 3.63);
      plane(15.0, 3.2, 16.1, 4.1, 1.505, m.green);
      for (let i = 0; i < 14; i++) { const z0 = 4.32 + i * 0.346, h = 1.5 + (i + 1) * 0.107; box(1.52, h, 0.346, m.red, 15.54, h / 2, z0 + 0.173); }
      facePlane(1.5, 3.2, new T.MeshBasicMaterial({ color: 0xe8eef0 }), 15.54, 4.6, 9.14, Math.PI);

      // ポスター(当時の公式サイトに載っていた写真を、階段とロビーの壁に貼る)
      const loader = new T.TextureLoader();
      const poster = (i, x, y, z, ry) => {
        const tex = loader.load(`img/venue/posters/p${String(i).padStart(2, "0")}.jpg`);
        tex.encoding = T.sRGBEncoding; tex.anisotropy = 4;
        const o = facePlane(0.82, 0.48, new T.MeshStandardMaterial({ map: tex, roughness: 0.55, envMapIntensity: 0.4 }), x, y, z, ry);
        o.rotation.z = (rnd() - 0.5) * 0.05; o.position.addScaledVector(new T.Vector3(Math.sin(ry), 0, Math.cos(ry)), 0.004);
      };
      let pi = 1;
      for (let k = 0; k < 4; k++) for (let row = 0; row < 2; row++) { const z = 4.75 + k * 1.15; poster(pi++ % 18 + 1, 14.85, floorAt(15, z) + 1.25 + row * 0.62, z, Math.PI / 2); }
      for (let k = 0; k < 3; k++) for (let row = 0; row < 2; row++) { const x = 11.9 + k * 1.0; poster(pi++ % 18 + 1, x, floorAt(x, 3.6) + 1.25 + row * 0.62, 3.01, 0); }
      box(0.04, 2.2, 2.6, m.black, 8.53, 1.1, 3.55);
      for (let k = 0; k < 2; k++) poster(pi++ % 18 + 1, 8.56, 1.15, 2.85 + k * 1.3, Math.PI / 2);
      // 階段の掲示面を区切る赤い柱
      for (let k = 0; k <= 4; k++) { const z = 4.18 + k * 1.15; box(0.08, 4.0, 0.08, m.red, 14.86, 2.2, z); }

      // 看板
      const logo = signTex(T, (g, w, h) => {
        g.fillStyle = "#0d0f10"; g.fillRect(0, 0, w, h);
        g.fillStyle = "#f3f7f7"; g.textAlign = "center"; g.font = '170px "Squada One", Impact, sans-serif'; g.fillText("SiX-DOG", w / 2, 190);
        g.fillStyle = "#38c8c8"; g.font = '40px "Squada One", Impact, sans-serif'; g.fillText("GOOD MUSIC & NEW CULTURE LIVE HOUSE", w / 2, 252);
      }, 1024, 300);
      facePlane(1.7, 0.5, new T.MeshBasicMaterial({ map: logo }), 14.21, 1.65, 1.88, -Math.PI / 2);
      facePlane(1.5, 0.44, new T.MeshBasicMaterial({ map: logo }), 8.57, 1.95, 3.55, Math.PI / 2);
      // 地上:白い電飾スタンド看板
      const stand = signTex(T, (g, w, h) => {
        g.fillStyle = "#f4f6f6"; g.fillRect(0, 0, w, h);
        g.strokeStyle = "#111414"; g.lineWidth = 10; g.beginPath(); g.arc(w / 2, 150, 95, 0, Math.PI * 2); g.stroke();
        g.fillStyle = "#111414"; g.textAlign = "center"; g.font = '96px "Squada One", Impact, sans-serif'; g.fillText("SiX-DOG", w / 2, 340);
        g.font = '60px "Zen Kaku Gothic New", sans-serif'; g.fillText("B1F", w / 2, 160);
      }, 360, 400);
      const sb = box(0.6, 0.66, 0.12, new T.MeshBasicMaterial({ map: stand }), 15.9, 3.0 + 0.55, 8.95); sb.rotation.y = 0.3;
      const label = (txt, sub) => signTex(T, (g, w, h) => {
        g.fillStyle = "#0d0f10"; g.fillRect(0, 0, w, h); g.textAlign = "center"; g.fillStyle = "#f3f7f7";
        g.font = '64px "Zen Kaku Gothic New", sans-serif'; g.fillText(txt, w / 2, sub ? 78 : 92);
        if (sub) { g.fillStyle = "#38c8c8"; g.font = '36px "Squada One", sans-serif'; g.fillText(sub, w / 2, 130); }
      }, 512, 150);
      facePlane(0.9, 0.26, new T.MeshBasicMaterial({ map: label("受付", "RECEPTION") }), 10.93, 2.05, 5.25, -Math.PI / 2);
      facePlane(1.0, 0.29, new T.MeshBasicMaterial({ map: label("ドリンク", "DRINK") }), 10.35, 2.12, 9.08, Math.PI);
      facePlane(0.9, 0.26, new T.MeshBasicMaterial({ map: label("ホール", "HALL") }), 6.9, 2.2, 7.1, Math.PI / 2);
      facePlane(0.7, 0.2, new T.MeshBasicMaterial({ map: label("楽屋") }), 8.53, 2.1, 0.75, Math.PI / 2);

      // 受付とドリンクカウンター
      box(0.34, 0.05, 1.3, m.wood, 10.88, 1.0, 5.25);
      box(3.6, 1.05, 0.45, m.wood, 10.35, 0.525, 8.08); box(3.7, 0.05, 0.56, m.black, 10.35, 1.07, 8.08);
      box(3.6, 0.04, 0.28, m.wood, 10.35, 1.45, 9.0); box(3.6, 0.04, 0.28, m.wood, 10.35, 1.8, 9.0);
      const bottleCols = [0x2f7d4a, 0x7a3d1d, 0xd8c690, 0x3b5e8c, 0x8c2d2d, 0xc9b36a];
      for (let i = 0; i < 16; i++) cyl(0.04, 0.045, 0.26, P(bottleCols[i % 6], { roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85, emissive: lin(bottleCols[i % 6]), emissiveIntensity: 0.12 }), 8.75 + i * 0.21, i < 8 ? 1.6 : 1.95, 9.0);

      // ---- ロビーの細かい物(フライヤーの壁、置きチラシ、受付の小物、ドリンクの道具、冷蔵庫、非常口の灯り、消火器、傘立て) ----
      {
        const FL_BG = ["#e8e2d0", "#d8c23a", "#c9433f", "#2f5fb8", "#1c1c1e", "#e08a2a", "#3f9a58", "#d8d8d8", "#7a3fa0", "#f0a0b8"];
        const flyerTex = [];
        for (let v = 0; v < 12; v++) flyerTex.push(signTex(T, (g, w, h) => {
          const bg = FL_BG[(rnd() * FL_BG.length) | 0], dark = bg === "#1c1c1e" || bg === "#2f5fb8" || bg === "#7a3fa0" || bg === "#c9433f", ink = dark ? "#f0ece0" : "#161616";
          g.fillStyle = bg; g.fillRect(0, 0, w, h);
          if (rnd() < 0.5) { g.fillStyle = dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.14)"; g.beginPath(); g.arc(w * (0.3 + rnd() * 0.4), h * (0.3 + rnd() * 0.2), w * (0.2 + rnd() * 0.2), 0, 7); g.fill(); }
          else { g.fillStyle = dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.12)"; g.fillRect(w * 0.1, h * 0.2, w * 0.8, h * 0.35); }
          g.fillStyle = ink; g.fillRect(w * 0.1, h * 0.07, w * (0.4 + rnd() * 0.4), h * 0.07);                       // 公演名のかたまり
          for (let i = 0; i < 6; i++) g.fillRect(w * 0.1, h * (0.62 + i * 0.045), w * (0.25 + rnd() * 0.5), h * 0.018);   // 出演者の行
          g.fillRect(w * 0.1, h * 0.92, w * 0.35, h * 0.025);
        }, 64, 90));
        const flyerMat = flyerTex.map(t => new T.MeshStandardMaterial({ map: t, color: lin(0xcfcbc0), roughness: 0.85, envMapIntensity: 0.1 }));
        // 壁一面のフライヤー(少しずつ傾いて、重なって貼ってある)
        const flyerWall = (fixed, ax, a0, a1, y0, y1, ry, n) => { for (let i = 0; i < n; i++) {
          const b5 = rnd() < 0.5, w = b5 ? 0.182 : 0.21, h = b5 ? 0.257 : 0.297, t = a0 + rnd() * (a1 - a0), y = y0 + rnd() * (y1 - y0), d = 0.002 + i * 0.0004;
          const o = ax === "x" ? facePlane(w, h, flyerMat[i % 12], fixed + (ry > 0 ? d : -d), y, t, ry) : facePlane(w, h, flyerMat[i % 12], t, y, fixed + (ry === 0 ? d : -d), ry);
          o.rotation.z = (rnd() - 0.5) * 0.14; } };
        flyerWall(6.865, "x", 1.5, 6.4, 0.75, 2.05, Math.PI / 2, 70);      // ホールとロビーを分ける長い壁
        flyerWall(10.935, "x", 6.0, 7.2, 0.8, 2.0, -Math.PI / 2, 22);      // 受付の横
        flyerWall(7.785, "z", 6.95, 8.35, 0.8, 2.0, Math.PI, 18);          // ホールの扉の脇
        // 置きチラシの台(束になったフライヤー)
        box(0.9, 0.04, 0.4, m.wood, 7.25, 0.74, 4.2); [[6.9, 4.05], [7.6, 4.05], [6.9, 4.35], [7.6, 4.35]].forEach(([x, z]) => cyl(0.015, 0.015, 0.72, m.metal, x, 0.36, z, 6));
        for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) { const st = box(0.182, 0.012 + rnd() * 0.03, 0.257, P(0xe4e0d4, { roughness: 0.9 }), 6.93 + i * 0.215, 0.775, 4.08 + k * 0.26); const top = new T.Mesh(new T.PlaneGeometry(0.182, 0.257), flyerMat[(i * 2 + k) % 12]); top.rotation.x = -Math.PI / 2; top.position.set(st.position.x, 0.762 + st.geometry.parameters.height / 2 + 0.008, st.position.z); top.rotation.z = (rnd() - 0.5) * 0.1; add(top); }
        // 受付の台の上: つり銭のトレー、チケットの束、スタンプ、ペン、今日のタイムテーブル
        box(0.16, 0.012, 0.12, P(0x2f5fb8, { roughness: 0.5 }), 10.88, 1.032, 5.05);
        box(0.07, 0.03, 0.15, P(0xe8e2d0, { roughness: 0.9 }), 10.86, 1.04, 5.42); box(0.07, 0.02, 0.15, P(0xd8c23a, { roughness: 0.9 }), 10.9, 1.035, 5.62);
        cyl(0.02, 0.02, 0.05, P(0x7a3d1d, { roughness: 0.6 }), 10.83, 1.05, 4.82, 10); { const pen = cyl(0.005, 0.005, 0.14, m.black, 10.9, 1.03, 5.22, 6); pen.rotation.x = Math.PI / 2; pen.rotation.z = 0.4; }
        const sheet = (lines, title) => new T.MeshStandardMaterial({ roughness: 0.9, map: signTex(T, (g, w, h) => { g.fillStyle = "#ebe7da"; g.fillRect(0, 0, w, h); g.fillStyle = "#1a1a1a"; g.font = "700 " + (h * 0.07) + "px sans-serif"; g.fillText(title, w * 0.08, h * 0.11);
          for (let i = 0; i < lines; i++) { g.fillRect(w * 0.08, h * (0.2 + i * 0.085), w * 0.16, h * 0.03); g.fillRect(w * 0.3, h * (0.2 + i * 0.085), w * (0.25 + ((i * 41) % 35) / 100), h * 0.03); } }, 128, 180) });
        facePlane(0.21, 0.297, sheet(8, "TIME TABLE"), 10.933, 1.5, 4.4, -Math.PI / 2).rotation.z = 0.03;
        facePlane(0.21, 0.297, sheet(4, "1 DRINK ¥500"), 10.933, 1.45, 6.05, -Math.PI / 2).rotation.z = -0.04;
        // ドリンクカウンターの上: ビールサーバー、重ねたカップ、メニュー、氷の入れ物、ドリンクチケットの箱
        box(0.26, 0.4, 0.22, P(0xb9bcc0, { metalness: 0.9, roughness: 0.3, envMapIntensity: 0.9 }), 9.2, 1.295, 8.1);
        [-0.06, 0.06].forEach(dx => { cyl(0.012, 0.012, 0.09, m.metal, 9.2 + dx, 1.36, 7.97, 8).rotation.x = Math.PI / 2; cyl(0.014, 0.01, 0.1, m.black, 9.2 + dx, 1.44, 7.93, 8); });
        box(0.2, 0.012, 0.1, m.grille, 9.2, 1.101, 7.93);
        const cupMat = new T.MeshStandardMaterial({ color: lin(0xe9eef2), transparent: true, opacity: 0.32, roughness: 0.1, envMapIntensity: 1 });
        [[9.7, 8.12, 11], [9.82, 8.15, 8], [9.94, 8.1, 13]].forEach(([x, z, n]) => { for (let i = 0; i < n; i++) cyl(0.04, 0.03, 0.1, cupMat, x, 1.145 + i * 0.012, z, 12); });
        facePlane(0.2, 0.28, sheet(9, "MENU"), 10.5, 1.24, 7.9, Math.PI).rotation.x = 0.2;
        box(0.24, 0.16, 0.2, P(0x2a4f7a, { roughness: 0.6 }), 11.2, 1.175, 8.15); cyl(0.07, 0.06, 0.06, P(0xd8d4c4, { roughness: 0.7 }), 10.9, 1.125, 7.95, 14);
        // カウンターの奥の冷蔵庫(ガラスの扉から白い光がもれる)
        box(0.62, 0.86, 0.5, P(0x18191b, { roughness: 0.5, metalness: 0.4 }), 12.0, 0.43, 8.86);
        { const fr = signTex(T, (g, w, h) => { g.fillStyle = "#dfeaf0"; g.fillRect(0, 0, w, h); const cs = ["#2f7d4a", "#7a3d1d", "#c9b36a", "#3b5e8c", "#8c2d2d", "#d8d8d8"];
            for (let r = 0; r < 3; r++) { g.fillStyle = "#8f9aa2"; g.fillRect(0, h * (0.33 * r + 0.31), w, 3); for (let i = 0; i < 9; i++) { g.fillStyle = cs[(i + r * 2) % 6]; g.fillRect(w * (0.06 + i * 0.1), h * (0.33 * r + 0.08), w * 0.07, h * 0.23); g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(w * (0.06 + i * 0.1), h * (0.33 * r + 0.16), w * 0.07, h * 0.06); } }
            g.strokeStyle = "#15161a"; g.lineWidth = 10; g.strokeRect(0, 0, w, h); }, 256, 320);
          facePlane(0.56, 0.78, new T.MeshBasicMaterial({ map: fr, color: new T.Color(1.25, 1.25, 1.3) }), 12.0, 0.45, 8.605, Math.PI);
          const l = new T.PointLight(0xdfeeff, 0.5, 3.2); l.position.set(12.0, 0.6, 8.4); add(l); }
        // 非常口の灯り(暗いホールでいちばん覚えている緑)
        const exitTex = signTex(T, (g, w, h) => { g.fillStyle = "#12a05a"; g.fillRect(0, 0, w, h); g.fillStyle = "#f4fff8"; g.fillRect(w * 0.08, h * 0.16, w * 0.3, h * 0.68);
          g.fillStyle = "#12a05a"; g.beginPath(); g.arc(w * 0.25, h * 0.33, h * 0.08, 0, 7); g.fill(); g.fillRect(w * 0.2, h * 0.43, w * 0.1, h * 0.26);
          g.fillStyle = "#f4fff8"; g.font = "900 " + (h * 0.46) + "px sans-serif"; g.textBaseline = "middle"; g.fillText("非常口", w * 0.42, h * 0.52); }, 256, 96);
        const exitSign = (x, y, z, ry) => { const nx = Math.sin(ry), nz = Math.cos(ry); box(0.38, 0.15, 0.05, m.acWhite, x - nx * 0.03, y, z - nz * 0.03).rotation.y = ry;
          facePlane(0.36, 0.13, new T.MeshBasicMaterial({ map: exitTex, color: new T.Color(1.5, 1.6, 1.5) }), x, y, z, ry); const l = new T.PointLight(0x30e080, 0.22, 3); l.position.set(x + nx * 0.3, y - 0.1, z + nz * 0.3); add(l); };
        exitSign(6.72, 2.18, 7.1, -Math.PI / 2); exitSign(11.2, 2.2, 4.25, Math.PI);
        // 消火器、傘立て、ごみ箱
        const ext = (x, z) => { cyl(0.065, 0.065, 0.42, P(0xb8201c, { roughness: 0.35, metalness: 0.2, envMapIntensity: 0.7 }), x, 0.23, z, 14); cyl(0.025, 0.04, 0.08, m.black, x, 0.48, z, 10); cyl(0.008, 0.008, 0.3, m.black, x + 0.07, 0.36, z, 6); };
        ext(7.0, 6.45); ext(11.15, 7.1);
        box(0.36, 0.5, 0.26, m.metal, 11.7, 0.25, 4.1); [[-0.1, 0x1c1c1e], [0.02, 0x2f5fb8], [0.1, 0xe8e8e8], [-0.03, 0x1c1c1e]].forEach(([dx, c], i) => { const u = cyl(0.012, 0.016, 0.82, P(c, { roughness: 0.6 }), 11.7 + dx, 0.52, 4.06 + (i % 2) * 0.08, 8); u.rotation.z = dx * 0.6; });
        [[12.45, 7.6], [8.7, 7.6]].forEach(([x, z]) => { cyl(0.16, 0.14, 0.5, P(0x2a2b2e, { roughness: 0.6 }), x, 0.25, z, 14); cyl(0.165, 0.165, 0.02, m.black, x, 0.51, z, 14); });
      }

      // 楽屋(白い壁、鏡、カウンター、丸椅子)
      plane(6.8, 0, 8.46, 5.12, 0.004, m.tile);
      facePlane(1.6, 0.7, P(0x6c7478, { metalness: 0.6, roughness: 0.45, envMapIntensity: 0.2 }), 8.39, 1.45, 2.6, -Math.PI / 2);
      box(0.45, 0.05, 2.4, m.white, 8.2, 0.8, 2.6);
      [1.9, 2.6, 3.3].forEach(z => { cyl(0.17, 0.17, 0.06, m.black, 7.7, 0.48, z); cyl(0.02, 0.02, 0.45, m.metal, 7.7, 0.23, z, 8); });

      // ステージ
      box(6.8, 0.35, 3.7, m.stage, 3.4, 0.175, 1.85);
      box(6.8, 0.04, 0.04, m.metal, 3.4, 0.33, 3.7);
      // ステージ奥:ひだのある黒い幕(2008・2016・2018年の写真と動画)
      {
        const W = 6.7, H = 2.03, g = new T.PlaneGeometry(W, H, 220, 1), pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, 0.035 * Math.sin(x * Math.PI * 2 / 0.16) + 0.01 * Math.sin(x * 7.3)); }
        g.computeVertexNormals();
        const c = new T.Mesh(g, P(0x111113, { roughness: 1, envMapIntensity: 0.1 })); c.position.set(3.4, 0.35 + H / 2, 0.1); add(c);
      }
      // 柵:銀色の細いパイプ。ステージの縁のすぐ前に、4つに分かれて横幅いっぱい(2008・2016年の写真)
      [[0.25, 1.75], [1.85, 3.35], [3.45, 4.95], [5.05, 6.55]].forEach(([x0, x1]) => {
        const cx = (x0 + x1) / 2, w = x1 - x0, z = 3.86;
        [x0, x1].forEach(x => { cyl(0.022, 0.022, 0.98, m.metal, x, 0.49, z, 10); box(0.06, 0.02, 0.36, m.metal, x, 0.01, z + 0.1); });
        const top = cyl(0.024, 0.024, w, m.metal, cx, 0.97, z, 10); top.rotation.z = Math.PI / 2;
        const low = cyl(0.018, 0.018, w, m.metal, cx, 0.52, z, 10); low.rotation.z = Math.PI / 2;
      });
      // スピーカーとモニター
      [0.5, 6.3].forEach(x => {
        box(0.62, 0.8, 0.6, m.black, x, 0.75, 3.15); box(0.62, 0.8, 0.55, m.black, x, 1.56, 3.15);
        box(0.52, 0.66, 0.01, m.grille, x, 0.75, 3.455); box(0.52, 0.66, 0.01, m.grille, x, 1.56, 3.43);
      });
      { const dm = box(0.5, 0.28, 0.4, m.black, 2.75, 0.49, 1.85); dm.rotation.y = 0.8; dm.rotation.x = -0.4; }
      [1.6, 2.8, 4.0, 5.2].forEach(x => { const o = box(0.6, 0.3, 0.42, m.black, x, 0.5, 3.35); o.rotation.x = -0.45; });
      // アンプ(Marshallのスタックとベースアンプ)
      box(0.76, 0.76, 0.36, m.black, 4.9, 0.73, 0.45); box(0.66, 0.6, 0.01, m.grille, 4.9, 0.73, 0.635);
      box(0.76, 0.28, 0.32, m.black, 4.9, 1.25, 0.45); facePlane(0.22, 0.05, new T.MeshBasicMaterial({ color: 0xd9c38c }), 4.9, 1.27, 0.615, 0);
      box(0.62, 1.2, 0.42, m.black, 1.9, 0.95, 0.45); box(0.54, 1.06, 0.01, m.grille, 1.9, 0.95, 0.665);
      box(0.62, 0.2, 0.38, m.black, 1.9, 1.65, 0.45);
      box(0.76, 0.58, 0.28, m.black, 5.95, 0.64, 0.75); box(0.68, 0.36, 0.01, P(0x9a9ea3), 5.95, 0.6, 0.895);
      // ドラム
      const kick = cyl(0.28, 0.28, 0.42, m.shell, 3.4, 0.63, 1.25); kick.rotation.x = Math.PI / 2;
      const head = new T.Mesh(new T.CircleGeometry(0.265, 24), P(0x9e9a90, { roughness: 0.8 })); head.position.set(3.4, 0.63, 1.462); add(head);
      cyl(0.18, 0.18, 0.14, m.shell, 2.95, 1.0, 1.55); cyl(0.14, 0.14, 0.2, m.shell, 3.22, 1.12, 1.05); cyl(0.15, 0.15, 0.2, m.shell, 3.6, 1.12, 1.05);
      cyl(0.2, 0.2, 0.42, m.shell, 3.95, 0.75, 1.55);
      [[2.7, 1.25, 1.45, 0.18], [3.0, 1.62, 0.85, 0.22], [3.95, 1.45, 0.95, 0.25]].forEach(([x, y, z, r]) => { cyl(r, r, 0.01, m.gold, x, y, z); cyl(0.012, 0.012, y - 0.35, m.metal, x, 0.35 + (y - 0.35) / 2, z, 8); });
      cyl(0.17, 0.17, 0.08, m.black, 3.4, 0.82, 0.7);
      // マイクスタンド
      [2.2, 3.4, 4.6].forEach(x => { cyl(0.012, 0.012, 1.45, m.metal, x, 0.35 + 0.72, 2.95, 8); cyl(0.13, 0.13, 0.02, m.black, x, 0.36, 2.95); const mic = cyl(0.022, 0.016, 0.16, m.black, x, 1.82, 3.02, 10); mic.rotation.x = 0.9; });
      // ---- ステージの上の細かい物(ラグ、ケーブル、養生テープ、セトリ、足元の機材、アンプのつまみ、ドラムの金具、ギター) ----
      // 写真らしさは「物の密度」で決まるので、本番前のステージにあるものをひととおり置く
      {
        const SY = 0.353, off = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
        const flat = (x, z, w, d, mat, rz, y) => { const o = new T.Mesh(new T.PlaneGeometry(w, d), mat); o.rotation.x = -Math.PI / 2; o.rotation.z = rz || 0; o.position.set(x, y || SY, z); return add(o); };
        const part = (g, geo, mat, x, y, z) => { const o = new T.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o; };
        const group = (x, y, z, ry) => { const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0; return add(g); };
        // ドラムの下のラグ(滑り止め。赤いじゅうたん)
        const rugTex = signTex(T, (g, w, h) => {
          g.fillStyle = "#4e1518"; g.fillRect(0, 0, w, h);
          g.strokeStyle = "#b99a6a"; g.lineWidth = 5; g.strokeRect(12, 12, w - 24, h - 24); g.lineWidth = 2; g.strokeRect(24, 24, w - 48, h - 48);
          for (let y = 44; y < h - 40; y += 30) for (let x = 44 + ((y / 30) % 2 ? 15 : 0); x < w - 40; x += 30) { g.fillStyle = (x + y) % 60 < 30 ? "#7d2a25" : "#2a1418"; g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x + 9, y); g.lineTo(x, y + 9); g.lineTo(x - 9, y); g.fill(); }
          for (let i = 0; i < 2600; i++) { g.fillStyle = "rgba(0,0,0," + (rnd() * 0.25).toFixed(2) + ")"; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
        }, 256, 256);
        flat(3.42, 1.32, 2.5, 2.0, new T.MeshStandardMaterial(Object.assign({ map: rugTex, roughness: 1 }, off)), 0.03);
        // 養生テープ(立ち位置のバミリ、ケーブルを床に留める)
        const tape = new T.MeshStandardMaterial(Object.assign({ color: lin(0xd8d4c4), roughness: 0.9 }, off)), tapeY = new T.MeshStandardMaterial(Object.assign({ color: lin(0xc9b23a), roughness: 0.9 }, off));
        [2.2, 3.4, 4.6].forEach(x => { flat(x, 2.72, 0.2, 0.028, tape, 0.78, SY + 0.001); flat(x, 2.72, 0.2, 0.028, tape, -0.78, SY + 0.001); });
        [[1.3, 3.05, 0.2], [2.9, 3.1, -0.1], [4.1, 3.08, 0.15], [5.4, 2.4, 1.2], [1.5, 1.6, 1.0], [5.0, 1.5, -0.9]].forEach(([x, z, r]) => flat(x, z, 0.16, 0.05, rnd() < 0.3 ? tapeY : tape, r, SY + 0.012));
        flat(3.4, 3.62, 6.4, 0.05, tapeY, 0, SY + 0.001);   // ステージの端の目印
        // セトリ(床に貼った紙)
        const paper = new T.MeshStandardMaterial(Object.assign({ map: signTex(T, (g, w, h) => { g.fillStyle = "#e4e0d4"; g.fillRect(0, 0, w, h); g.fillStyle = "#26262a"; g.fillRect(w * 0.2, h * 0.08, w * 0.6, 5); for (let i = 0; i < 8; i++) g.fillRect(w * 0.14, h * (0.2 + i * 0.09), w * (0.3 + ((i * 53) % 45) / 100), 4); }, 64, 90), roughness: 0.95 }, off));
        [[2.45, 3.08, 0.12], [3.66, 3.1, -0.08], [4.84, 3.06, 0.2], [3.1, 0.62, 2.9]].forEach(([x, z, r]) => flat(x, z, 0.21, 0.297, paper, r, SY + 0.002));
        // ケーブル(床を這う。マイク→ステージボックス、アンプ→足元、電源)
        const cableMat = P(0x0a0a0b, { roughness: 0.55 });
        const cable = (ax, az, bx, bz, wig, r, ay, by) => {
          const pts = [], n = 7, len = Math.hypot(bx - ax, bz - az) || 1, px = -(bz - az) / len, pz = (bx - ax) / len, ph = rnd() * 6;
          for (let i = 0; i <= n; i++) { const t = i / n, k = Math.sin(t * Math.PI) * (wig || 0.12) * Math.sin(t * 7 + ph); pts.push(new T.Vector3(ax + (bx - ax) * t + px * k, SY + 0.008 + (i === 0 ? (ay || 0) : i === n ? (by || 0) : 0), az + (bz - az) * t + pz * k)); }
          add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 36, r || 0.007, 5), cableMat));
        };
        const coil = (x, z) => { for (let i = 0; i < 3; i++) { const o = new T.Mesh(new T.TorusGeometry(0.085 + i * 0.012, 0.007, 5, 20), cableMat); o.rotation.x = Math.PI / 2; o.position.set(x + (rnd() - 0.5) * 0.02, SY + 0.008 + i * 0.011, z + (rnd() - 0.5) * 0.02); add(o); } };
        // ステージボックス(マイクの線が集まる箱)
        box(0.34, 0.09, 0.24, m.black, 0.95, SY + 0.045, 2.55); box(0.3, 0.005, 0.2, m.metal, 0.95, SY + 0.092, 2.55);
        for (let i = 0; i < 8; i++) cyl(0.011, 0.011, 0.012, m.black, 0.83 + (i % 4) * 0.08, SY + 0.098, 2.5 + ((i / 4) | 0) * 0.1, 8);
        [2.2, 3.4, 4.6].forEach(x => { cable(x, 2.95, 0.98, 2.6, 0.16, 0.006, 0.1); coil(x + 0.2, 2.78); });
        cable(3.0, 1.5, 0.95, 2.5, 0.2); cable(3.8, 1.3, 0.95, 2.48, 0.25); cable(3.4, 1.5, 1.0, 2.52, 0.18);
        [1.6, 2.8, 4.0, 5.2].forEach(x => cable(x, 3.2, x + 0.5, 3.52, 0.05, 0.006));
        cable(0.9, 3.5, 6.2, 3.5, 0.03, 0.009);
        cable(4.9, 0.66, 4.6, 2.5, 0.22, 0.006, 0.25); cable(1.9, 0.7, 2.2, 2.5, 0.2, 0.006, 0.2); cable(5.95, 0.9, 5.5, 2.3, 0.15, 0.006, 0.15);
        cable(5.6, 0.9, 4.95, 0.3, 0.1, 0.008); cable(5.6, 0.92, 2.1, 0.28, 0.08, 0.008);
        // 電源タップとDI
        box(0.34, 0.04, 0.07, P(0x141416, { roughness: 0.5, metalness: 0.4 }), 5.6, SY + 0.02, 0.9); box(0.34, 0.04, 0.07, P(0x141416, { roughness: 0.5, metalness: 0.4 }), 2.5, SY + 0.02, 0.3); { const l = new T.Mesh(new T.SphereGeometry(0.006, 6, 4), glow(0xff3020, 3)); l.position.set(5.74, SY + 0.04, 0.9); add(l); }
        box(0.085, 0.045, 0.12, P(0x1f4a5a, { roughness: 0.5, metalness: 0.4 }), 2.05, SY + 0.023, 1.15); [[5.35, 1.3], [1.45, 1.5], [5.75, 1.75]].forEach(([x, z]) => { box(0.12, 0.05, 0.13, P(0x9a9ea3, { roughness: 0.4, metalness: 0.7 }), x, SY + 0.025, z); box(0.125, 0.054, 0.02, m.black, x, SY + 0.025, z - 0.06); box(0.125, 0.054, 0.02, m.black, x, SY + 0.025, z + 0.06); });
        // 足元のエフェクター
        const board = (x, z, ry, cols) => {
          const g = group(x, SY, z, ry);
          part(g, new T.BoxGeometry(0.13 * cols.length + 0.04, 0.025, 0.3), m.black, 0, 0.0125, 0);
          cols.forEach((c, i) => {
            const px = (i - (cols.length - 1) / 2) * 0.13;
            part(g, new T.BoxGeometry(0.078, 0.046, 0.128), P(c, { roughness: 0.4, metalness: 0.35, envMapIntensity: 0.6 }), px, 0.048, 0.01);
            part(g, new T.CylinderGeometry(0.013, 0.013, 0.014, 10), m.metal, px, 0.078, 0.045);
            [-0.02, 0.02].forEach(dx => part(g, new T.CylinderGeometry(0.009, 0.009, 0.014, 8), m.black, px + dx, 0.078, -0.03));
            part(g, new T.SphereGeometry(0.0045, 6, 4), glow(i % 3 ? 0xff2a2a : 0x39ff6a, 3), px, 0.073, 0.008);
          });
        };
        board(4.6, 2.5, 0.06, [0xc9a23a, 0x2f7a4a, 0x8a2a2a, 0x2a3f8a, 0xd8d4c4]);
        board(2.2, 2.52, -0.08, [0x1c1c1e, 0xd0661f, 0x3a7fae]);
        board(3.4, 2.62, 0, [0x8a2a2a]);
        // アンプの顔(つまみ、白い縁取り、ランプ、角の金具)
        const knobs = (x0, y, z, n, step, mat, r) => { for (let i = 0; i < n; i++) { const k = cyl(r || 0.012, r || 0.012, 0.016, mat, x0 + i * step, y, z, 10); k.rotation.x = Math.PI / 2; } };
        const white = P(0xd8d4c4, { roughness: 0.7 });
        knobs(4.82, 1.27, 0.625, 8, 0.027, m.gold);
        box(0.74, 0.004, 0.004, white, 4.9, 1.34, 0.612); box(0.74, 0.004, 0.004, white, 4.9, 1.16, 0.612); box(0.74, 0.004, 0.004, white, 4.9, 1.075, 0.632);
        facePlane(0.17, 0.035, new T.MeshBasicMaterial({ color: lin(0xd8d4c4) }), 4.9, 1.0, 0.642, 0);
        { const l = new T.Mesh(new T.SphereGeometry(0.008, 8, 6), glow(0xff2a1a, 3.5)); l.position.set(4.62, 1.27, 0.625); add(l); }
        [[4.53, 0.37], [5.27, 0.37], [4.53, 1.1], [5.27, 1.1], [4.53, 1.12], [5.27, 1.12], [4.53, 1.38], [5.27, 1.38]].forEach(([x, y]) => box(0.035, 0.035, 0.035, m.ceilPipe, x, y, 0.62));
        facePlane(0.5, 0.075, new T.MeshStandardMaterial({ color: lin(0x9a9ea3), metalness: 0.7, roughness: 0.4 }), 1.9, 1.66, 0.642, 0);
        knobs(1.72, 1.66, 0.648, 7, 0.05, m.black, 0.014);
        { const l = new T.Mesh(new T.SphereGeometry(0.007, 8, 6), glow(0x3aa0ff, 3.5)); l.position.set(2.11, 1.66, 0.648); add(l); }
        for (let i = 0; i < 6; i++) cyl(0.016, 0.012, 0.022, m.black, 5.72 + i * 0.09, 0.94, 0.72, 10);
        { const l = new T.Mesh(new T.SphereGeometry(0.007, 8, 6), glow(0xff2a1a, 3.5)); l.position.set(6.27, 0.935, 0.72); add(l); }
        // アンプの上のタオルと水、足元のペットボトル
        { const tw = box(0.32, 0.014, 0.22, P(0xd9d5c8, { roughness: 1 }), 5.05, 1.397, 0.45); tw.rotation.y = 0.2; }
        const bottleMat = new T.MeshStandardMaterial({ color: lin(0xbfdcec), transparent: true, opacity: 0.38, roughness: 0.08, envMapIntensity: 1 });
        const bottle = (x, y, z) => { cyl(0.031, 0.031, 0.19, bottleMat, x, y + 0.095, z, 12); cyl(0.015, 0.015, 0.03, P(0x2f6fd0, { roughness: 0.5 }), x, y + 0.2, z, 8); };
        bottle(4.68, 1.39, 0.42); bottle(2.42, SY, 2.9); bottle(3.72, SY, 0.72); bottle(1.62, 1.75, 0.45); bottle(4.82, SY, 2.92);
        // ドラムの金具(フープ、皮、脚、ペダル)
        const hoop = (x, y, z, r, flatUp) => { const o = new T.Mesh(new T.TorusGeometry(r + 0.004, 0.009, 6, 28), m.metal); if (flatUp) o.rotation.x = Math.PI / 2; o.position.set(x, y, z); add(o); };
        const skin2 = P(0x45433e, { roughness: 1, envMapIntensity: 0 });
        [[2.95, 1.0, 1.55, 0.18, 0.14], [3.22, 1.12, 1.05, 0.14, 0.2], [3.6, 1.12, 1.05, 0.15, 0.2], [3.95, 0.75, 1.55, 0.2, 0.42]].forEach(([x, y, z, r, h]) => {
          hoop(x, y + h / 2, z, r, true); hoop(x, y - h / 2, z, r, true);
          const hd = new T.Mesh(new T.CircleGeometry(r - 0.006, 24), skin2); hd.rotation.x = -Math.PI / 2; hd.position.set(x, y + h / 2 + 0.002, z); add(hd);
          for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; cyl(0.008, 0.008, h * 0.5, m.metal, x + Math.cos(a) * (r + 0.006), y, z + Math.sin(a) * (r + 0.006), 6); }
        });
        hoop(3.4, 0.63, 1.46, 0.28, false); hoop(3.4, 0.63, 1.04, 0.28, false);
        { const port = new T.Mesh(new T.CircleGeometry(0.06, 16), P(0x0a0a0a, { roughness: 1 })); port.position.set(3.52, 0.55, 1.464); add(port); }
        [[-1, 1.42], [1, 1.42]].forEach(([sd, z]) => { const sp = cyl(0.008, 0.008, 0.3, m.metal, 3.4 + sd * 0.3, 0.45, z, 6); sp.rotation.z = sd * 0.7; });
        [0, 2.1, 4.2].forEach(a => { const l = cyl(0.009, 0.009, 0.56, m.metal, 3.95 + Math.cos(a) * 0.21, 0.62, 1.55 + Math.sin(a) * 0.21, 6); });
        cyl(0.014, 0.014, 0.58, m.metal, 2.95, 0.64, 1.55, 8); [0, 2.1, 4.2].forEach(a => { const l = cyl(0.008, 0.008, 0.34, m.metal, 2.95 + Math.cos(a) * 0.12, 0.44, 1.55 + Math.sin(a) * 0.12, 6); l.rotation.z = Math.cos(a) * 0.6; l.rotation.x = -Math.sin(a) * 0.6; });
        cyl(0.012, 0.012, 0.22, m.metal, 3.22, 0.98, 1.1, 8); cyl(0.012, 0.012, 0.22, m.metal, 3.6, 0.98, 1.1, 8);
        box(0.09, 0.02, 0.26, m.metal, 3.4, SY + 0.02, 0.93); cyl(0.012, 0.012, 0.47, m.metal, 3.4, 0.59, 0.7, 8);
        // ハイハットのペダルと、シンバルスタンドの三脚
        [[2.7, 1.45], [3.0, 0.85], [3.95, 0.95]].forEach(([x, z]) => [0, 2.1, 4.2].forEach(a => { const l = cyl(0.007, 0.007, 0.3, m.metal, x + Math.cos(a) * 0.11, 0.42, z + Math.sin(a) * 0.11, 6); l.rotation.z = Math.cos(a) * 0.75; l.rotation.x = -Math.sin(a) * 0.75; }));
        cyl(0.18, 0.18, 0.006, m.gold, 2.7, 1.235, 1.45);
        // マイクスタンドの三脚とブーム、マイクの線
        [2.2, 3.4, 4.6].forEach(x => {
          [0.5, 2.6, 4.7].forEach(a => { const l = cyl(0.008, 0.008, 0.34, m.metal, x + Math.cos(a) * 0.13, 0.44, 2.95 + Math.sin(a) * 0.13, 6); l.rotation.z = Math.cos(a) * 0.85; l.rotation.x = -Math.sin(a) * 0.85; });
          const bm = cyl(0.008, 0.008, 0.5, m.metal, x, 1.8, 2.87, 6); bm.rotation.x = 1.25;
          cyl(0.02, 0.02, 0.05, m.black, x, 1.75, 2.95, 8);
        });
        // スタンドに立てかけたギターとベース
        const guitar = (x, z, ry, col, bass) => {
          const g = group(x, SY, z, ry), L = bass ? 1.12 : 1.0, body = P(col, { roughness: 0.25, metalness: 0.1, envMapIntensity: 0.9 });
          const inst = new T.Group(); inst.position.set(0, 0.14, 0); inst.rotation.x = -0.24; g.add(inst);
          const lo = part(inst, new T.CylinderGeometry(0.165, 0.165, 0.04, 22), body, 0, 0.17, 0); lo.rotation.x = Math.PI / 2; lo.scale.set(1, 1, 1.12);
          const up = part(inst, new T.CylinderGeometry(0.13, 0.13, 0.04, 20), body, 0, 0.4, 0); up.rotation.x = Math.PI / 2;
          part(inst, new T.BoxGeometry(0.2, 0.16, 0.04), body, 0, 0.3, 0);
          part(inst, new T.BoxGeometry(0.11, 0.2, 0.004), P(0xe4e0d4, { roughness: 0.5 }), 0.02, 0.24, 0.023);
          part(inst, new T.BoxGeometry(0.075, 0.02, 0.012), m.metal, 0, 0.16, 0.026); part(inst, new T.BoxGeometry(0.07, 0.022, 0.01), m.black, 0, 0.3, 0.025);
          part(inst, new T.BoxGeometry(bass ? 0.05 : 0.045, 0.62 * L, 0.022), P(0x2a1c12, { roughness: 0.5 }), 0, 0.5 + 0.31 * L, 0.006);
          part(inst, new T.BoxGeometry(0.065, 0.16, 0.018), body, 0.006, 0.5 + 0.62 * L + 0.08, -0.004);
          for (let i = 0; i < (bass ? 4 : 6); i++) part(inst, new T.CylinderGeometry(0.006, 0.006, 0.02, 6), m.metal, i % 2 ? 0.045 : -0.035, 0.5 + 0.62 * L + 0.03 + ((i / 2) | 0) * 0.045, 0).rotation.z = Math.PI / 2;
          // スタンド
          part(g, new T.CylinderGeometry(0.009, 0.009, 0.72, 6), m.black, 0, 0.36, -0.13).rotation.x = -0.12;
          [-1, 1].forEach(sd => { const l = part(g, new T.CylinderGeometry(0.008, 0.008, 0.34, 6), m.black, sd * 0.13, 0.06, 0.02); l.rotation.z = Math.PI / 2; l.rotation.y = sd * 0.5; });
          part(g, new T.BoxGeometry(0.2, 0.02, 0.03), m.black, 0, 0.1, 0.06);
        };
        // ---- 機材の顔: 公式サイトの機材リスト(2015年)に載っていた実物に合わせる ----
        // ギター: Marshall JCM900 + 1960TV ／ Fender Hot Rod DeVille 212 ／ Roland JC-120。ベース: Marshall のヘッド + Ampeg SVT-810E
        // ドラム: TAMA Superstar(22/16/13/12)。卓: Allen&Heath ZED-436。メイン: Electro-Voice MT-4。マイク: SHURE SM58 / SM57
        const face = (w, h, x, y, z, paint, ry, px) => { const k = px || 420, t = signTex(T, (g, cw, ch) => paint(g, cw, ch, cw / w), Math.round(w * k), Math.round(h * k)); t.anisotropy = 4;
          return facePlane(w, h, new T.MeshStandardMaterial({ map: t, roughness: 0.85, envMapIntensity: 0.2 }), x, y, z, ry || 0); };
        const cloth = (g, x, y, w, h, c0, c1, n) => { g.fillStyle = c0; g.fillRect(x, y, w, h); g.fillStyle = c1; for (let j = 0; j * n < h; j++) for (let i = j % 2; i * n < w; i += 2) g.fillRect(x + i * n, y + j * n, Math.min(n, w - i * n), Math.min(n, h - j * n)); };
        const piping = (g, x, y, w, h, c, lw) => { g.strokeStyle = c; g.lineWidth = lw || 3; g.strokeRect(x, y, w, h); };
        const cone = (g, x, y, r, c) => { g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.beginPath(); g.arc(x, y, r * 0.28, 0, 7); g.stroke(); };
        const label = (g, t, x, y, px, c, font, al) => { g.fillStyle = c; g.font = font.replace("#", px); g.textAlign = al || "center"; g.textBaseline = "middle"; g.fillText(t, x, y); };
        const SCRIPT = "italic 700 #px Georgia, 'Times New Roman', serif", SANS = "800 #px Arial, Helvetica, sans-serif";
        // Marshall 1960TV(背の高い4発キャビ。チェック柄の布、白い縁取り、白い筆記体のロゴ)
        face(0.77, 0.77, 4.9, 0.735, 0.646, (g, w, h, u) => {
          g.fillStyle = "#101011"; g.fillRect(0, 0, w, h);
          cloth(g, u * 0.05, u * 0.05, w - u * 0.1, h - u * 0.1, "#1d1c1a", "#2b2925", Math.max(3, u * 0.012));
          piping(g, u * 0.05, u * 0.05, w - u * 0.1, h - u * 0.1, "#d8d4c4", u * 0.006);
          [[0.26, 0.27], [0.74, 0.27], [0.26, 0.73], [0.74, 0.73]].forEach(([a, b]) => cone(g, w * a, h * b, u * 0.15, "rgba(0,0,0,.35)"));
          label(g, "Marshall", w * 0.5, h * 0.2, u * 0.085, "#e8e4d6", SCRIPT);
        });
        // Marshall JCM900(ヘッド。上が黒い布、下が金のパネル)
        face(0.75, 0.275, 4.9, 1.25, 0.6165, (g, w, h, u) => {
          g.fillStyle = "#0f0f10"; g.fillRect(0, 0, w, h);
          cloth(g, u * 0.03, u * 0.03, w - u * 0.06, h * 0.5, "#161616", "#1e1d1c", Math.max(2, u * 0.006));
          piping(g, u * 0.03, u * 0.03, w - u * 0.06, h - u * 0.06, "#d8d4c4", u * 0.005);
          g.fillStyle = "#b8974a"; g.fillRect(u * 0.035, h * 0.6, w - u * 0.07, h * 0.3);
          g.fillStyle = "#3a2f14"; for (let i = 0; i < 9; i++) g.fillRect(u * (0.3 + i * 0.027) - 1, h * 0.84, 2, h * 0.03);
          label(g, "Marshall", w * 0.5, h * 0.3, u * 0.075, "#e8e4d6", SCRIPT);
          label(g, "JCM 900", w * 0.87, h * 0.66, u * 0.018, "#2a2210", SANS);
        });
        // Marshall のベースヘッド
        face(0.61, 0.195, 1.9, 1.65, 0.6435, (g, w, h, u) => {
          g.fillStyle = "#0f0f10"; g.fillRect(0, 0, w, h); piping(g, u * 0.02, u * 0.02, w - u * 0.04, h - u * 0.04, "#b8974a", u * 0.004);
          g.fillStyle = "#1b1b1c"; g.fillRect(u * 0.03, h * 0.45, w - u * 0.06, h * 0.42); g.strokeStyle = "#b8974a"; g.lineWidth = 1.5; g.strokeRect(u * 0.03, h * 0.45, w - u * 0.06, h * 0.42);
          label(g, "Marshall", w * 0.5, h * 0.25, u * 0.055, "#e8e4d6", SCRIPT);
          label(g, "INTEGRATED BASS SYSTEM", w * 0.5, h * 0.82, u * 0.012, "#b8974a", SANS);
        });
        // Ampeg SVT-810E(10インチ8発の「冷蔵庫」。黒い布を白い縁取りで4段に分ける)
        face(0.61, 1.2, 1.9, 0.95, 0.672, (g, w, h, u) => {
          g.fillStyle = "#0e0e0f"; g.fillRect(0, 0, w, h);
          cloth(g, u * 0.03, u * 0.03, w - u * 0.06, h - u * 0.06, "#131314", "#1a1a1b", Math.max(2, u * 0.005));
          for (let i = 0; i < 4; i++) { const y0 = u * 0.03 + i * (h - u * 0.06) / 4; piping(g, u * 0.035, y0 + u * 0.005, w - u * 0.07, (h - u * 0.06) / 4 - u * 0.01, "#c9c6ba", u * 0.006);
            [0.27, 0.73].forEach(a => cone(g, w * a, y0 + (h - u * 0.06) / 8, u * 0.11, "rgba(255,255,255,.035)")); }
          g.fillStyle = "#c9c6ba"; g.fillRect(u * 0.06, u * 0.06, u * 0.15, u * 0.035); label(g, "ampeg", u * 0.135, u * 0.079, u * 0.028, "#111", SANS);
        });
        // Roland JC-120(上に銀のパネル、下に12インチ2発。布ごしに銀色のキャップが見える)
        face(0.76, 0.58, 5.95, 0.64, 0.9, (g, w, h, u) => {
          g.fillStyle = "#0e0e0f"; g.fillRect(0, 0, w, h);
          g.fillStyle = "#1a1a1b"; g.fillRect(u * 0.02, h * 0.2, w - u * 0.04, h * 0.77);
          [0.27, 0.73].forEach(a => { cone(g, w * a, h * 0.59, u * 0.15, "rgba(255,255,255,.05)"); g.fillStyle = "rgba(190,195,200,.3)"; g.beginPath(); g.arc(w * a, h * 0.59, u * 0.045, 0, 7); g.fill(); });
          g.fillStyle = "#a9adb2"; g.fillRect(u * 0.02, h * 0.03, w - u * 0.04, h * 0.15);
          g.fillStyle = "#17181a"; for (let i = 0; i < 13; i++) { g.beginPath(); g.arc(u * (0.09 + i * 0.047), h * 0.105, u * 0.011, 0, 7); g.fill(); }
          label(g, "JC-120  JAZZ CHORUS", w * 0.3, h * 0.05, u * 0.011, "#222", SANS);
          g.fillStyle = "#b5b9be"; g.fillRect(u * 0.04, h * 0.9, u * 0.13, u * 0.03); label(g, "Roland", u * 0.105, h * 0.9 + u * 0.016, u * 0.024, "#111", SANS);
          g.fillStyle = "#8f9398"; [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([a, b]) => g.fillRect(a ? w - u * 0.035 : 0, b ? h - u * 0.035 : 0, u * 0.035, u * 0.035));
        });
        for (let i = 0; i < 4; i++) cyl(0.03, 0.03, 0.03, m.black, 5.66 + (i % 2) * 0.58, SY + 0.015, 0.65 + ((i / 2) | 0) * 0.2, 10);
        // Fender Hot Rod DeVille 212(黒い外装に銀の布。つまみは天面のクロームのパネルに並ぶ)
        box(0.62, 0.54, 0.27, m.black, 0.98, SY + 0.27, 0.5);
        face(0.62, 0.54, 0.98, SY + 0.27, 0.6365, (g, w, h, u) => {
          g.fillStyle = "#0e0e0f"; g.fillRect(0, 0, w, h);
          cloth(g, u * 0.035, h * 0.16, w - u * 0.07, h * 0.8, "#8d9094", "#a3a6aa", Math.max(2, u * 0.006));
          for (let i = 0; i < 900; i++) { g.fillStyle = "rgba(0,0,0," + (rnd() * 0.18).toFixed(2) + ")"; g.fillRect(u * 0.035 + rnd() * (w - u * 0.07), h * 0.16 + rnd() * h * 0.8, 2, 2); }
          [0.27, 0.73].forEach(a => cone(g, w * a, h * 0.58, u * 0.14, "rgba(0,0,0,.12)"));
          label(g, "Fender", u * 0.13, h * 0.23, u * 0.05, "#e9eaec", SCRIPT);
        });
        box(0.52, 0.006, 0.075, P(0xc8ccd0, { metalness: 0.9, roughness: 0.25, envMapIntensity: 0.9 }), 0.98, SY + 0.543, 0.44);
        for (let i = 0; i < 9; i++) cyl(0.011, 0.014, 0.018, m.black, 0.77 + i * 0.05, SY + 0.555, 0.44, 10);
        { const l = new T.Mesh(new T.SphereGeometry(0.007, 8, 6), glow(0xff2a1a, 3)); l.position.set(1.22, SY + 0.552, 0.44); add(l); }
        cable(0.98, 0.42, 2.2, 2.45, 0.2, 0.006, 0.2);
        // メインスピーカー Electro-Voice MT-4(上がホーンの箱 MTH-4、下が低音の箱 MTL-4)
        [0.5, 6.3].forEach(x => {
          face(0.62, 0.8, x, 0.75, 3.462, (g, w, h, u) => { g.fillStyle = "#0d0d0e"; g.fillRect(0, 0, w, h); cloth(g, u * 0.03, u * 0.03, w - u * 0.06, h - u * 0.06, "#151516", "#1c1c1d", Math.max(2, u * 0.004));
            [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]].forEach(([a, b]) => cone(g, w * a, h * b, u * 0.13, "rgba(255,255,255,.04)")); g.fillStyle = "#b9bcc0"; g.fillRect(w / 2 - u * 0.035, h - u * 0.07, u * 0.07, u * 0.03); label(g, "EV", w / 2, h - u * 0.054, u * 0.024, "#111", SANS); }, 0, 300);
          face(0.62, 0.8, x, 1.56, 3.437, (g, w, h, u) => { g.fillStyle = "#0d0d0e"; g.fillRect(0, 0, w, h);
            [[0.1, 0.08, 0.8, 0.36], [0.1, 0.5, 0.8, 0.28]].forEach(([a, b, c, d]) => { const gr = g.createRadialGradient(w * (a + c / 2), h * (b + d / 2), 2, w * (a + c / 2), h * (b + d / 2), w * c * 0.6); gr.addColorStop(0, "#000"); gr.addColorStop(1, "#242426"); g.fillStyle = gr; g.fillRect(w * a, h * b, w * c, h * d); g.strokeStyle = "#2c2c2e"; g.lineWidth = 3; g.strokeRect(w * a, h * b, w * c, h * d); });
            g.fillStyle = "#b9bcc0"; g.fillRect(w / 2 - u * 0.035, h - u * 0.09, u * 0.07, u * 0.03); label(g, "EV", w / 2, h - u * 0.074, u * 0.024, "#111", SANS); }, 0, 300);
        });
        // ドラム: TAMA Superstar。バスドラムの皮にロゴ、16インチのクラッシュを足す
        { const t = signTex(T, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#1a1a1a"; g.font = "900 46px Arial, sans-serif"; g.textAlign = "center"; g.fillText("TAMA", w / 2, 52); g.font = "700 15px Arial, sans-serif"; g.fillText("SUPERSTAR", w / 2, 76); }, 256, 96);
          facePlane(0.3, 0.11, new T.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.9 }), 3.4, 0.74, 1.466, 0); }
        cyl(0.2, 0.2, 0.008, m.gold, 2.42, 1.5, 1.05); cyl(0.012, 0.012, 1.15, m.metal, 2.42, 0.925, 1.05, 8);
        // マイク: SM58 の銀色の丸い網。アンプとスネアには SM57(短いスタンド)
        const silver = P(0xb4b8bd, { metalness: 0.9, roughness: 0.35, envMapIntensity: 0.8 });
        [2.2, 3.4, 4.6].forEach(x => { const b = new T.Mesh(new T.SphereGeometry(0.027, 12, 10), silver); b.position.set(x, 1.875, 3.085); b.scale.set(1, 1.1, 1); add(b); });
        const sm57 = (x, y, z, ry) => { const g = group(x, SY, z, ry); part(g, new T.CylinderGeometry(0.07, 0.07, 0.012, 12), m.black, 0, 0.006, 0); part(g, new T.CylinderGeometry(0.007, 0.007, y, 6), m.metal, 0, y / 2, 0);
          const mc = part(g, new T.CylinderGeometry(0.013, 0.016, 0.15, 8), P(0x2a2b2e, { roughness: 0.5, metalness: 0.5 }), 0, y, 0.06); mc.rotation.x = Math.PI / 2; part(g, new T.CylinderGeometry(0.016, 0.016, 0.03, 8), silver, 0, y, 0.145).rotation.x = Math.PI / 2; };
        sm57(4.72, 0.35, 0.84, Math.PI); sm57(1.75, 0.5, 0.86, Math.PI); sm57(5.78, 0.3, 1.1, Math.PI); sm57(0.85, 0.3, 0.84, Math.PI); sm57(2.72, 0.68, 1.72, 2.2);
        // PA卓: Allen&Heath ZED-436(36チャンネル。奥につまみの列、手前に白いフェーダー)と、機材ラック
        { const t = signTex(T, (g, w, h) => {
            g.fillStyle = "#2a2c30"; g.fillRect(0, 0, w, h); g.fillStyle = "#17181a"; g.fillRect(0, 0, w, h * 0.06);
            const n = 36, cw = w * 0.84 / n, KN = ["#c8443c", "#d8d8d8", "#3f78c8", "#3f78c8", "#3f9a58", "#3f9a58", "#3f78c8", "#d8b23a", "#d8b23a", "#d8b23a", "#d8b23a", "#d8d8d8"];
            for (let i = 0; i < n; i++) { const x = w * 0.02 + i * cw; g.fillStyle = i % 2 ? "#26282c" : "#2e3034"; g.fillRect(x, h * 0.06, cw - 1, h * 0.94);
              KN.forEach((c, k) => { g.fillStyle = c; g.beginPath(); g.arc(x + cw / 2, h * (0.1 + k * 0.042), cw * 0.24, 0, 7); g.fill(); });
              g.fillStyle = "#0c0c0d"; g.fillRect(x + cw / 2 - 1, h * 0.66, 2, h * 0.3); g.fillStyle = "#e8e8e4"; g.fillRect(x + cw * 0.2, h * (0.7 + ((i * 37) % 17) / 100), cw * 0.6, h * 0.035);
              g.fillStyle = i % 5 === 0 ? "#e04030" : "#2f8f4a"; g.fillRect(x + cw * 0.3, h * 0.625, cw * 0.4, h * 0.012); }
            g.fillStyle = "#1b1c1f"; g.fillRect(w * 0.87, h * 0.06, w * 0.13, h * 0.94);
            for (let i = 0; i < 2; i++) for (let k = 0; k < 14; k++) { g.fillStyle = k > 10 ? "#e04030" : k > 7 ? "#d8b23a" : "#2f8f4a"; g.fillRect(w * (0.9 + i * 0.03), h * (0.42 - k * 0.022), w * 0.018, h * 0.014); }
            [0.895, 0.93, 0.965].forEach((a, i) => { g.fillStyle = "#0c0c0d"; g.fillRect(w * a - 1, h * 0.66, 2, h * 0.3); g.fillStyle = i ? "#d8b23a" : "#c8443c"; g.fillRect(w * a - cw * 0.3, h * 0.76, cw * 0.6, h * 0.035); });
            g.fillStyle = "#d8d8d8"; g.font = "700 " + (h * 0.03) + "px Arial, sans-serif"; g.fillText("ALLEN&HEATH  ZED-436", w * 0.02, h * 0.045);
          }, 1024, 420); t.anisotropy = 8;
          const o = new T.Mesh(new T.PlaneGeometry(1.3, 0.54), new T.MeshStandardMaterial({ map: t, roughness: 0.6 })); o.rotation.x = -Math.PI / 2 + 0.16; o.position.set(3.2, 1.1, 7.86); add(o);
          box(1.32, 0.09, 0.56, P(0x1b1c1f, { roughness: 0.6 }), 3.2, 1.035, 7.86).rotation.x = 0.16;
          // ラック: グラフィックEQ(YAMAHA Q2031A ×2、KLARK TEKNIK)、リバーブ(SPX900/SPX90)、ディレイ(t.c. D-TWO)、CD
          box(0.5, 0.72, 0.42, m.black, 4.38, 0.36, 8.2);
          face(0.48, 0.7, 4.38, 0.36, 8.412, (g, w, h, u) => {
            g.fillStyle = "#0c0c0d"; g.fillRect(0, 0, w, h); const U = h / 8;
            const unit = (i, c, fn) => { g.fillStyle = c; g.fillRect(u * 0.01, i * U + 2, w - u * 0.02, U - 4); fn(i * U + 2, U - 4); g.fillStyle = "#777"; [0.02, 0.98].forEach(a => { g.beginPath(); g.arc(w * a, i * U + U / 2, 2.5, 0, 7); g.fill(); }); };
            const eq = (y, hh) => { for (let k = 0; k < 31; k++) { g.fillStyle = "#050505"; g.fillRect(w * (0.07 + k * 0.027), y + hh * 0.15, 2, hh * 0.7); g.fillStyle = "#d8d8d8"; g.fillRect(w * (0.07 + k * 0.027) - 2, y + hh * (0.3 + ((k * 29) % 40) / 100), 6, 4); } };
            unit(0, "#1d1e21", eq); unit(1, "#1d1e21", eq); unit(2, "#23252a", eq);
            unit(3, "#23252a", (y, hh) => { for (let k = 0; k < 16; k++) { g.fillStyle = k % 2 ? "#3f78c8" : "#c8443c"; g.beginPath(); g.arc(w * (0.1 + k * 0.053), y + hh / 2, hh * 0.16, 0, 7); g.fill(); } });
            const fx2 = (c, t2) => (y, hh) => { g.fillStyle = c; g.fillRect(w * 0.08, y + hh * 0.2, w * 0.3, hh * 0.6); g.fillStyle = "#d8d8d8"; g.font = "700 " + (hh * 0.3) + "px Arial, sans-serif"; g.textAlign = "left"; g.fillText(t2, w * 0.45, y + hh * 0.62); for (let k = 0; k < 5; k++) g.fillRect(w * (0.7 + k * 0.05), y + hh * 0.35, w * 0.03, hh * 0.3); };
            unit(4, "#18181a", fx2("#39c46a", "SPX900")); unit(5, "#18181a", fx2("#c9902a", "SPX90")); unit(6, "#101114", fx2("#3f78c8", "D-TWO")); unit(7, "#1a1b1d", fx2("#2a2a2a", "CD"));
          }, 0, 500);
        }
        guitar(5.45, 0.55, -0.25, 0x8a1a1a, false); guitar(2.78, 0.5, 0.2, 0x15161a, true); guitar(4.25, 0.5, 0.1, 0x6e3d1c, false);
      }
      // PA卓(ホールの最後列)
      box(2.6, 1.1, 0.08, m.wall, 3.4, 0.55, 7.5); box(0.08, 1.1, 1.6, m.wall, 2.1, 0.55, 8.3); box(0.08, 1.1, 1.6, m.wall, 4.7, 0.55, 8.3);
      box(2.4, 0.06, 0.6, m.black, 3.4, 0.95, 7.85); box(1.6, 0.08, 0.5, m.grille, 3.4, 1.01, 7.85);
      facePlane(0.45, 0.3, new T.MeshBasicMaterial({ color: 0x3d6f8f }), 3.4, 1.2, 8.15, 0);
      // 天井:張っていない黒い天井に、ダクト・配管・ケーブルの通り道がむき出し(2008年の写真)
      [1.2, 5.6].forEach(x => { const d = cyl(0.12, 0.12, 5.2, m.duct, x, 2.22, 6.3, 12); d.rotation.x = Math.PI / 2; });
      [[0.6, 2.3, 0.03], [2.6, 2.34, 0.025], [3.9, 2.32, 0.04], [6.2, 2.3, 0.03]].forEach(([x, y, r]) => { const d = cyl(r, r, 9.0, m.ceilPipe, x, y, 4.55, 8); d.rotation.x = Math.PI / 2; });
      [4.4, 6.2, 8.1].forEach(z => { box(6.8, 0.12, 0.1, m.ceilPipe, 3.4, 2.33, z); });
      // 天井を這う配線(梁から梁へたるむ束、結束した所、分岐の箱、蛍光灯の器具)
      { const cMat = P(0x0c0c0d, { roughness: 0.6 });
        const sag = (x, z0, z1, r, dx) => { const pts = []; for (let z = z0; z <= z1 + 0.01; z += 0.45) { const k = Math.round((z - z0) / 0.45); pts.push(new T.Vector3(x + Math.sin(k * 1.7 + x) * (dx || 0.03), 2.31 - (k % 2 ? 0.05 + rnd() * 0.05 : 0), z)); } add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), pts.length * 6, r, 5), cMat)); };
        [[0.95, 0.4, 9.0, 0.011], [1.02, 0.4, 9.0, 0.008], [3.1, 0.4, 8.9, 0.012], [3.18, 0.4, 8.9, 0.007], [3.24, 3.4, 8.9, 0.007], [5.2, 0.4, 9.0, 0.01], [6.45, 2.0, 9.0, 0.009], [2.2, 3.4, 7.6, 0.006]].forEach(([x, z0, z1, r]) => sag(x, z0, z1, r));
        const across = (z, x0, x1, r) => { const pts = []; for (let x = x0; x <= x1 + 0.01; x += 0.5) { const k = Math.round((x - x0) / 0.5); pts.push(new T.Vector3(x, 2.3 - (k % 2 ? 0.06 + rnd() * 0.04 : 0), z + Math.sin(k * 2.1) * 0.03)); } add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), pts.length * 6, r, 5), cMat)); };
        across(3.5, 0.3, 6.5, 0.01); across(3.56, 0.3, 6.5, 0.007); across(5.3, 0.9, 5.3, 0.008); across(7.2, 0.9, 6.5, 0.009);
        [[0.95, 2.6], [3.1, 4.9], [5.2, 6.8], [3.1, 1.4], [6.45, 5.0]].forEach(([x, z]) => { box(0.11, 0.055, 0.11, m.duct, x, 2.36, z); cyl(0.012, 0.012, 0.03, m.metal, x, 2.325, z, 8); });
        // 作業灯の蛍光灯(消えている。白い器具と管だけ)
        [[2.6, 6.9], [4.4, 5.0]].forEach(([x, z]) => { box(0.09, 0.04, 1.24, P(0xcfcfc8, { roughness: 0.6 }), x, 2.365, z); const t = cyl(0.014, 0.014, 1.2, P(0xdcdcd6, { roughness: 0.25 }), x, 2.335, z, 10); t.rotation.x = Math.PI / 2; });
      }
      [[1.75, 0.35], [4.9, 0.3]].forEach(([x, w]) => { box(w, 0.04, 8.8, m.ceilPipe, x, 2.27, 4.6); for (let z = 0.4; z < 9; z += 0.5) box(w, 0.025, 0.03, m.black, x, 2.29, z); });
      // 天井埋め込みのエアコン(白い四角の吹き出し口。ホールの前寄り)
      box(0.84, 0.05, 0.84, m.acWhite, 1.8, 2.37, 4.75); box(0.5, 0.012, 0.5, m.grille, 1.8, 2.343, 4.75);
      [[1.8, 4.36], [1.8, 5.14]].forEach(([x, z]) => box(0.6, 0.012, 0.08, m.grille, x, 2.343, z));
      // 防音扉(開いた状態)
      box(0.9, 2.0, 0.06, m.door, 7.25, 1.0, 6.6);

      // 照明:天井のパイプに丸い照明(PAR)を一列。前は赤・アンバー・青・白、奥は白(2008・2016年の写真、2014年の動画)
      const beams = [];
      const pipe = z => { const o = cyl(0.025, 0.025, 6.6, m.metal, 3.4, 2.33, z, 8); o.rotation.z = Math.PI / 2; };
      pipe(3.35); pipe(0.95);
      const par = (x, z, col, tilt, ph, beam, k) => {
        const g = new T.Group(); g.position.set(x, 2.33, z); g.rotation.x = tilt; add(g);
        const clamp = new T.Mesh(new T.BoxGeometry(0.03, 0.05, 0.05), m.black); clamp.position.y = -0.02; g.add(clamp);
        const can = new T.Mesh(new T.CylinderGeometry(0.1, 0.09, 0.22, 14), m.black); can.position.y = -0.15; g.add(can);
        const rim = new T.Mesh(new T.CylinderGeometry(0.106, 0.106, 0.025, 14), m.black); rim.position.y = -0.26; g.add(rim);
        const lens = new T.Mesh(new T.CircleGeometry(0.084, 18), glow(col, k)); lens.rotation.x = Math.PI / 2; lens.position.y = -0.274; g.add(lens);
        if (beam) {
          const bg = new T.CylinderGeometry(0.06, 0.5, 2.2, 18, 1, true); bg.translate(0, -1.1, 0);
          const mat = new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.03, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
          const b = new T.Mesh(bg, mat); b.position.y = -0.27; g.add(b);
          beams.push({ b, mat, ph, base: 0 });
        }
      };
      const RED = 0xff2b3a, BLU = 0x2f5bff, WHT = 0xfff1d6, AMB = 0xffa23a;
      [BLU, WHT, RED, RED, AMB, WHT, WHT, WHT, WHT, AMB, RED, RED, WHT, BLU].forEach((c, i) => par(0.35 + i * 0.47, 3.35, c, 0.42, i * 1.1, i % 2 === 0, i % 2 ? 1.2 : 1.6));
      [0.9, 2.0, 3.0, 3.8, 4.8, 5.9].forEach((x, i) => par(x, 0.95, WHT, -0.3, i * 0.9 + 0.5, i % 2 === 1, 1.4));
      // 横の壁から斜めに当てる照明
      [[0.18, 1.9, 0.6], [6.62, 1.9, -0.6]].forEach(([x, z, rz]) => { const g = new T.Group(); g.position.set(x, 2.15, z); g.rotation.z = rz; add(g); const can = new T.Mesh(new T.CylinderGeometry(0.1, 0.09, 0.28, 14), m.black); can.position.y = -0.18; g.add(can); const ln = new T.Mesh(new T.CircleGeometry(0.085, 16), glow(0xd23cff, 1.2)); ln.rotation.x = Math.PI / 2; ln.position.y = -0.33; g.add(ln); });
      // スモーク(ステージの上をゆっくり漂う)
      const hazeTex = signTex(T, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, 64, 64);
      const haze = [];
      for (let i = 0; i < 9; i++) {
        const sp = new T.Sprite(new T.SpriteMaterial({ map: hazeTex, color: 0x9aa0aa, transparent: true, opacity: 0.05, depthWrite: false }));
        const x = 0.6 + rnd() * 5.6, y = 1.0 + rnd() * 1.0, z = 0.6 + rnd() * 3.4, sc = 1.8 + rnd() * 1.6;
        sp.position.set(x, y, z); sp.scale.set(sc, sc * 0.7, 1); add(sp); haze.push({ sp, x, y, z, ph: rnd() * 6 });
      }
      const pool = (x, z, y, col, r) => { const o = new T.Mesh(new T.CircleGeometry(r, 24), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false })); o.rotation.x = -Math.PI / 2; o.position.set(x, y, z); return add(o); };
      [[1.3, 2.3, 0xff2b3a], [3.4, 2.0, 0xfff1d6], [5.4, 2.3, 0x2f5bff], [2.4, 1.2, 0xffa23a], [4.5, 1.2, 0xd23cff]].forEach(([x, z, c]) => pool(x, z, 0.352, c, 0.75));
      [[1.8, 5.0, 0xff2b3a], [4.8, 5.2, 0x2f5bff]].forEach(([x, z, c]) => pool(x, z, 0.005, c, 0.9));

      // ステージの小物:立ち位置のテープ、足元のセットリスト、シールド(ケーブル)
      const tapeMat = P(0xe8e2c8, { roughness: 0.6 }), tapeY = P(0xd9b23a, { roughness: 0.6 }), paper = P(0xf2f0e8, { roughness: 0.9 });
      [[2.2, 2.75, 0.3], [3.4, 2.75, -0.2], [4.6, 2.75, 0.15], [1.9, 1.0, 0.6], [4.9, 1.0, -0.4], [3.4, 1.9, 1.2]].forEach(([x, z, r], i) => {
        const t = box(0.18, 0.004, 0.05, i % 3 ? tapeMat : tapeY, x, 0.352, z); t.rotation.y = r;
        const t2 = box(0.05, 0.004, 0.14, i % 3 ? tapeMat : tapeY, x + 0.06, 0.352, z + 0.03); t2.rotation.y = r;
      });
      [[2.0, 3.05, 0.2], [3.6, 3.1, -0.15], [4.8, 3.0, 0.3]].forEach(([x, z, r]) => { const o = box(0.21, 0.003, 0.3, paper, x, 0.353, z); o.rotation.y = r; });
      const cable = (pts, r) => { const curve = new T.CatmullRomCurve3(pts.map(([x, z]) => new T.Vector3(x, 0.365, z))); add(new T.Mesh(new T.TubeGeometry(curve, 40, r || 0.012, 6, false), P(0x0b0b0c, { roughness: 0.5 }))); };
      cable([[2.2, 2.95], [2.0, 2.6], [1.6, 2.2], [1.2, 1.4], [1.0, 0.6]]);
      cable([[3.4, 2.95], [3.1, 2.4], [2.6, 2.1], [2.0, 1.2], [1.9, 0.7]]);
      cable([[4.6, 2.95], [4.9, 2.4], [5.3, 1.6], [5.6, 1.1], [5.95, 0.9]]);
      cable([[1.6, 3.35], [1.0, 3.2], [0.6, 2.6], [0.4, 1.4]], 0.016); cable([[5.2, 3.35], [5.8, 3.1], [6.3, 2.3], [6.45, 1.2]], 0.016);
      // ステッカー(ホールの出入口まわりと楽屋の壁)
      const STK = ["#38c8c8", "#e8e2c8", "#d23c3c", "#f2c230", "#ffffff", "#2b2b2b", "#3b5e8c", "#e86fa8"];
      const sticker = (x, y, z, ry) => { const w = 0.06 + rnd() * 0.12, h = 0.04 + rnd() * 0.08; const o = facePlane(w, h, P(STK[(rnd() * STK.length) | 0], { roughness: 0.4 }), x, y, z, ry); o.rotation.z = (rnd() - 0.5) * 0.6; };
      for (let i = 0; i < 26; i++) sticker(6.73, 0.9 + rnd() * 1.2, 6.0 + rnd() * 0.5, -Math.PI / 2);
      for (let i = 0; i < 40; i++) sticker(6.87 + 0.004, 0.7 + rnd() * 1.4, 0.4 + rnd() * 4.4, Math.PI / 2);
      for (let i = 0; i < 18; i++) sticker(7.0 + rnd() * 1.3, 0.8 + rnd() * 1.3, 5.05, Math.PI);

      // お客さん(当たり判定なし。順路の立ち位置は避けて並べる)。体つき・服・髪をばらして、曲に合わせて揺れる
      // 逆光の縁取り: 視線に対して斜めの面ほど、ステージの光の色で明るくなる（暗い客席で人の輪郭だけが浮く）
      const rim = (mat, k) => { mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace("#include <tonemapping_fragment>",
        "float rimK = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.4);\n gl_FragColor.rgb += rimK * vec3(1.0, 0.82, 0.62) * " + k.toFixed(2) + ";\n #include <tonemapping_fragment>"); }; return mat; };
      const SKIN = [0xc99a7c, 0xb98a6c, 0xd8ab8c, 0xa77b5e].map(c => rim(P(c, { roughness: 0.7 }), 0.09));
      const CLOTH = [0x101012, 0x131316, 0x17181b, 0x151517, 0x1f2024, 0x26282d, 0x1c2030, 0x2c1518, 0x232a1f, 0x3d3f44, 0x15171c, 0x8f8b82, 0x4a161d].map(c => rim(P(c, { roughness: 0.95 }), 0.07));
      // バンドTシャツの背中のプリント（文字は読めない程度のかたまり）
      const PRINT = [0, 1, 2, 3].map(v => { const t = signTex(T, (g, w, h) => {
          g.clearRect(0, 0, w, h); g.fillStyle = g.strokeStyle = ["#d9d5c8", "#c9c2a8", "#d8d8d8", "#b9433f"][v]; g.lineWidth = 5;
          if (v === 0) { g.beginPath(); g.arc(w / 2, h * 0.4, w * 0.3, 0, 7); g.stroke(); for (let i = 0; i < 3; i++) g.fillRect(w * 0.2, h * (0.78 + i * 0.07), w * (0.6 - i * 0.15), 4); }
          else if (v === 1) { for (let i = 0; i < 9; i++) g.fillRect(w * 0.18, h * (0.12 + i * 0.085), w * (0.3 + ((i * 37) % 34) / 100), 5); }
          else if (v === 2) { g.fillRect(w * 0.15, h * 0.2, w * 0.7, h * 0.34); g.clearRect(w * 0.2, h * 0.25, w * 0.6, h * 0.24); for (let i = 0; i < 2; i++) g.fillRect(w * 0.25, h * (0.64 + i * 0.09), w * 0.5, 5); }
          else { g.font = "900 " + (h * 0.5) + "px sans-serif"; g.textAlign = "center"; g.fillText("6", w / 2, h * 0.62); g.fillRect(w * 0.2, h * 0.76, w * 0.6, 5); }
        }, 96, 96); return new T.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.95, opacity: 0.42 }); });
      const TOWEL = [0xb9433f, 0xd9d5c8, 0x2f5fb8, 0xd8b23a, 0x1f1f22].map(c => rim(P(c, { roughness: 1 }), 0.08));
      const EYE = P(0x1a1310, { roughness: 0.6 });
      const cupMat = P(0xe9e6dc, { roughness: 0.6 }), phoneBody = P(0x0c0c0e, { roughness: 0.35, metalness: 0.3 });
      const PANTS = [0x121316, 0x1b2230, 0x24262a, 0x2b2b2b, 0x3a3f4a].map(c => rim(P(c, { roughness: 0.9 }), 0.05));
      const HAIR = [0x0d0c0b, 0x15110e, 0x2a1d14, 0x0b0b0b, 0x4a3322, 0x0f0e0d].map(c => rim(P(c, { roughness: 0.72 }), 0.13));
      const pick = a => a[(rnd() * a.length) | 0];
      const torsoGeo = new T.LatheGeometry([[0, 0], [0.155, 0.01], [0.165, 0.1], [0.15, 0.26], [0.165, 0.4], [0.2, 0.49], [0.185, 0.55], [0.11, 0.6], [0.055, 0.625], [0, 0.625]].map(([x, y]) => new T.Vector2(x, y)), 14);
      const limb = (r0, r1, len, mat) => { const g = new T.CylinderGeometry(r0, r1, len, 8); g.translate(0, -len / 2, 0); return new T.Mesh(g, mat); };
      const people = [];
      const person = (x, z, i) => {
        const h = 1.55 + rnd() * 0.3, k = h / 1.7, root = new T.Group(); root.position.set(x, 0, z); root.rotation.y = (rnd() - 0.5) * 0.5; add(root);
        onFloor(x, z, 0.85, 0.85, blobMat);
        const body = new T.Group(); root.add(body); body.rotation.z = (rnd() - 0.5) * 0.07;
        const cloth = pick(CLOTH), pants = pick(PANTS), skin = pick(SKIN), hair = pick(HAIR);
        const legL = 0.8 * k;
        [-0.08, 0.08].forEach(dx => { const l = limb(0.075 * k, 0.055 * k, legL, pants); l.position.set(dx * k, legL, 0); body.add(l); const shoe = new T.Mesh(new T.BoxGeometry(0.1 * k, 0.07, 0.26 * k), m.black); shoe.position.set(dx * k, 0.035, -0.04); body.add(shoe); });
        const torso = new T.Mesh(torsoGeo, cloth); torso.scale.set(k * (0.95 + rnd() * 0.15), k, k * 0.62); torso.position.y = legL - 0.04; body.add(torso);
        const top = legL - 0.04 + 0.6 * k;
        const neck = limb(0.045 * k, 0.05 * k, 0.09, skin); neck.position.y = top + 0.07; body.add(neck);
        const head = new T.Mesh(new T.SphereGeometry(0.098 * k, 14, 12), skin); head.scale.set(0.9, 1.12, 1); head.position.y = top + 0.15 * k; body.add(head);
        [-1, 1].forEach(sd => { const eye = new T.Mesh(new T.SphereGeometry(0.014 * k, 8, 6), EYE); eye.scale.set(1.5, 0.8, 0.5); eye.position.set(sd * 0.034 * k, top + 0.158 * k, -0.089 * k); body.add(eye); });
        const style = rnd(), longHair = style < 0.3;
        // 頭のうしろ3分の2を覆う髪（顔の側だけ肌が出る）。体は -z を向いているので、髪は +z 側へずらす
        const hr = new T.Mesh(new T.SphereGeometry(0.106 * k, 16, 12), hair); hr.scale.set(0.96, 1.14, 1.02); hr.position.set(0, top + 0.158 * k, 0.026 * k); body.add(hr);
        const fringe = new T.Mesh(new T.SphereGeometry(0.104 * k, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), hair); fringe.scale.set(0.95, 1.1, 1.04); fringe.position.set(0, top + 0.172 * k, -0.004); body.add(fringe);
        if (longHair) { const back = limb(0.092 * k, 0.075 * k, (0.2 + rnd() * 0.16) * k, hair); back.position.set(0, top + 0.16 * k, 0.045 * k); back.scale.z = 0.55; body.add(back); }
        else if (style < 0.42) { const bun = new T.Mesh(new T.SphereGeometry(0.045 * k, 10, 8), hair); bun.position.set(0, top + 0.27 * k, 0.05 * k); body.add(bun); }
        else if (style < 0.55) { const tail = limb(0.03 * k, 0.018 * k, 0.2 * k, hair); tail.position.set(0, top + 0.19 * k, 0.1 * k); tail.rotation.x = -0.5; body.add(tail); }
        // 首に巻いたタオル、背中のプリント
        if (rnd() < 0.3) { const tw = new T.Mesh(new T.TorusGeometry(0.075 * k, 0.026 * k, 6, 14), pick(TOWEL)); tw.rotation.x = Math.PI / 2 + 0.25; tw.scale.set(1.25, 1, 1); tw.position.set(0, top + 0.035 * k, 0.005); body.add(tw); }
        if (!longHair && rnd() < 0.5) { const pr = new T.Mesh(new T.PlaneGeometry(0.16 * k, 0.16 * k), pick(PRINT)); pr.position.set(0, legL - 0.04 + 0.41 * k, 0.106 * k); body.add(pr); }
        if (rnd() < 0.15) { const cap = new T.Mesh(new T.SphereGeometry(0.11 * k, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), pick(CLOTH)); cap.position.y = top + 0.18 * k; body.add(cap); const brim = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 0.01, 10, 1, false, 0, Math.PI), cap.material); brim.position.set(0, top + 0.18 * k, -0.08); brim.rotation.y = Math.PI / 2; body.add(brim); }
        const raise = rnd() < 0.3 ? (rnd() < 0.5 ? -1 : 1) : 0;
        const sleeve = rnd() < 0.45 ? cloth : skin, hold = !raise && rnd() < 0.35 ? (rnd() < 0.5 ? -1 : 1) : 0, film = raise && rnd() < 0.4;
        const arms = [];
        [-1, 1].forEach(sd => {
          const sh = new T.Group(); sh.position.set(sd * 0.185 * k, top - 0.085 * k, 0); body.add(sh);
          const cap2 = new T.Mesh(new T.SphereGeometry(0.058 * k, 10, 8), cloth); cap2.scale.set(1, 0.9, 0.95); sh.add(cap2);
          const up = limb(0.052 * k, 0.043 * k, 0.3 * k, cloth); sh.add(up);
          const fore = limb(0.041 * k, 0.033 * k, 0.27 * k, sleeve); fore.position.y = -0.3 * k; up.add(fore);
          const hand = new T.Mesh(new T.SphereGeometry(0.04 * k, 8, 6), skin); hand.scale.set(0.85, 1.15, 0.6); hand.position.y = -0.29 * k; fore.add(hand);
          if (hold === sd) { const cup = new T.Mesh(new T.CylinderGeometry(0.034, 0.026, 0.1, 10), cupMat); cup.position.set(0, -0.3 * k, -0.045); cup.rotation.x = -1.45; fore.add(cup); }
          if (film && raise === sd) { const ph = new T.Mesh(new T.BoxGeometry(0.075, 0.15, 0.01), phoneBody); ph.position.set(0, -0.36 * k, 0.02); fore.add(ph);
            const scr = new T.Mesh(new T.PlaneGeometry(0.066, 0.138), glow(0xbfd4ff, 1.5)); scr.position.set(0, -0.36 * k, 0.027); fore.add(scr); }
          // 体は -z(ステージ)向き。x軸の回転は正で腕が前に出る
          if (raise === sd) { sh.rotation.x = 2.55 + rnd() * 0.4; sh.rotation.z = sd * 0.12; fore.rotation.x = 0.35; }
          else if (hold === sd) { sh.rotation.z = sd * 0.08; sh.rotation.x = 0.25; fore.rotation.x = 1.5; }
          else { sh.rotation.z = sd * 0.1; sh.rotation.x = 0.04 + rnd() * 0.16; fore.rotation.x = 0.12 + rnd() * 0.4; }
          arms.push({ sh, raised: raise === sd, base: sh.rotation.x });
        });
        people.push({ body, head, arms, ph: rnd() * 6, amp: 0.012 + rnd() * 0.025, nod: rnd() < 0.6 });
      };
      [[1.0, 4.45], [1.8, 4.4], [2.6, 4.5], [4.3, 4.45], [5.0, 4.4], [5.8, 4.5], [0.9, 5.25], [1.7, 5.45], [2.5, 5.15], [3.3, 5.5],
       [4.2, 5.25], [5.1, 5.55], [5.9, 5.35], [1.2, 6.3], [2.2, 6.5], [3.6, 6.3], [4.6, 6.6], [5.6, 6.4], [1.6, 7.6], [0.8, 8.2], [5.6, 7.5]].forEach(([x, z], i) => person(x + (rnd() - 0.5) * 0.15, z + (rnd() - 0.5) * 0.15, i));

      // 光源
      add(new T.AmbientLight(0xffffff, 0.1));
      // 前のトラスからのスポット(ドラムやマイクスタンドの影が床に落ちる)
      const spot = (x, z, tx, tz, col, inten) => {
        const l = new T.SpotLight(col, inten, 9, 0.52, 0.55, 1);
        l.position.set(x, 2.12, z); l.target.position.set(tx, 0.35, tz); add(l); add(l.target);
        l.castShadow = true; l.shadow.mapSize.set(hi ? 1024 : 512, hi ? 1024 : 512); l.shadow.bias = -0.0006; l.shadow.camera.near = 0.3; l.shadow.camera.far = 8;
        return l;
      };
      spot(2.3, 3.35, 2.8, 1.3, 0xfff1d6, 1.5); spot(4.5, 3.35, 4.1, 1.3, 0xffb060, 1.2);
      const lights = [];
      [[1.4, 2.0, 1.6, 0xff3344, 1.3], [5.4, 2.0, 1.6, 0x3355ff, 1.3], [3.4, 2.0, 2.9, 0xffe6c4, 1.0]].forEach(([x, y, z, c, i]) => { const l = new T.PointLight(c, i, 6.5); l.position.set(x, y, z); add(l); lights.push({ l, i }); });
      [[3.4, 2.2, 7.0, 0x6070ff, 0.45, 6], [9.6, 2.2, 2.4, 0xffe2c0, 0.85, 6], [9.0, 2.2, 6.4, 0xffe2c0, 0.75, 6], [12.2, 2.2, 1.9, 0xffe8d0, 0.8, 5],
       [10.4, 2.2, 8.4, 0xffd9a8, 0.7, 4], [7.6, 2.2, 2.6, 0xfff4e6, 0.32, 5], [15.5, 4.3, 6.6, 0xfff0dd, 0.9, 7], [13.0, 3.6, 3.6, 0xfff0dd, 0.6, 5]].forEach(([x, y, z, c, i, d]) => { const l = new T.PointLight(c, i, d); l.position.set(x, y, z); add(l);
        // 見える光源: 天井のソケットと裸電球、まわりのにじみ、床に落ちる明かり
        cyl(0.035, 0.045, 0.07, m.ceilPipe, x, y + 0.16, z, 10);
        const bulb = new T.Mesh(new T.SphereGeometry(0.05, 12, 8), glow(c, 2.6)); bulb.position.set(x, y + 0.08, z); add(bulb);
        const halo = new T.Sprite(new T.SpriteMaterial({ map: blobTex, color: lin(c).multiplyScalar(0.3), transparent: true, blending: T.AdditiveBlending, depthWrite: false })); halo.position.set(x, y + 0.08, z); halo.scale.set(0.9, 0.9, 1); add(halo);
        if (y < 3) sheen(x, z, 2.6, 2.6, c, 0.05 * i, 0.014);
      });
      // ホールの床に映るステージの光（濡れたような床の照り返し）
      sheen(1.6, 5.2, 2.2, 2.8, 0xff3344, 0.11); sheen(5.2, 5.2, 2.2, 2.8, 0x3355ff, 0.11); sheen(3.4, 6.0, 3.2, 4.0, 0xffe6c4, 0.07);
      sheen(2.9, 2.2, 2.4, 1.6, 0xfff1d6, 0.09, 0.362); sheen(4.2, 2.2, 2.2, 1.6, 0xffb060, 0.08, 0.362);
      // 影:透けない物はすべて影を落とし、受ける
      scene.traverse(o => { if (o.isMesh && !o.material.transparent && o.material.isMeshStandardMaterial) { o.castShadow = true; o.receiveShadow = true; } });
      return { scene, beams, lights, haze, people };
    }

    // three.js 付属の後処理(r128)。順番に読み込む
    const FX_BASE = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/";
    const FX_FILES = ["shaders/CopyShader.js", "shaders/LuminosityHighPassShader.js", "shaders/GammaCorrectionShader.js", "postprocessing/EffectComposer.js", "postprocessing/RenderPass.js", "postprocessing/ShaderPass.js", "postprocessing/UnrealBloomPass.js"];
    let fxP = null;
    const loadFx = () => fxP || (fxP = FX_FILES.reduce((p, f) => p.then(() => new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = FX_BASE + f; s.onload = res; s.onerror = () => { fxP = null; rej(new Error(f)); }; document.head.appendChild(s);
    })), Promise.resolve()));
    // ---- 場の音 ----
    // 音源のファイルは使わず、その場で合成する。階段では防音扉の向こうの低音だけがこもって聞こえ、
    // ロビーではざわめきが混ざり、ホールに入るとバンドの音がはっきりする(曲は特定のものではない、それらしい8ビート)
    function makeSound() {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      const ac = new AC(), out = ac.createGain(); out.gain.value = 0; out.connect(ac.destination);
      const noise = (sec, brown) => { const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate), d = b.getChannelData(0); let l = 0;
        for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } else d[i] = w; } return b; };
      const white = noise(2, false), brown = noise(4, true);
      const loop = (buf, type, f, q, g, to) => { const n = ac.createBufferSource(); n.buffer = buf; n.loop = true; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
        const gn = ac.createGain(); gn.gain.value = g; n.connect(fl); fl.connect(gn); gn.connect(to); n.start(); return gn; };
      // 部屋の音(空調の低いうなり)、ざわめき(人の声の帯域のノイズを、ゆっくり波打たせる)、アンプの「サー」
      loop(brown, "lowpass", 160, 0.5, 0.5, out);
      const crowd = ac.createGain(); crowd.gain.value = 0.1; crowd.connect(out);
      [[420, 0.9, 0.11], [900, 0.8, 0.17], [1700, 0.9, 0.07]].forEach(([f, g, r]) => { const gn = loop(white, "bandpass", f, 1.1, g * 0.5, crowd); const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = r; lg.gain.value = g * 0.3; lfo.connect(lg); lg.connect(gn.gain); lfo.start(); });
      const hiss = loop(white, "highpass", 5200, 0.5, 0, out);
      // バンド: 防音扉ごしのこもり具合を、ローパスの高さで表す
      const wallF = ac.createBiquadFilter(); wallF.type = "lowpass"; wallF.frequency.value = 140; wallF.Q.value = 0.7;
      const band = ac.createGain(); band.gain.value = 0.3; band.connect(wallF); wallF.connect(out);
      const shaper = ac.createWaveShaper(); { const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 3); } shaper.curve = c; } shaper.connect(band);
      const hit = (t, f0, f1, dur, g) => { const o = ac.createOscillator(), e = ac.createGain(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(e); e.connect(band); o.start(t); o.stop(t + dur + 0.02); };
      const burst = (t, type, f, dur, g) => { const n = ac.createBufferSource(); n.buffer = white; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const e = ac.createGain(); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.001, t + dur); n.connect(fl); fl.connect(e); e.connect(band); n.start(t, Math.random()); n.stop(t + dur + 0.02); };
      const tone = (t, f, dur, g, to, type) => { const o = ac.createOscillator(), e = ac.createGain(); o.type = type || "sawtooth"; o.frequency.value = f; e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + 0.01); e.gain.setValueAtTime(g, t + dur * 0.8); e.gain.linearRampToValueAtTime(0.0001, t + dur); o.connect(e); e.connect(to); o.start(t); o.stop(t + dur + 0.02); };
      const ROOT = [55, 55, 43.65, 43.65, 65.41, 65.41, 49, 49], BPM = 170, EI = 60 / BPM / 2;   // 8分音符の長さ
      let next = 0, step = 0, timer = 0, rest = 0;
      const sched = () => { const now = ac.currentTime; if (next < now) next = now + 0.05;
        while (next < now + 0.35) {
          const bar = Math.floor(step / 8) % 40, i = step % 8, root = ROOT[bar % 8];
          if (bar >= 36) { if (bar === 36 && i === 0) { burst(next, "bandpass", 1400, 3.2, 0.5); crowd.gain.setTargetAtTime(0.32, next, 0.2); crowd.gain.setTargetAtTime(0.1, next + 3.5, 1.2); } }   // 曲間: 拍手と歓声
          else {
            if (i === 0 || i === 4 || (i === 5 && bar % 2)) hit(next, 130, 42, 0.16, 0.9);                 // キック
            if (i === 2 || i === 6) { burst(next, "bandpass", 1900, 0.13, 0.5); hit(next, 210, 150, 0.08, 0.3); }   // スネア
            burst(next, "highpass", 7500, 0.035, i % 2 ? 0.07 : 0.13);                                     // ハイハット
            tone(next, root * (i === 7 ? 1.5 : 1), EI * 0.9, 0.34, band, "sawtooth");                     // ベース
            if (i % 2 === 0) { tone(next, root * 4, EI * 1.9, 0.07, shaper); tone(next, root * 6, EI * 1.9, 0.06, shaper); tone(next, root * 8.01, EI * 1.9, 0.04, shaper); }   // ギター(パワーコード)
          }
          next += EI; step++;
        } };
      let on = false, zx = null;
      return {
        set(v) { on = v; if (v) { ac.resume(); if (!timer) timer = setInterval(sched, 100); } out.gain.setTargetAtTime(v ? 0.22 : 0, ac.currentTime, 0.25); },
        // 立っている場所で聞こえ方を変える: 階段 → ロビー → ホール(前へ行くほど近い)
        zone(x, z) { if (!on) return; const k = x > 11.35 ? 0 : x > 6.8 ? 1 : 2; const key = k + ":" + (k === 2 ? Math.round(z) : 0); if (key === zx) return; zx = key; const t = ac.currentTime;
          const near = k === 2 ? Math.max(0, Math.min(1, (9 - z) / 5)) : 0;
          wallF.frequency.setTargetAtTime([110, 260, 2600 + near * 5000][k], t, 0.35);
          band.gain.setTargetAtTime([0.22, 0.3, 0.42 + near * 0.3][k], t, 0.35);
          crowd.gain.setTargetAtTime([0.02, 0.12, 0.1][k], t, 0.5); hiss.gain.setTargetAtTime(k === 2 ? 0.006 + near * 0.01 : 0, t, 0.5); },
        close() { clearInterval(timer); timer = 0; try { out.gain.setTargetAtTime(0, ac.currentTime, 0.1); setTimeout(() => ac.close(), 400); } catch (e) { /* すでに閉じている */ } },
      };
    }
    async function makeBloom(T, renderer, scene, camera) {
      await loadFx();
      const gl2 = renderer.capabilities.isWebGL2;
      const opts = { type: gl2 ? T.HalfFloatType : T.UnsignedByteType };
      const rt = gl2 && !coarse() && T.WebGLMultisampleRenderTarget ? new T.WebGLMultisampleRenderTarget(2, 2, opts) : new T.WebGLRenderTarget(2, 2, opts);
      const composer = new T.EffectComposer(renderer, rt);
      composer.addPass(new T.RenderPass(scene, camera));
      const bloom = new T.UnrealBloomPass(new T.Vector2(256, 256), 0.55, 0.45, 0.82);
      composer.addPass(bloom);
      const grade = new T.ShaderPass({
        uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: coarse() ? 0.035 : 0.05 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: [
          "uniform sampler2D tDiffuse; uniform float time; uniform float grain; varying vec2 vUv;",
          "float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }",
          "void main(){",
          "  vec2 d = vUv - 0.5; float r2 = dot(d, d);",
          "  vec2 off = d * r2 * 0.012;",                                   // レンズの端の色ずれ
          "  vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);",
          "  c = pow(max(c, 0.0), vec3(1.0 / 2.2));",                        // ガンマ（GammaCorrectionShader の代わり）
          "  c = mix(c, c * c * (3.0 - 2.0 * c), 0.35);",                    // 黒を締めて、明るい所を立てる
          "  float l = dot(c, vec3(0.299, 0.587, 0.114));",
          "  c = mix(c, c * vec3(0.94, 1.0, 1.08), (1.0 - l) * 0.35);",      // 暗い所をわずかに青く
          "  c *= mix(1.0, 0.55, smoothstep(0.12, 0.62, r2));",              // 周辺が落ちる
          "  c += (rnd(vUv * vec2(1280.0, 720.0)) - 0.5) * grain * (1.0 - l * 0.6);",   // フィルムの粒子
          "  gl_FragColor = vec4(c, 1.0);",
          "}"].join("\n"),
      });
      composer.addPass(grade);
      return {
        setSize(w, h) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); bloom.setSize(Math.round(w * renderer.getPixelRatio() / 2), Math.round(h * renderer.getPixelRatio() / 2)); },
        render() { grade.uniforms.time.value = (performance.now() % 1000) / 1000; composer.render(); },
      };
    }

    async function enter(si) {
      if (S) return;
      const root = document.createElement("div");
      root.className = "v3d";
      root.innerHTML = `
        <canvas></canvas>
        <div class="v3d-top">
          <button type="button" class="v3d-btn" data-x>× 出る</button>
          <div class="v3d-place"><span data-p>SiX-DOG</span><small data-n></small></div>
          <button type="button" class="v3d-btn" data-o ${coarse() ? "" : "hidden"} aria-label="縦と横を切り替える">縦⇄横</button>
          <button type="button" class="v3d-btn" data-a aria-pressed="false">音 OFF</button>
          <button type="button" class="v3d-btn" data-s aria-expanded="false">行き先</button>
        </div>
        <div class="v3d-stops" hidden>${STOPS.map((p, i) => `<button type="button" data-i="${i}"><b>${i + 1}</b>${p.name}</button>`).join("")}</div>
        <div class="joy" hidden><i></i></div>
        <div class="joy-home" ${coarse() ? "" : "hidden"}><i></i><span>ここを押して歩く</span></div>
        <div class="v3d-hint">${coarse() ? "行きたい場所をタップすると歩きます・左下のスティックでも歩けます・画面をなぞって見回す" : "W A S D / 矢印キーで歩く・行きたい場所をクリックしても歩ける・ドラッグで見回す"}</div>
        <div class="v3d-rot" hidden><div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7" width="19" height="10" rx="2"/><path d="M7 3.5a8 8 0 0 1 10 0M17 20.5a8 8 0 0 1-10 0"/></svg>スマホを横向きにすると、中を歩けます</div></div>
        <div class="v3d-load"><div>SiX-DOGへ向かっています…</div></div>
        <div class="v3d-voices" aria-hidden="true"></div>
        <div class="v3d-fade"></div>`;
      document.body.appendChild(root);
      document.documentElement.style.overflow = "hidden";
      const $ = s => root.querySelector(s);
      S = { root, alive: true };
      // 3Dの読み込みは先に始めておく。全画面・横向き固定は、返事が来ない端末があるので待ちすぎない
      const threeReady = loadThree();
      // お客さんのつぶやき(当時のXの投稿を、名前を出さずに短く言い換えたもの)
      const voicesP = fetch("data/voices.json").then(r => r.json()).catch(() => []);
      threeReady.catch(() => {});
      const settle = (fn, ms) => { let p; try { p = fn(); } catch (e) { p = null; } return Promise.race([Promise.resolve(p).catch(() => {}), new Promise(r => setTimeout(r, ms))]); };
      if (coarse()) {
        await settle(() => root.requestFullscreen(), 1500);
      }
      let T;
      try {
        T = await threeReady;
        await Promise.all([document.fonts.load('64px "Squada One"'), document.fonts.load('64px "Zen Kaku Gothic New"')]).catch(() => {});
      } catch (e) {
        $(".v3d-load").innerHTML = `<div>3Dを読み込めませんでした。通信状況を確かめて、もう一度お試しください。<br><br><button type="button" class="v3d-btn" data-x2>戻る</button></div>`;
        $("[data-x2]").addEventListener("click", () => { root.remove(); document.documentElement.style.overflow = ""; S = null; });
        return;
      }
      if (!S || !S.alive) return;
      const canvas = $("canvas");
      const renderer = new T.WebGLRenderer({ canvas, antialias: !coarse(), powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse() ? 1 : 1.75));
      renderer.outputEncoding = T.sRGBEncoding;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.shadowMap.enabled = !coarse();
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      const camera = new T.PerspectiveCamera(72, 1, 0.05, 60);
      camera.rotation.order = "YXZ";
      const world = build(T, renderer, !coarse());
      // 照明のにじみ(ブルーム)。読み込めなければ、にじみなしで描く
      let fx = null, snd = null;
      try { fx = await makeBloom(T, renderer, world.scene, camera); } catch (e) { fx = null; }
      // 後処理を使うときは、最後の段で明るさの補正(ガンマ)をかけるので、ここでは二重にかけない
      if (fx) renderer.outputEncoding = T.LinearEncoding;
      if (!S || !S.alive) return;
      $(".v3d-load").hidden = true;

      const st = { px: 0, pz: 0, eye: 1.6, yaw: 0, pitch: -0.05, mx: 0, my: 0, keys: new Set(), joy: null, look: null, last: performance.now(), place: "", paused: false };
      const placeEl = $("[data-p]"), noteEl = $("[data-n]");
      function setPlace(name, note) { if (st.place === name) return; st.place = name; placeEl.textContent = name; noteEl.textContent = note || ""; }
      function goTo(i) {
        const p = STOPS[i], fade = $(".v3d-fade");
        fade.classList.add("on");
        setTimeout(() => {
          st.px = p.x; st.pz = p.z; st.yaw = p.yaw; st.pitch = i === 6 ? 0.05 : -0.05;
          st.eye = floorAt(p.x, p.z) + 1.6; st.place = ""; setPlace(p.name, p.note);
          fade.classList.remove("on");
        }, reduce ? 0 : 220);
      }
      function resize() {
        const w = root.clientWidth, h = root.clientHeight;
        // 縦長の画面は横が狭くなるので、上下の画角を広げて見える範囲を保つ
        renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = h > w ? 96 : 72; camera.updateProjectionMatrix();
        if (fx) fx.setSize(w, h);
        st.paused = false; st.tall = h > w;
        $(".v3d-rot").hidden = true;
      }
      // つぶやき:近くにいて画面に映っているお客さんが、ときどき吹き出しでひとこと言う
      const voices = await voicesP, vLayer = $(".v3d-voices"), talking = [], recent = [];
      const vTmp = new T.Vector3();
      let nextVoice = performance.now() + 1500;
      function headOnScreen(p) {
        p.head.getWorldPosition(vTmp); vTmp.y += 0.22;
        const dist = Math.hypot(vTmp.x - st.px, vTmp.z - st.pz);
        vTmp.project(camera);
        const on = vTmp.z < 1 && Math.abs(vTmp.x) < 0.85 && vTmp.y < 0.9 && vTmp.y > -0.6;
        return { on, dist, x: (vTmp.x + 1) / 2 * root.clientWidth, y: (1 - vTmp.y) / 2 * root.clientHeight };
      }
      function updateVoices(now) {
        if (!voices.length) return;
        camera.updateMatrixWorld();
        if (now > nextVoice && talking.length < 3 && !st.paused) {
          nextVoice = now + 1800 + Math.random() * 2200;
          const cand = world.people.filter(p => !talking.some(t => t.p === p)).map(p => ({ p, s: headOnScreen(p) })).filter(c => c.s.on && c.s.dist < 6.5);
          if (cand.length) {
            const c = cand[(Math.random() * cand.length) | 0];
            let vi; for (let k = 0; k < 8; k++) { vi = (Math.random() * voices.length) | 0; if (!recent.includes(vi)) break; }
            recent.push(vi); if (recent.length > Math.min(20, voices.length - 1)) recent.shift();
            const v = voices[vi], el = document.createElement("div");
            el.className = "voice"; el.innerHTML = `${esc(v.t)}<small>${esc(v.d.replace("-", "."))}</small>`;
            vLayer.appendChild(el); requestAnimationFrame(() => el.classList.add("on"));
            talking.push({ p: c.p, el, until: now + 4200 });
          }
        }
        for (let i = talking.length - 1; i >= 0; i--) {
          const t = talking[i], sc = headOnScreen(t.p);
          t.el.style.left = sc.x + "px"; t.el.style.top = sc.y + "px";
          t.el.style.visibility = sc.on ? "visible" : "hidden";
          if (now > t.until) { t.el.classList.remove("on"); const el = t.el; setTimeout(() => el.remove(), 400); talking.splice(i, 1); }
        }
      }
      const hint = $(".v3d-hint");
      const hideHint = () => hint.classList.add("off");
      setTimeout(hideHint, 6000);

      const joy = $(".joy"), knob = joy.querySelector("i"), home = $(".joy-home");
      // タップ(ほとんど動かさずに離す)は「そこまで歩く」。押した位置と時刻を覚えておく
      const taps = new Map();
      // 歩く先の目印(床の上のターコイズの輪)
      const ring = new T.Mesh(new T.RingGeometry(0.16, 0.22, 32), new T.MeshBasicMaterial({ color: 0x38c8c8, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2; world.scene.add(ring);
      const ray = new T.Raycaster(), ndc = new T.Vector2();
      function tapWalk(cx, cy) {
        const r = root.getBoundingClientRect();
        ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
        camera.updateMatrixWorld();
        ray.setFromCamera(ndc, camera);
        const o = ray.ray.origin, d = ray.ray.direction;
        if (d.y > -0.02) return;
        // まず今の床の高さで当て、行ける場所ならその床の高さで当て直す(段差・ステージ・階段)
        let y = st.eye - 1.6, k = (y - o.y) / d.y, x = o.x + d.x * k, z = o.z + d.z * k;
        const w = walkAt(x, z); if (!w) return;
        y = floorAt(x, z, w); k = (y - o.y) / d.y; x = o.x + d.x * k; z = o.z + d.z * k;
        if (!walkAt(x, z) || Math.hypot(x - st.px, z - st.pz) > 14) return;
        st.target = { x, z, stuck: 0 };
        ring.position.set(x, floorAt(x, z) + 0.02, z); ring.material.opacity = 0.9;
      }
      function joyStart(e, cx, cy) {
        st.joy = { id: e.pointerId, x: cx, y: cy };
        joy.hidden = false; joy.style.left = cx + "px"; joy.style.top = cy + "px"; knob.style.transform = "";
        home.classList.add("off"); st.target = null;
      }
      canvas.addEventListener("pointerdown", e => {
        hideHint(); canvas.setPointerCapture(e.pointerId);
        taps.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
        if (e.pointerType !== "mouse" && e.clientX < root.clientWidth * (st.tall ? 0.5 : 0.45) && (!st.tall || e.clientY > root.clientHeight * 0.55) && !st.joy) joyStart(e, e.clientX, e.clientY);
        else if (!st.look) st.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
      });
      // 左下の台から始めたときは、台の真ん中を中心にする
      home.addEventListener("pointerdown", e => {
        e.preventDefault(); hideHint(); home.setPointerCapture(e.pointerId);
        const b = home.getBoundingClientRect(); joyStart(e, b.left + b.width / 2, b.top + b.height / 2);
      });
      home.addEventListener("pointermove", e => canvas.dispatchEvent(new PointerEvent("pointermove", e)));
      home.addEventListener("pointerup", e => canvas.dispatchEvent(new PointerEvent("pointerup", e)));
      home.addEventListener("pointercancel", e => canvas.dispatchEvent(new PointerEvent("pointercancel", e)));
      canvas.addEventListener("pointermove", e => {
        if (st.joy && e.pointerId === st.joy.id) {
          let dx = e.clientX - st.joy.x, dy = e.clientY - st.joy.y; const d = Math.hypot(dx, dy), R = 48;
          if (d > R) { dx = dx / d * R; dy = dy / d * R; }
          knob.style.transform = `translate(${dx}px,${dy}px)`; st.mx = dx / R; st.my = -dy / R;
        } else if (st.look && e.pointerId === st.look.id) {
          st.yaw -= (e.clientX - st.look.x) * 0.0048; st.pitch -= (e.clientY - st.look.y) * 0.0036;
          st.pitch = Math.max(-1.1, Math.min(1.1, st.pitch)); st.look.x = e.clientX; st.look.y = e.clientY;
        }
      });
      const release = e => {
        const tp = taps.get(e.pointerId); taps.delete(e.pointerId);
        const isTap = tp && e.type === "pointerup" && Math.hypot(e.clientX - tp.x, e.clientY - tp.y) < 12 && performance.now() - tp.t < 350;
        if (st.joy && e.pointerId === st.joy.id) { st.joy = null; st.mx = st.my = 0; joy.hidden = true; home.classList.remove("off"); }
        if (st.look && e.pointerId === st.look.id) st.look = null;
        if (isTap) tapWalk(e.clientX, e.clientY);
      };
      canvas.addEventListener("pointerup", release); canvas.addEventListener("pointercancel", release);
      const kd = e => { if (e.key === "Escape") { exit(); return; } st.keys.add(e.code); if (/^(Arrow|Key[WASD])/.test(e.code)) { e.preventDefault(); hideHint(); } };
      const ku = e => st.keys.delete(e.code);
      window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
      window.addEventListener("resize", resize);
      $("[data-x]").addEventListener("click", exit);
      // 音: 勝手には鳴らさない。押した人だけに鳴らし、次に来たときも同じ設定にする
      const sndBtn = $("[data-a]"), setSnd = v => { if (v && !snd) snd = makeSound(); if (!snd) { sndBtn.hidden = true; return; } snd.set(v); sndBtn.textContent = v ? "音 ON" : "音 OFF"; sndBtn.setAttribute("aria-pressed", v ? "true" : "false"); try { localStorage.setItem("sixdog_sound", v ? "1" : "0"); } catch (e) { /* 保存できない端末 */ } };
      sndBtn.addEventListener("click", () => setSnd(sndBtn.getAttribute("aria-pressed") !== "true"));
      try { if (localStorage.getItem("sixdog_sound") === "1") setSnd(true); } catch (e) { /* 読めない端末 */ }
      $("[data-o]").addEventListener("click", async () => {
        const want = root.clientHeight > root.clientWidth ? "landscape" : "portrait";
        try {
          if (!document.fullscreenElement) await root.requestFullscreen();
          await screen.orientation.lock(want);
        } catch (e) {
          hint.textContent = "この端末では切り替えられません。スマホを回してください(画面の回転を許可してください)";
          hint.classList.remove("off"); setTimeout(hideHint, 4000);
        }
      });
      const stopsEl = $(".v3d-stops"), stopsBtn = $("[data-s]");
      stopsBtn.addEventListener("click", () => { stopsEl.hidden = !stopsEl.hidden; stopsBtn.setAttribute("aria-expanded", String(!stopsEl.hidden)); });
      stopsEl.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (!b) return; stopsEl.hidden = true; stopsBtn.setAttribute("aria-expanded", "false"); goTo(+b.dataset.i); });

      function frame(t) {
        if (!S || !S.alive) return;
        const dt = Math.min(0.12, (t - st.last) / 1000); st.last = t;
        if (!st.paused) {
          const k = st.keys;
          let fw = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) + st.my;
          let sd = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0) + st.mx;
          // キーやスティックを触ったら、タップで決めた行き先はやめる
          if (st.target && (fw || sd)) st.target = null;
          if (st.target) {
            const tx = st.target.x - st.px, tz = st.target.z - st.pz, dist = Math.hypot(tx, tz);
            if (dist < 0.12 || st.target.stuck > 0.6) { st.target = null; }
            else {
              // 行き先のほうへ向きを少しずつ変えながら歩く
              const want = Math.atan2(-tx, -tz);
              let dy = want - st.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
              st.yaw += dy * Math.min(1, dt * 3);
              const f = Math.min(1, dist / 0.5), cosY = Math.cos(st.yaw), sinY = Math.sin(st.yaw);
              // 世界の向き(tx,tz)を、今向いている方向の前後・左右に直す
              fw = (-sinY * tx - cosY * tz) / dist * f; sd = (cosY * tx - sinY * tz) / dist * f;
            }
          }
          st.yaw += ((k.has("ArrowLeft") ? 1 : 0) - (k.has("ArrowRight") ? 1 : 0)) * 1.9 * dt;
          const mag = Math.hypot(fw, sd); if (mag > 1) { fw /= mag; sd /= mag; }
          const sp = 1.8 * (k.has("ShiftLeft") || k.has("ShiftRight") ? 1.8 : 1) * dt;
          const fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw), rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw);
          const nx = st.px + (fx * fw + rx * sd) * sp, nz = st.pz + (fz * fw + rz * sd) * sp;
          const ox = st.px, oz = st.pz;
          if (walkAt(nx, nz)) { st.px = nx; st.pz = nz; } else if (walkAt(nx, st.pz)) st.px = nx; else if (walkAt(st.px, nz)) st.pz = nz;
          // 壁に当たって進めないときは、しばらくしたら自動歩行をやめる
          if (st.target) { if (Math.hypot(st.px - ox, st.pz - oz) < sp * 0.2) st.target.stuck += dt; else st.target.stuck = 0; }
          const r = walkAt(st.px, st.pz);
          if (r) { const stop = STOPS.find(p => p.name === r[0]); setPlace(r[0], stop ? stop.note : ""); }
          st.eye += (floorAt(st.px, st.pz, r) + 1.6 - st.eye) * Math.min(1, dt * 10);
        }
        camera.position.set(st.px, st.eye, st.pz);
        if (!st.target && ring.material.opacity > 0) ring.material.opacity = Math.max(0, ring.material.opacity - dt * 2.5);
        camera.rotation.set(st.pitch, st.yaw, 0);
        const s = t / 1000;
        world.beams.forEach(o => { o.mat.opacity = 0.028 + 0.025 * (0.5 + 0.5 * Math.sin(s * 1.3 + o.ph)); o.b.rotation.x = o.base + Math.sin(s * 0.5 + o.ph) * 0.08; });
        world.lights.forEach((o, i) => { o.l.intensity = o.i * (0.75 + 0.25 * Math.sin(s * 1.1 + i * 2)); });
        // 曲のテンポ(だいたい170BPM)で、軽く跳ねたり、うなずいたり、拳を振ったり
        const beat = s * Math.PI * 2 * (170 / 60) / 2;
        world.people.forEach(o => {
          const b = Math.max(0, Math.sin(beat + o.ph));
          o.body.position.y = b * o.amp;
          if (o.nod) o.body.rotation.x = b * 0.04;
          o.arms.forEach(a => { if (a.raised) a.sh.rotation.x = a.base + Math.sin(beat * 2 + o.ph) * 0.18; });
        });
        world.haze.forEach(h => { h.sp.position.x = h.x + Math.sin(s * 0.11 + h.ph) * 0.5; h.sp.position.y = h.y + Math.sin(s * 0.07 + h.ph) * 0.15; h.sp.material.opacity = 0.04 + 0.02 * Math.sin(s * 0.2 + h.ph); });
        if (snd) snd.zone(st.px, st.pz);
        if (fx) fx.render(); else renderer.render(world.scene, camera);
        updateVoices(t);
        S.raf = requestAnimationFrame(frame);
      }
      function exit() {
        if (!S) return;
        S.alive = false; cancelAnimationFrame(S.raf);
        window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("resize", resize);
        try { renderer.dispose(); } catch (e) { /* 何もしない */ }
        if (snd) { snd.close(); snd = null; }
        try { screen.orientation.unlock(); } catch (e) { /* 対応していない端末 */ }
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        root.remove(); document.documentElement.style.overflow = ""; S = null;
      }
      S.exit = exit;
      resize(); goTo(si || 0);
      S.raf = requestAnimationFrame(frame);
    }
    return { enter };
  })();

  // 公演データ(data/events.json)に、みんなの修正(Supabase)を重ねてから表示する
  async function init() {
    // 旧URL(index.html?date=YYYY-MM-DD)で来たら、その公演のページへ
    const q = new URLSearchParams(location.search), qd = q.get("date");
    if (qd && /^\d{4}-\d{2}-\d{2}$/.test(qd)) history.replaceState(null, "", location.pathname + "#event-" + qd);
    let base;
    try {
      const res = await fetch("data/events.json", { cache: "no-cache" });
      base = await res.json();
    } catch (e) {
      view.innerHTML = `<p class="empty">公演データを読み込めませんでした。ページを再読み込みしてください。</p>`;
      return;
    }
    const overrides = Ed ? await Ed.fetchOverridesPublic().catch(() => ({})) : {};
    baseList = base;
    rawList = Ed ? Ed.applyOverrides(base, overrides) : base;
    await Promise.all([
      Vd && Vd.loadVideoIndex(), Lk && Lk.loadLinkIndex(), Tw && Tw.loadTweetIndex(),
      Hy && Hy.loadHypeIndex(), Em && Em.loadEmoiIndex(),
    ].map(p => Promise.resolve(p).catch(() => null)));
    build();
    window.addEventListener("hashchange", render);
    render();
  }
  init();
})();
