/*
 * 公演詳細をX/LINEで簡単共有するためのボタン。バックエンド不要、URLを組み立てて新規タブで開くだけ。
 *
 * Xの「投稿文を事前に埋め込んで開く」機能(Web Intents, x.com/intent/tweet)は
 * 2026-07時点で動作確認したところX側で機能しておらず(text/urlパラメータを
 * 渡してもホームタイムラインが表示されるだけで投稿欄には何も反映されない、
 * twitter.com/intent/tweet 経由でも同様)、こちら側では直せない。
 * そのため投稿文を確実に手元に届ける手段として、コピー用のテキストを
 * その場で見せて選択状態にしておく共有パネル方式にしている
 * (ボタンを押した瞬間に裏でクリップボードコピー+X起動も試みるが、
 * それが失敗してもパネルの中身を選択してコピーすれば必ず同じ内容が使える)。
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

  function buildXPanel(combined) {
    const panel = document.createElement("div");
    panel.className = "share-x-panel hidden";
    panel.innerHTML = `
      <p class="share-x-hint">Xの投稿画面が開きます。この内容を貼り付けてください:</p>
      <textarea class="share-x-text" readonly rows="2"></textarea>
      <button type="button" class="share-x-copy">この内容をコピー</button>
    `;
    panel.querySelector(".share-x-text").value = combined;

    const copyBtn = panel.querySelector(".share-x-copy");
    copyBtn.addEventListener("click", async () => {
      const ta = panel.querySelector(".share-x-text");
      ta.focus();
      ta.select();
      try {
        await navigator.clipboard.writeText(combined);
        copyBtn.textContent = "コピーしました✓";
        copyBtn.classList.add("copied");
      } catch (e) {
        // クリップボードAPIが使えない環境でもtextareaは選択済みなので
        // Ctrl/Cmd+C で手動コピーできる
        copyBtn.textContent = "選択したので Ctrl+C でコピー";
      }
      setTimeout(() => {
        copyBtn.textContent = "この内容をコピー";
        copyBtn.classList.remove("copied");
      }, 2500);
    });

    return panel;
  }

  function buildShareButtons(ev) {
    const wrap = document.createElement("div");
    wrap.className = "share-wrap";
    const url = buildShareUrl(ev.event_date);
    const text = buildShareText(ev);
    const combined = `${text}\n${url}`;
    const lineHref = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    wrap.innerHTML = `
      <div class="share-row">
        <span class="share-label">この公演をシェア</span>
        <button type="button" class="share-btn share-x">𝕏で共有</button>
        <a class="share-btn share-line" href="${lineHref}" target="_blank" rel="noopener noreferrer">LINEで共有</a>
      </div>
    `;

    const panel = buildXPanel(combined);
    wrap.appendChild(panel);

    wrap.querySelector(".share-x").addEventListener("click", async () => {
      // ダメ元でクリップボードへの自動コピーとX起動を試みる(成功すれば貼り付けるだけで済む)
      try { await navigator.clipboard.writeText(combined); } catch (e) {}
      window.open("https://x.com/compose/post", "_blank", "noopener,noreferrer");
      panel.classList.remove("hidden");
      const ta = panel.querySelector(".share-x-text");
      ta.focus();
      ta.select();
    });

    return wrap;
  }

  global.SixDogShare = { buildShareButtons, buildShareUrl, buildShareText };
})(window);
