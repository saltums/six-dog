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

  // Xアプリが入っている端末では twitter:// スキームでアプリを直接開き、
  // 一定時間たっても画面が切り替わらなければ(=アプリが無い)ブラウザ版にフォールバックする。
  function openXShare(text, url) {
    const appUrl = `twitter://post?message=${encodeURIComponent(text + " " + url)}`;
    const webUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    let switched = false;
    const onHide = () => { switched = true; };
    document.addEventListener("visibilitychange", onHide);
    window.location.href = appUrl;
    setTimeout(() => {
      document.removeEventListener("visibilitychange", onHide);
      if (!switched) window.open(webUrl, "_blank", "noopener,noreferrer");
    }, 800);
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
    wrap.querySelector(".share-x").addEventListener("click", () => openXShare(text, url));
    return wrap;
  }

  global.SixDogShare = { buildShareButtons, buildShareUrl, buildShareText };
})(window);
