/*
 * 公演詳細をX/LINEで簡単共有するためのボタン。バックエンド不要。
 *
 * Xへの「投稿文を自動で入れて開く」は、以下すべてを実機検証した結果
 * X側アプリ/Webの不具合で本文が反映されないことを確認済み(2026-07時点):
 *   1. x.com/intent/tweet(旧twitter.com): text/urlを渡してもホーム
 *      タイムラインが表示されるだけで投稿欄には何も反映されない
 *   2. twitter://post?message= カスタムスキーム: 投稿画面は開くが空
 *   3. Web Share API(navigator.share)でtext/urlを別々に渡す: 投稿欄が空
 *   4. Web Share APIでtextに1つにまとめて渡す: それでも投稿欄が空
 * どれもXアプリ/Web側の共有受信処理が原因で、こちら側のコードでは
 * これ以上直しようがないと判断した。
 *
 * そのため「自動で入れる」のは諦め、確実性を最優先する方針にする:
 * クリップボードへの自動コピーを最初に行ってから(Xの投稿欄が空でも
 * そのまま貼り付けできるように)Xを開き、さらに保険として投稿文を
 * その場に見せて選択状態にしておく共有パネルも必ず表示する
 * (自動コピーがブラウザの権限で失敗しても、パネルの中身を選択して
 * 手動コピーすれば確実に同じ内容を使える)。
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
      // 1. まずクリップボードにコピー(Xの投稿欄が結局空でも、そのまま
      //    貼り付けられるようにするための保険。これを一番先にやる)
      try { await navigator.clipboard.writeText(combined); } catch (e) {}

      // 2. Xを開く(対応環境ではOS共有シート経由、それ以外は直接投稿画面へ)
      if (navigator.share) {
        try {
          await navigator.share({ text: combined });
        } catch (e) {
          if (!e || e.name !== "AbortError") {
            window.open("https://x.com/compose/post", "_blank", "noopener,noreferrer");
          }
        }
      } else {
        window.open("https://x.com/compose/post", "_blank", "noopener,noreferrer");
      }

      // 3. 自動で入らなかった場合の保険として、常にパネルも表示する
      panel.classList.remove("hidden");
      const ta = panel.querySelector(".share-x-text");
      ta.focus();
      ta.select();
    });

    return wrap;
  }

  global.SixDogShare = { buildShareButtons, buildShareUrl, buildShareText };
})(window);
