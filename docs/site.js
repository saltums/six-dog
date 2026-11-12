(() => {
  "use strict";
  const view = document.getElementById("view");
  const DOW = ["日", "月", "火", "水", "木", "金", "土"];
  const DOW_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  let rawList = [], events = [], byDate = new Map(), artists = [], artistByName = new Map(), months = [];
  // 投稿・反応まわりは既存の部品(supabase-config.js と各モジュール)に任せる
  const Vd = window.SixDogVideos, Lk = window.SixDogLinks, Tw = window.SixDogTweets, Hy = window.SixDogHype, Em = window.SixDogEmoi;
  const Ed = window.SixDogEditor, Sh = window.SixDogShare, Rf = window.SixDogRecentFeed;
  const vidsOn = d => (Vd && Vd.getVideosByDate ? Vd.getVideosByDate(d) : []);
  const linksOn = d => (Lk ? Lk.getLinks(d) : []);
  const hypeOn = d => (Hy ? Hy.getCount(d) : 0), emoiOn = d => (Em ? Em.getCount(d) : 0);
  const post = [];
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
        <p class="lead">2005年11月、名古屋・新栄のビルの地下にできたライブハウス SiX-DOG。2019年2月24日に閉店するまでの約13年間に、ここで開かれた公演と、そこに立ったバンドの記録を、残っていた公式サイトや当時の投稿から集めています。</p>
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
        <ul class="links">${vids.map(v => `<li><a href="${esc(v.video_url)}" target="_blank" rel="noopener noreferrer nofollow">${ic("play")}<span>${esc(v.video_title || v.video_url)}</span><small>${esc(v.performer_name || "")}</small></a></li>`).join("")}</ul>
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
      <div class="enter">${ic("cube")}<p><b>ENTER SiX-DOG</b>スマホは横向きにすると、左手で歩いて右手で見回せます。パソコンは W A S D で歩いて、ドラッグで見回します。</p><button type="button" id="enter3d">${ic("cube", "s")}中に入る</button></div>
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
    else html = vTop();
    view.classList.remove("fade", "adding"); void view.offsetWidth; view.classList.add("fade");
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
      return new T.CanvasTexture(c);
    }

    function build(T) {
      const scene = new T.Scene();
      scene.background = new T.Color(0x030405);
      scene.fog = new T.Fog(0x030405, 7, 26);
      const P = (c, o) => new T.MeshPhongMaterial(Object.assign({ color: c, shininess: 6 }, o || {}));
      const m = {
        wall: P(0x141618), ceil: P(0x0c0d0e), hall: P(0x2a2b2e, { shininess: 18 }), stage: P(0x1b1b1d, { shininess: 20 }),
        red: P(0x8e1d21), tile: P(0x37393d), white: P(0xd6d6cf), wood: P(0x5d4733), metal: P(0x8a8d93, { shininess: 60 }),
        black: P(0x0f0f10), grille: P(0x2c2d30), door: P(0x2b3036), shell: P(0x7a1717, { shininess: 50 }), gold: P(0xb8963a, { shininess: 80 }),
        green: P(0x1f5a32),
      };
      const add = o => { scene.add(o); return o; };
      const box = (w, h, d, mat, x, y, z) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); return add(o); };
      const cyl = (rt, rb, h, mat, x, y, z, seg) => { const o = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 20), mat); o.position.set(x, y, z); return add(o); };
      const wall = (x1, z1, x2, z2, y0, y1, mat) => {
        y0 = y0 || 0; y1 = y1 || 2.4;
        const o = box(Math.hypot(x2 - x1, z2 - z1) + 0.12, y1 - y0, 0.12, mat || m.wall, (x1 + x2) / 2, (y0 + y1) / 2, (z1 + z2) / 2);
        o.rotation.y = -Math.atan2(z2 - z1, x2 - x1); return o;
      };
      const plane = (x1, z1, x2, z2, y, mat, up) => {
        const o = new T.Mesh(new T.PlaneGeometry(x2 - x1, z2 - z1), mat);
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
      const scaleMat = P(0xffffff, { map: scale });
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
        facePlane(0.82, 0.48, new T.MeshBasicMaterial({ map: tex, color: 0xb8b8b8 }), x, y, z, ry);
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
      for (let i = 0; i < 16; i++) cyl(0.04, 0.045, 0.26, P(bottleCols[i % 6], { shininess: 90, emissive: bottleCols[i % 6], emissiveIntensity: 0.15 }), 8.75 + i * 0.21, i < 8 ? 1.6 : 1.95, 9.0);

      // 楽屋(白い壁、鏡、カウンター、丸椅子)
      plane(6.8, 0, 8.46, 5.12, 0.004, m.tile);
      facePlane(1.6, 0.7, new T.MeshBasicMaterial({ color: 0x8e989c }), 8.39, 1.45, 2.6, -Math.PI / 2);
      box(0.45, 0.05, 2.4, m.white, 8.2, 0.8, 2.6);
      [1.9, 2.6, 3.3].forEach(z => { cyl(0.17, 0.17, 0.06, m.black, 7.7, 0.48, z); cyl(0.02, 0.02, 0.45, m.metal, 7.7, 0.23, z, 8); });

      // ステージ
      box(6.8, 0.35, 3.7, m.stage, 3.4, 0.175, 1.85);
      box(6.8, 0.04, 0.04, m.metal, 3.4, 0.33, 3.7);
      // 柵(ステージ前、高さ約1m)
      for (let i = 0; i < 6; i++) box(0.05, 0.92, 0.05, m.metal, 0.5 + i * 1.16, 0.46, 4.0);
      box(5.9, 0.05, 0.05, m.metal, 3.4, 0.9, 4.0); box(5.9, 0.04, 0.04, m.metal, 3.4, 0.5, 4.0);
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
      const head = new T.Mesh(new T.CircleGeometry(0.265, 24), P(0xe8e4d8)); head.position.set(3.4, 0.63, 1.462); add(head);
      cyl(0.18, 0.18, 0.14, m.shell, 2.95, 1.0, 1.55); cyl(0.14, 0.14, 0.2, m.shell, 3.22, 1.12, 1.05); cyl(0.15, 0.15, 0.2, m.shell, 3.6, 1.12, 1.05);
      cyl(0.2, 0.2, 0.42, m.shell, 3.95, 0.75, 1.55);
      [[2.7, 1.25, 1.45, 0.18], [3.0, 1.62, 0.85, 0.22], [3.95, 1.45, 0.95, 0.25]].forEach(([x, y, z, r]) => { cyl(r, r, 0.01, m.gold, x, y, z); cyl(0.012, 0.012, y - 0.35, m.metal, x, 0.35 + (y - 0.35) / 2, z, 8); });
      cyl(0.17, 0.17, 0.08, m.black, 3.4, 0.82, 0.7);
      // マイクスタンド
      [2.2, 3.4, 4.6].forEach(x => { cyl(0.012, 0.012, 1.45, m.metal, x, 0.35 + 0.72, 2.95, 8); cyl(0.13, 0.13, 0.02, m.black, x, 0.36, 2.95); const mic = cyl(0.022, 0.016, 0.16, m.black, x, 1.82, 3.02, 10); mic.rotation.x = 0.9; });
      // PA卓(ホールの最後列)
      box(2.6, 1.1, 0.08, m.wall, 3.4, 0.55, 7.5); box(0.08, 1.1, 1.6, m.wall, 2.1, 0.55, 8.3); box(0.08, 1.1, 1.6, m.wall, 4.7, 0.55, 8.3);
      box(2.4, 0.06, 0.6, m.black, 3.4, 0.95, 7.85); box(1.6, 0.08, 0.5, m.grille, 3.4, 1.01, 7.85);
      facePlane(0.45, 0.3, new T.MeshBasicMaterial({ color: 0x3d6f8f }), 3.4, 1.2, 8.15, 0);
      // 天井の配管と空調
      [1.2, 5.6].forEach(x => { const d = cyl(0.12, 0.12, 5.2, m.metal, x, 2.22, 6.3, 12); d.rotation.x = Math.PI / 2; });
      box(0.9, 0.22, 0.9, m.grille, 3.4, 2.29, 6.0);
      // 防音扉(開いた状態)
      box(0.9, 2.0, 0.06, m.door, 7.25, 1.0, 6.6);

      // 照明:トラスと灯体、光の筋(当時の写真の赤・青・白・アンバー)
      box(6.6, 0.08, 0.08, m.black, 3.4, 2.3, 0.6); box(6.6, 0.08, 0.08, m.black, 3.4, 2.3, 3.3);
      const beams = [];
      const COLS = [0xff2b3a, 0x2f5bff, 0xfff1d6, 0xffa23a, 0xd23cff, 0x38c8c8];
      const fixture = (x, z, col, tilt, ph) => {
        cyl(0.09, 0.09, 0.2, m.black, x, 2.17, z, 12);
        const lens = new T.Mesh(new T.CircleGeometry(0.07, 16), new T.MeshBasicMaterial({ color: col })); lens.rotation.x = Math.PI / 2; lens.position.set(x, 2.065, z); add(lens);
        const g = new T.CylinderGeometry(0.04, 0.42, 2.0, 18, 1, true); g.translate(0, -1, 0);
        const mat = new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.06, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
        const b = new T.Mesh(g, mat); b.position.set(x, 2.06, z); b.rotation.x = tilt; add(b);
        beams.push({ b, mat, ph, base: tilt });
      };
      const FRONT = [0xff2b3a, 0x2f5bff, 0xff2b3a, 0xfff1d6, 0xffa23a, 0xfff1d6, 0xfff1d6, 0xffa23a, 0xfff1d6, 0xff2b3a, 0x2f5bff, 0xff2b3a];
      FRONT.forEach((c, i) => {
        const x = 0.55 + i * 0.52;
        if (i % 2 === 0) fixture(x, 3.3, c, 0.5, i * 1.1);
        else { cyl(0.09, 0.09, 0.2, m.black, x, 2.17, 3.3, 12); const ln = new T.Mesh(new T.CircleGeometry(0.07, 16), new T.MeshBasicMaterial({ color: c })); ln.rotation.x = Math.PI / 2; ln.position.set(x, 2.065, 3.3); add(ln); }
      });
      [1.4, 2.8, 4.0, 5.4].forEach((x, i) => fixture(x, 0.6, COLS[(i + 2) % COLS.length], -0.45, i * 0.9 + 0.5));
      const pool = (x, z, y, col, r) => { const o = new T.Mesh(new T.CircleGeometry(r, 24), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false })); o.rotation.x = -Math.PI / 2; o.position.set(x, y, z); return add(o); };
      [[1.3, 2.3, 0xff2b3a], [3.4, 2.0, 0xfff1d6], [5.4, 2.3, 0x2f5bff], [2.4, 1.2, 0xffa23a], [4.5, 1.2, 0xd23cff]].forEach(([x, z, c]) => pool(x, z, 0.352, c, 0.75));
      [[1.8, 5.0, 0xff2b3a], [4.8, 5.2, 0x2f5bff]].forEach(([x, z, c]) => pool(x, z, 0.005, c, 0.9));

      // 客席の人影(当たり判定なし。順路の立ち位置は避けて並べる)
      const crowdMat = P(0x1d2024, { shininess: 2 });
      [[1.0, 4.6], [1.8, 4.5], [2.6, 4.7], [4.3, 4.6], [5.0, 4.5], [5.8, 4.7], [0.9, 5.4], [1.7, 5.6], [2.5, 5.3], [3.3, 5.6],
       [4.2, 5.4], [5.1, 5.7], [5.9, 5.5], [1.2, 6.4], [2.2, 6.6], [3.6, 6.4], [4.6, 6.7], [1.6, 7.6], [0.8, 8.2]].forEach(([x, z], i) => {
        const h = 1.55 + ((i * 37) % 9) / 40;
        cyl(0.17, 0.2, h - 0.25, crowdMat, x, (h - 0.25) / 2, z, 10);
        const hd = new T.Mesh(new T.SphereGeometry(0.11, 12, 10), crowdMat); hd.position.set(x, h - 0.12, z); add(hd);
      });

      // 光源
      add(new T.AmbientLight(0xffffff, 0.27));
      const lights = [];
      [[1.4, 2.0, 1.6, 0xff3344, 1.3], [5.4, 2.0, 1.6, 0x3355ff, 1.3], [3.4, 2.0, 2.9, 0xffe6c4, 1.0]].forEach(([x, y, z, c, i]) => { const l = new T.PointLight(c, i, 6.5); l.position.set(x, y, z); add(l); lights.push({ l, i }); });
      [[3.4, 2.2, 7.0, 0x6070ff, 0.45, 6], [9.6, 2.2, 2.4, 0xffe2c0, 0.85, 6], [9.0, 2.2, 6.4, 0xffe2c0, 0.75, 6], [12.2, 2.2, 1.9, 0xffe8d0, 0.8, 5],
       [10.4, 2.2, 8.4, 0xffd9a8, 0.7, 4], [7.6, 2.2, 2.6, 0xffffff, 0.9, 5], [15.5, 4.3, 6.6, 0xfff0dd, 0.9, 7], [13.0, 3.6, 3.6, 0xfff0dd, 0.6, 5]].forEach(([x, y, z, c, i, d]) => { const l = new T.PointLight(c, i, d); l.position.set(x, y, z); add(l); });
      return { scene, beams, lights };
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
          <button type="button" class="v3d-btn" data-s aria-expanded="false">行き先</button>
        </div>
        <div class="v3d-stops" hidden>${STOPS.map((p, i) => `<button type="button" data-i="${i}"><b>${i + 1}</b>${p.name}</button>`).join("")}</div>
        <div class="joy" hidden><i></i></div>
        <div class="v3d-hint">${coarse() ? "左側をなぞって歩く・右側をドラッグして見回す" : "W A S D / 矢印キーで歩く・ドラッグで見回す・「行き先」でワープ"}</div>
        <div class="v3d-rot" hidden><div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7" width="19" height="10" rx="2"/><path d="M7 3.5a8 8 0 0 1 10 0M17 20.5a8 8 0 0 1-10 0"/></svg>スマホを横向きにすると、中を歩けます</div></div>
        <div class="v3d-load"><div>SiX-DOGへ向かっています…</div></div>
        <div class="v3d-fade"></div>`;
      document.body.appendChild(root);
      document.documentElement.style.overflow = "hidden";
      const $ = s => root.querySelector(s);
      S = { root, alive: true };
      // 3Dの読み込みは先に始めておく。全画面・横向き固定は、返事が来ない端末があるので待ちすぎない
      const threeReady = loadThree();
      threeReady.catch(() => {});
      const settle = (fn, ms) => { let p; try { p = fn(); } catch (e) { p = null; } return Promise.race([Promise.resolve(p).catch(() => {}), new Promise(r => setTimeout(r, ms))]); };
      if (coarse()) {
        await settle(() => root.requestFullscreen(), 1500);
        await settle(() => screen.orientation.lock("landscape"), 1500);
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
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse() ? 1.25 : 1.75));
      const camera = new T.PerspectiveCamera(72, 1, 0.05, 60);
      camera.rotation.order = "YXZ";
      const world = build(T);
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
        renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
        st.paused = coarse() && h > w;
        $(".v3d-rot").hidden = !st.paused;
      }
      const hint = $(".v3d-hint");
      const hideHint = () => hint.classList.add("off");
      setTimeout(hideHint, 6000);

      const joy = $(".joy"), knob = joy.querySelector("i");
      canvas.addEventListener("pointerdown", e => {
        hideHint(); canvas.setPointerCapture(e.pointerId);
        if (e.pointerType !== "mouse" && e.clientX < root.clientWidth * 0.45 && !st.joy) {
          st.joy = { id: e.pointerId, x: e.clientX, y: e.clientY };
          joy.hidden = false; joy.style.left = e.clientX + "px"; joy.style.top = e.clientY + "px"; knob.style.transform = "";
        } else if (!st.look) st.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
      });
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
        if (st.joy && e.pointerId === st.joy.id) { st.joy = null; st.mx = st.my = 0; joy.hidden = true; }
        if (st.look && e.pointerId === st.look.id) st.look = null;
      };
      canvas.addEventListener("pointerup", release); canvas.addEventListener("pointercancel", release);
      const kd = e => { if (e.key === "Escape") { exit(); return; } st.keys.add(e.code); if (/^(Arrow|Key[WASD])/.test(e.code)) { e.preventDefault(); hideHint(); } };
      const ku = e => st.keys.delete(e.code);
      window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
      window.addEventListener("resize", resize);
      $("[data-x]").addEventListener("click", exit);
      const stopsEl = $(".v3d-stops"), stopsBtn = $("[data-s]");
      stopsBtn.addEventListener("click", () => { stopsEl.hidden = !stopsEl.hidden; stopsBtn.setAttribute("aria-expanded", String(!stopsEl.hidden)); });
      stopsEl.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (!b) return; stopsEl.hidden = true; stopsBtn.setAttribute("aria-expanded", "false"); goTo(+b.dataset.i); });

      function frame(t) {
        if (!S || !S.alive) return;
        const dt = Math.min(0.05, (t - st.last) / 1000); st.last = t;
        if (!st.paused) {
          const k = st.keys;
          let fw = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) + st.my;
          let sd = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0) + st.mx;
          st.yaw += ((k.has("ArrowLeft") ? 1 : 0) - (k.has("ArrowRight") ? 1 : 0)) * 1.9 * dt;
          const mag = Math.hypot(fw, sd); if (mag > 1) { fw /= mag; sd /= mag; }
          const sp = 1.8 * (k.has("ShiftLeft") || k.has("ShiftRight") ? 1.8 : 1) * dt;
          const fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw), rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw);
          const nx = st.px + (fx * fw + rx * sd) * sp, nz = st.pz + (fz * fw + rz * sd) * sp;
          if (walkAt(nx, nz)) { st.px = nx; st.pz = nz; } else if (walkAt(nx, st.pz)) st.px = nx; else if (walkAt(st.px, nz)) st.pz = nz;
          const r = walkAt(st.px, st.pz);
          if (r) { const stop = STOPS.find(p => p.name === r[0]); setPlace(r[0], stop ? stop.note : ""); }
          st.eye += (floorAt(st.px, st.pz, r) + 1.6 - st.eye) * Math.min(1, dt * 10);
        }
        camera.position.set(st.px, st.eye, st.pz);
        camera.rotation.set(st.pitch, st.yaw, 0);
        const s = t / 1000;
        world.beams.forEach(o => { o.mat.opacity = 0.035 + 0.035 * (0.5 + 0.5 * Math.sin(s * 1.3 + o.ph)); o.b.rotation.x = o.base + Math.sin(s * 0.5 + o.ph) * 0.08; });
        world.lights.forEach((o, i) => { o.l.intensity = o.i * (0.75 + 0.25 * Math.sin(s * 1.1 + i * 2)); });
        renderer.render(world.scene, camera);
        S.raf = requestAnimationFrame(frame);
      }
      function exit() {
        if (!S) return;
        S.alive = false; cancelAnimationFrame(S.raf);
        window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("resize", resize);
        try { renderer.dispose(); } catch (e) { /* 何もしない */ }
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
