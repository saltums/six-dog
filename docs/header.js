/*
 * 追従ヘッダーの薄型化。
 *
 * ヘッダー全体(大きなロゴ+説明文+メニュー行)を追従させると、スマホでは画面の
 * 約2割を常に占めてしまう。そこで position: sticky の top を負の値にして、
 * スクロールするとロゴと説明文は画面外へ流れ、メニュー行だけが上端に残るようにする。
 * 高さを途中で変えないので、切り替わる瞬間に本文がガクッと動くことがない。
 *
 * 流してよい高さ(メニュー行の上端までの距離)はページやテーマ・画面幅で変わるため、
 * ここで実測して CSS 変数 --topbar-collapse に渡す。
 */
(function (global) {
  "use strict";

  const bar = document.querySelector(".topbar");
  const nav = bar && bar.querySelector(".nav-tabs");
  if (!bar || !nav) return;

  let collapse = 0;

  function onScroll() {
    // メニュー行だけになったら小さいロゴを出す(CSS側で .is-stuck を見る)
    bar.classList.toggle("is-stuck", collapse > 0 && global.scrollY >= collapse);
  }

  function measure() {
    // 旧サイト風はメニューバーを上端にぴったり付ける。通常表示は少し余白を残す
    const gap = 8;
    const next = Math.max(0, Math.round(nav.getBoundingClientRect().top - bar.getBoundingClientRect().top - gap));
    if (next !== collapse) {
      collapse = next;
      bar.style.setProperty("--topbar-collapse", collapse + "px");
    }
    onScroll();
  }

  global.addEventListener("scroll", onScroll, { passive: true });
  global.addEventListener("load", measure);
  if (global.ResizeObserver) new ResizeObserver(measure).observe(bar);
  else global.addEventListener("resize", measure);
  measure();

  global.SixDogHeader = {
    // ヘッダーがメニュー行だけになるスクロール位置(画面を切り替えたときの戻り先に使う)
    collapseOffset() { return collapse; },
  };
})(window);
