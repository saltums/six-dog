/*
 * 公演詳細をX/LINEで簡単共有するためのボタン。バックエンド不要、URLを組み立てて新規タブで開くだけ。
 */
(function (global) {
  "use strict";

  const SITE_BASE = "https://saltums.github.io/six-dog/";

  function buildShareText(ev) {
    const title = ev.title || (ev.performers && ev.performers.length ? ev.performers.join("×") : "");
    const label = title ? `「${title}」` : "";
    return `SiX-DOG ARCHIVE — ${ev.event_date}${label}の公演記録`;
  }

  function buildShareUrl(eventDate) {
    return `${SITE_BASE}index.html?date=${encodeURIComponent(eventDate)}`;
  }

  // x.com/intent/tweet (旧twitter.com/intent/tweet) は現在Xアプリ側で
  // 本文が反映されず、確認したところWeb版でも読み込み中のまま固まって
  // 何も表示されない状態になっていた(2026-07時点、X側の仕様変更由来と見られ、
  // こちら側の実装では制御不能)。本文が確実に手元に届くことを優先し、
  // 「投稿文をクリップボードにコピー→Xの投稿画面を開く→貼り付けてもらう」
  // 方式に切り替える。
  async function shareToX(text, url, btn) {
    const combined = `${text}\n${url}`;
    let copied = false;
    try {
      await navigator.clipboard.writeText(combined);
      copied = true;
    } catch (e) {
      // クリップボードAPIが使えない環境ではコピーだけ諦め、Xを開く動作は継続する
    }
    window.open("https://x.com/compose/post", "_blank", "noopener,noreferrer");
    if (!btn) return;
    const original = btn.textContent;
    btn.textContent = copied ? "コピーしました✓貼り付けてください" : "𝕏を開きました(手動でコピペしてください)";
    btn.classList.toggle("copied", copied);
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("copied");
    }, 3000);
  }

  function buildShareButtons(ev) {
    const wrap = document.createElement("div");
    wrap.className = "share-wrap";
    const url = buildShareUrl(ev.event_date);
    const text = buildShareText(ev);
    const lineHref = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    wrap.innerHTML = `
      <span class="share-label">この公演をシェア</span>
      <button type="button" class="share-btn share-x">𝕏で共有</button>
      <a class="share-btn share-line" href="${lineHref}" target="_blank" rel="noopener noreferrer">LINEで共有</a>
    `;
    const xBtn = wrap.querySelector(".share-x");
    xBtn.addEventListener("click", () => shareToX(text, url, xBtn));
    return wrap;
  }

  global.SixDogShare = { buildShareButtons, buildShareUrl, buildShareText };
})(window);
