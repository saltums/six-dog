(() => {
  "use strict";
  const splash = document.getElementById("splash");
  if (!splash) return;
  const logo = splash.querySelector(".splash-logo");
  const photo = splash.querySelector(".splash-photo");
  const target = logo || photo;
  const showClass = logo ? "splash-logo-show" : "splash-photo-show";
  // 写真版(トップページの入口)はモノクロ→カラーの変化を見せたいので、
  // ロゴ版より少し長く画面にとどめてから消す
  const holdMs = photo ? 1900 : 500;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => target.classList.add(showClass));
  });
  window.addEventListener("load", () => {
    setTimeout(() => {
      splash.classList.add("splash-hide");
      setTimeout(() => splash.remove(), 750);
    }, holdMs);
  });
})();
