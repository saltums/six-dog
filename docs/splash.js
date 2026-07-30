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

  // 入口写真(entrance-memory.jpg)の実サイズ。object-fit:contain で全体を
  // 欠けずに表示した状態から、レターボックスの余白が画面外に出るまで
  // 中央にズームインさせるための倍率をビューポート実寸から逆算する。
  const PHOTO_W = 640;
  const PHOTO_H = 480;
  function computeZoomScale() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const imgAspect = PHOTO_W / PHOTO_H;
    const boxAspect = vw / vh;
    const dispW = imgAspect > boxAspect ? vw : vh * imgAspect;
    const dispH = imgAspect > boxAspect ? vw / imgAspect : vh;
    const needed = Math.max(vw / dispW, vh / dispH);
    return Math.max(needed * 1.06, 1.15);
  }

  let showClass;
  let holdMs;
  if (isFirstOpen) {
    img.src = "img/entrance-memory.jpg";
    img.classList.remove("splash-logo");
    img.classList.add("splash-photo");
    img.style.setProperty("--splash-zoom", computeZoomScale());
    showClass = "splash-photo-show";
    holdMs = 2900;
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
