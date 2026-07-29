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

  function buildShareButtons(ev) {
    const wrap = document.createElement("div");
    wrap.className = "share-wrap";
    const url = buildShareUrl(ev.event_date);
    const text = buildShareText(ev);
    const xHref = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    const lineHref = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    wrap.innerHTML = `
      <span class="share-label">この公演をシェア</span>
      <a class="share-btn share-x" href="${xHref}" target="_blank" rel="noopener noreferrer">𝕏で共有</a>
      <a class="share-btn share-line" href="${lineHref}" target="_blank" rel="noopener noreferrer">LINEで共有</a>
    `;
    return wrap;
  }

  global.SixDogShare = { buildShareButtons, buildShareUrl, buildShareText };
})(window);
