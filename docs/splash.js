(() => {
  "use strict";
  const splash = document.getElementById("splash");
  if (!splash) return;
  const logo = splash.querySelector(".splash-logo");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => logo.classList.add("splash-logo-show"));
  });
  window.addEventListener("load", () => {
    setTimeout(() => {
      splash.classList.add("splash-hide");
      setTimeout(() => splash.remove(), 750);
    }, 500);
  });
})();
