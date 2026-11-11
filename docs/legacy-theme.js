/*
 * 「旧サイト風」表示の切り替え。
 *
 * データや機能はそのままで、見た目だけを2008年頃の旧公式サイト(/pc/ 版)風にする。
 * 配色・メニューボタンの色・背景の格子柄・ロゴは、Wayback Machine に保存されていた
 * 当時の素材(data/raw-images/ の bg.gif / sixdog152_48.jpg / メニューボタンgif)から
 * 実測した値をそのまま使っている。
 *
 * <head> で同期読み込みして <html> に属性を付けることで、ページ表示後に
 * デザインが切り替わるチラつきを防いでいる。選択は閲覧者ごとに localStorage に保存する
 * (保存できない環境でも ?theme=2008 で一時的に切り替えられる)。
 */
(function () {
  "use strict";

  const KEY = "sixdog_site_theme";
  const LEGACY = "2008";
  const root = document.documentElement;

  function readSaved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function save(value) {
    try {
      if (value) localStorage.setItem(KEY, value); else localStorage.removeItem(KEY);
    } catch (e) { /* 保存できなくても表示の切り替え自体は行う */ }
  }

  const param = new URLSearchParams(location.search).get("theme");
  let current = param === LEGACY ? LEGACY : (param === "modern" ? null : readSaved());
  if (current === LEGACY) root.setAttribute("data-site-theme", LEGACY);

  function apply(value) {
    current = value;
    if (value === LEGACY) root.setAttribute("data-site-theme", LEGACY);
    else root.removeAttribute("data-site-theme");
    save(value);
    updateButtons();
  }

  function updateButtons() {
    document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
      const legacy = current === LEGACY;
      // 旧サイト風のときは当時のメニュー表記(小文字の英単語)に合わせる
      btn.textContent = legacy ? "now" : "旧サイト風";
      btn.title = legacy ? "現在のデザインに戻す" : "2008年頃の旧公式サイト風の見た目にする";
      btn.setAttribute("aria-label", btn.title);
      btn.setAttribute("aria-pressed", legacy ? "true" : "false");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
      btn.addEventListener("click", () => apply(current === LEGACY ? null : LEGACY));
    });
    updateButtons();
  });
})();
