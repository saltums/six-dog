/*
 * 公演詳細をX/LINEで簡単共有するためのボタン。バックエンド不要。
 *
 * Xの「投稿文を事前に埋め込んで開く」機能(Web Intents, x.com/intent/tweet)は
 * 2026-07時点で動作確認したところX側で機能しておらず(text/urlパラメータを
 * 渡してもホームタイムラインが表示されるだけで投稿欄には何も反映されない、
 * twitter.com/intent/tweet 経由でも同様)、こちら側では直せない。
 * twitter://post?message= のカスタムスキームも、Xアプリの投稿画面は開くが
 * 本文が反映されない(こちらもX側アプリの仕様/不具合)。
 *
 * そのため以下の優先順で本文を確実に届ける:
 * 1. Web Share API (navigator.share): 対応端末(主にスマホ)では、OSの共有
 *    シート経由でXアプリの「共有」拡張機能に本文を渡す。これはx.com側の
 *    不具合とは無関係な別経路(OS標準の共有インテント)なので、本文が
 *    正しく入った状態でXの投稿画面が開く。
 * 2. 上記が使えない環境(主にPCブラウザ)向けのフォールバック: 投稿文を
 *    その場に見せて選択状態にしておく共有パネル。ボタンを押した瞬間に
 *    裏でクリップボードコピー+X起動も試みるが、失敗してもパネルの中身を
 *    選択してコピーすれば確実に同じ内容を使える。
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
      // 端末のOS共有シート(Web Share API)経由でXアプリに渡せる場合、
      // アプリ側の共有拡張機能を使うのでx.com/intent/tweetの不具合を回避でき、
      // 本文が確実に入った状態でXの投稿画面が開く。対応環境ではこちらを優先する。
      if (navigator.share) {
        try {
          // text/urlを別々に渡すと受け取り側アプリがどちらか片方(主にurl)
          // しか使わないことがあるため、urlをtextに含めて1つにまとめる
          await navigator.share({ text: combined });
          return; // 共有シートが開けた(完了/キャンセルいずれも成功扱い)
        } catch (e) {
          if (e && e.name === "AbortError") return; // ユーザーがキャンセルしただけ
          // それ以外のエラーは下のフォールバックへ
        }
      }
      // Web Share API が無い(主にPCブラウザ)場合のフォールバック:
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
