(() => {
  "use strict";
  const splash = document.getElementById("splash");
  if (!splash) return;
  const img = splash.querySelector(".splash-logo, .splash-photo");
  if (!img) return;

  // このタブでまだ何も開いていない(=セッション最初の1ページ目)場合だけ、
  // 入口写真のモノクロ→カラー演出にする。サイト内の移動(2ページ目以降)は
  // 従来どおり丸いロゴのフェードのまま。どのページが最初に開かれても
  // 判定できるよう、特定のページ(index.html)ではなくセッション単位で判定する。
  const SESSION_KEY = "sixdog_intro_seen";
  let isFirstOpen = false;
  try { isFirstOpen = !sessionStorage.getItem(SESSION_KEY); } catch (e) {}

  let showClass;
  let holdMs;
  if (isFirstOpen) {
    img.src = "img/entrance-memory.jpg";
    img.classList.remove("splash-logo");
    img.classList.add("splash-photo");
    showClass = "splash-photo-show";
    holdMs = 2500;
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (e) {}
  } else {
    showClass = "splash-logo-show";
    holdMs = 500;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => img.classList.add(showClass));
  });
  window.addEventListener("load", () => {
    setTimeout(() => {
      splash.classList.add("splash-hide");
      setTimeout(() => splash.remove(), 750);
    }, holdMs);
  });
})();
