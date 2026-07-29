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

  // twitter://post?message= のカスタムスキームは、Xアプリが開いても
  // メッセージ本文(タイトル＋URL)を反映しない場合があり(リブランド後の挙動不明・未検証)、
  // 「書き込み画面は出るが中身が空」という劣化を招いたため撤回。
  // x.com/intent/tweet は本文が確実に入るうえ、Xアプリが入っている端末では
  // OS側のユニバーサルリンク機能でアプリの投稿画面が開くことも多い。
  // 中身が確実に入ることを優先し、通常のリンクに戻す。
  function buildXShareHref(text, url) {
    return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  }

  function buildShareButtons(ev) {
    const wrap = document.createElement("div");
    wrap.className = "share-wrap";
    const url = buildShareUrl(ev.event_date);
    const text = buildShareText(ev);
    const xHref = buildXShareHref(text, url);
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
