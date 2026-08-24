// ==========================================
// ブログ・GAME・LAB共通ヘッダー
// このファイルを公開HTMLへ注入する唯一の正本とする
// ==========================================

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPDATES_DATA_PATH = resolve(
  __dirname,
  "../../src/static-pages/updates/updates-data.json",
);

function getLatestVersion() {
  try {
    const raw = readFileSync(UPDATES_DATA_PATH, "utf-8");
    const data = JSON.parse(raw);
    if (Array.isArray(data) && data.length > 0) {
      if (
        data[0].sections &&
        data[0].sections[0] &&
        data[0].sections[0].version
      ) {
        return data[0].sections[0].version;
      }
      const match = data[0].title?.match(/v\d+\.\d+(\.\d+)?/);
      if (match) return match[0];
    }
  } catch (e) {
    console.warn("updates-data.json の読み取りに失敗しました:", e);
  }
  return "v0.11.1";
}

const SITE_ORIGIN = "https://antigravity-portal.com";

const NAV_LINKS = [
  { href: `${SITE_ORIGIN}/tools`, emoji: "🛠️", label: "ツール" },
  { href: `${SITE_ORIGIN}/game`, emoji: "🎮", label: "GAME" },
  { href: `${SITE_ORIGIN}/lab`, emoji: "🔬", label: "LAB" },
  { href: `${SITE_ORIGIN}/blog`, emoji: "✏️", label: "ブログ" },
];

const SOCIAL_LINKS = [
  { href: "https://x.com/hahu1124", emoji: "𝕏", label: "X" },
  { href: "https://note.com/hahu1124", emoji: "📝", label: "Note" },
];

function navLinkHtml(link, hideMobile = false) {
  return `<a href="${link.href}" class="header-nav-link${hideMobile ? " hidden-mobile" : ""}" aria-label="${link.label}">
        <span class="nav-emoji">${link.emoji}</span><span class="nav-label">${link.label}</span>
      </a>`;
}

/** ヘッダーHTML・スタイル・UI/テーマ切替スクリプトをまとめて返す */
export function gpHeaderBlock() {
  const latestVersion = getLatestVersion();
  const navHtml = NAV_LINKS.map((link) => navLinkHtml(link)).join("\n        ");
  const socialHtml = SOCIAL_LINKS.map((link) => navLinkHtml(link, true)).join(
    "\n        ",
  );

  return `<!-- gp-canonical-header:start -->
<header class="gp-blog-header" data-gp-canonical-header>
  <div class="header-inner">
    <div class="header-left">
      <a href="${SITE_ORIGIN}/" class="site-logo">
        Gravity Portal
        <span class="site-version-tag">${latestVersion}</span>
      </a>
      <nav class="header-nav" aria-label="主要ナビゲーション">
        ${navHtml}
        ${socialHtml}
      </nav>
    </div>
    <div class="auth-area">
      <div class="gp-bh-ui" id="gpBhUiDropdown">
        <button type="button" class="gp-bh-ui-trigger" id="gpBhUiTrigger" aria-haspopup="menu" aria-expanded="false" aria-controls="gpBhUiMenu">
          <span id="gpBhUiIcon">🎲</span>
          <span class="gp-bh-ui-label" id="gpBhUiLabel">UI: Auto</span>
          <span class="gp-bh-caret" aria-hidden="true">▼</span>
        </button>
        <div class="gp-bh-ui-menu" id="gpBhUiMenu" role="menu" hidden>
          <div class="gp-bh-ui-heading">UI DESIGN THEME</div>
          <button type="button" class="gp-bh-ui-option" data-gp-ui="auto" role="menuitemradio" aria-checked="false">
            <span class="gp-bh-ui-option-icon">🎲</span><span><strong>Auto</strong><small>アクセス時に自動で選出</small></span><span class="gp-bh-check">✓</span>
          </button>
          <button type="button" class="gp-bh-ui-option" data-gp-ui="classic" role="menuitemradio" aria-checked="false">
            <span class="gp-bh-ui-option-icon">🏛️</span><span><strong>Classic</strong><small>動画・画像の背景</small></span><span class="gp-bh-check">✓</span>
          </button>
          <button type="button" class="gp-bh-ui-option" data-gp-ui="space" role="menuitemradio" aria-checked="false">
            <span class="gp-bh-ui-option-icon">🚀</span><span><strong>Space</strong><small>星と粒子の背景</small></span><span class="gp-bh-check">✓</span>
          </button>
        </div>
      </div>
      <button type="button" class="theme-toggle" id="gpBhThemeToggle" aria-label="テーマ切替">🌙</button>
    </div>
  </div>
</header>
<style id="gpCanonicalHeaderStyles">
.gp-blog-header{position:sticky;top:0;z-index:1000;background:rgba(12,13,20,.65);border-bottom:1px solid rgba(180,190,220,.1);box-shadow:0 6px 24px rgba(0,0,0,.16);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
[data-theme="light"] .gp-blog-header{background:rgba(255,255,255,.85);border-bottom-color:rgba(0,0,0,.1)}
.header-inner{max-width:1400px;margin:0 auto;padding:0 1.5rem;height:64px;display:flex;align-items:center;justify-content:space-between;gap:1rem}
.header-left{display:flex;align-items:center;gap:1.25rem;min-width:0}
.site-logo{display:inline-flex;align-items:baseline;gap:.35rem;font-size:1.25rem;font-weight:700;background:linear-gradient(135deg,#c8cde6 0%,#7c7ff2 40%,#a78bfa 60%,#d0d4f0 100%);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-decoration:none;white-space:nowrap;animation:shimmer 6s linear infinite;flex-shrink:0}
@keyframes shimmer{0%{background-position:0% center}100%{background-position:200% center}}
.site-version-tag{font-size:.7rem;font-weight:700;padding:.12rem .42rem;border-radius:5px;background:rgba(124,127,242,.18);border:1px solid rgba(124,127,242,.4);color:#a78bfa;-webkit-text-fill-color:#a78bfa;letter-spacing:.04em;vertical-align:middle;line-height:1}
.header-nav{display:flex;align-items:center;gap:.25rem;overflow-x:auto;scrollbar-width:none}
.header-nav::-webkit-scrollbar{display:none}
.header-nav-link{display:inline-flex;align-items:center;justify-content:center;gap:.3rem;height:38px;padding:0 .8rem;font-size:.95rem;color:#9aa5be!important;text-decoration:none;border-radius:9999px;border:1px solid rgba(180,190,220,.1);white-space:nowrap;transition:all 150ms ease}
[data-theme="light"] .header-nav-link{color:#4a5568!important;border-color:rgba(0,0,0,.1)}
.header-nav-link:hover{color:#a78bfa!important;border-color:#7c7ff2;background:rgba(124,127,242,.18)}
.nav-emoji{font-size:1rem;line-height:1}
.nav-label{font-size:.9rem;font-weight:500;letter-spacing:.02em}
.auth-area{display:flex;align-items:center;gap:.75rem;flex-shrink:0}
.gp-bh-ui{position:relative;flex:none}
.gp-bh-ui-trigger{display:inline-flex;align-items:center;gap:.4rem;height:36px;padding:0 .85rem;background:rgba(255,255,255,.05);border:1px solid rgba(180,190,220,.15);border-radius:9999px;color:#9aa5be;font:600 .85rem/1 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;white-space:nowrap;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transition:all .2s ease}
[data-theme="light"] .gp-bh-ui-trigger{color:#4a5568;background:rgba(0,0,0,.035);border-color:rgba(0,0,0,.1)}
.gp-bh-ui-trigger:hover,.gp-bh-ui-trigger[aria-expanded="true"]{border-color:#7c7ff2;color:#fff;background:rgba(124,127,242,.15);box-shadow:0 0 14px rgba(124,127,242,.2)}
.gp-bh-caret{font-size:.65rem;color:#6b7899;transition:transform .2s ease}
.gp-bh-ui-trigger[aria-expanded="true"] .gp-bh-caret{transform:rotate(180deg)}
.gp-bh-ui-menu{position:absolute;right:0;top:calc(100% + 8px);width:260px;padding:.5rem;background:#161828;border:1px solid rgba(140,155,215,.25);border-radius:16px;box-shadow:0 18px 48px rgba(0,0,0,.42);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
[data-theme="light"] .gp-bh-ui-menu{background:rgba(255,255,255,.97);border-color:rgba(0,0,0,.12);box-shadow:0 18px 48px rgba(0,0,0,.16)}
.gp-bh-ui-menu[hidden]{display:none}
.gp-bh-ui-heading{padding:.35rem .55rem .5rem;color:#747b91;font-size:.65rem;font-weight:700;letter-spacing:.08em}
.gp-bh-ui-option{width:100%;display:grid;grid-template-columns:30px 1fr 18px;align-items:center;gap:.5rem;padding:.65rem .55rem;color:#d8dbea;background:transparent;border:0;border-radius:9px;text-align:left;cursor:pointer;font:inherit}
[data-theme="light"] .gp-bh-ui-option{color:#25283a}
.gp-bh-ui-option:hover{background:rgba(124,127,242,.11)}
.gp-bh-ui-option[aria-checked="true"]{background:rgba(124,127,242,.16)}
.gp-bh-ui-option-icon{font-size:1.1rem;text-align:center}
.gp-bh-ui-option strong,.gp-bh-ui-option small{display:block}
.gp-bh-ui-option strong{font-size:.82rem}
.gp-bh-ui-option small{margin-top:.12rem;color:#858ca2;font-size:.68rem}
.gp-bh-check{color:#8b8ef5;font-weight:800;opacity:0}
.gp-bh-ui-option[aria-checked="true"] .gp-bh-check{opacity:1}
.theme-toggle{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border:1px solid rgba(180,190,220,.1);border-radius:50%;background:transparent;color:#9aa5be;font-size:1.1rem;cursor:pointer;transition:all 150ms ease;flex-shrink:0}
[data-theme="light"] .theme-toggle{background:rgba(0,0,0,.025);border-color:rgba(0,0,0,.1);color:#4a5568}
.theme-toggle:hover{border-color:#7c7ff2;color:#a78bfa;background:rgba(124,127,242,.18)}
body.gp-ui-shell{min-height:100vh;background:#0c0d14!important}
[data-theme="light"] body.gp-ui-shell{background:#f5f6fa!important}
body.gp-ui-shell .hub-layout{background:transparent!important}
body.gp-ui-shell>#gp-hero-bg{position:fixed;inset:0;width:100vw;height:100vh;z-index:0;pointer-events:none;overflow:hidden;opacity:0;transition:opacity 1s ease-in-out}
body.gp-ui-shell>#gp-hero-bg.visible{opacity:.55}
body.gp-ui-shell>#gp-hero-bg[data-bg-dark="true"].visible{opacity:.45}
body.gp-ui-shell>#gp-hero-bg[data-gp-ui-active="space"].visible{opacity:1;background:radial-gradient(circle at 20% 15%,rgba(124,127,242,.14),transparent 38%),radial-gradient(circle at 80% 70%,rgba(56,189,248,.1),transparent 42%),#070911}
.gp-hero-media{position:absolute;inset:0;width:100%;height:100%}
.gp-hero-video{object-fit:cover}
.gp-hero-image{top:-10%;left:-10%;width:120%;height:120%;background-size:cover;background-position:center;background-repeat:no-repeat;animation:gpHeroBgDrift 8s ease-in-out infinite alternate}
.gp-space-canvas{display:block;width:100%;height:100%}
body.gp-ui-shell>:where(:not(#gp-hero-bg)){position:relative;z-index:1}
body.gp-ui-shell>.gp-blog-header{position:sticky;top:0;z-index:1000}
html[data-gp-ui-active="space"] body.gp-ui-shell{--bg-primary:#070911;--bg-secondary:#10131f;--bg-card:#181b2a;--text-primary:#f1f3fc;--text-secondary:#aab3c8;--text-muted:#7f8ba8;--border:rgba(180,190,220,.14);--lab-bg:#070911;--lab-bg-card:#181b2a;--lab-bg-table:#151827;--lab-border:#343a4d;--lab-text:#f1f3fc;--lab-text-muted:#9aa5be;--game-bg:#070911;--game-bg-secondary:#181b2a;--game-border:rgba(180,190,220,.14);--game-text:#f1f3fc;--game-text-secondary:#aab3c8;--game-text-muted:#7f8ba8;background:#070911!important;color:#f1f3fc;color-scheme:dark}
body.gp-ui-shell .hub-card,body.gp-ui-shell .tool-card{background:rgba(24,27,40,.76)!important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
[data-theme="light"] body.gp-ui-shell .hub-card,[data-theme="light"] body.gp-ui-shell .tool-card{background:rgba(255,255,255,.76)!important}
@keyframes gpHeroBgDrift{0%{transform:translate(0,0) scale(1)}50%{transform:translate(3%,-2%) scale(1.08)}100%{transform:translate(-3%,2%) scale(1.05)}}
@media(prefers-reduced-motion:reduce){.gp-hero-image{animation:none}}
@media(max-width:768px){.header-inner{padding:0 1rem}.site-logo{font-size:.85rem!important}.header-left{gap:.5rem}.header-nav{gap:.15rem}.nav-label{display:none}.header-nav-link{width:32px;height:32px;padding:0;border-radius:50%;justify-content:center}.nav-emoji{font-size:.9rem}.hidden-mobile{display:none!important}.gp-bh-ui-trigger{width:34px;height:34px;padding:0;justify-content:center}.gp-bh-ui-label,.gp-bh-caret{display:none}.gp-bh-ui-menu{position:fixed;top:60px;right:.5rem;width:min(260px,calc(100vw - 1rem))}.theme-toggle{width:32px;height:32px}}
</style>
<script id="gpCanonicalHeaderScript">
(function(){
    document.body.classList.add('gp-ui-shell');
    var UI_KEY='gp-ui-preference';
    var allowed={auto:true,classic:true,space:true};
    var dropdown=document.getElementById('gpBhUiDropdown');
    var trigger=document.getElementById('gpBhUiTrigger');
    var menu=document.getElementById('gpBhUiMenu');
    var label=document.getElementById('gpBhUiLabel');
    var icon=document.getElementById('gpBhUiIcon');
    var themeButton=document.getElementById('gpBhThemeToggle');
    var displays={auto:{icon:'🎲',label:'UI: Auto'},classic:{icon:'🏛️',label:'UI: Classic'},space:{icon:'🚀',label:'UI: Space'}};
    function readPreference(){
        try{var saved=localStorage.getItem(UI_KEY);return allowed[saved]?saved:'auto'}catch(e){return 'auto'}
    }
    function renderPreference(preference){
        var display=displays[preference]||displays.auto;
        icon.textContent=display.icon;
        label.textContent=display.label;
        menu.querySelectorAll('[data-gp-ui]').forEach(function(option){option.setAttribute('aria-checked',option.getAttribute('data-gp-ui')===preference?'true':'false')});
    }
    function closeMenu(){menu.hidden=true;trigger.setAttribute('aria-expanded','false')}
    renderPreference(readPreference());
    trigger.addEventListener('click',function(){var open=menu.hidden;menu.hidden=!open;trigger.setAttribute('aria-expanded',open?'true':'false')});
    menu.addEventListener('click',function(event){
        var option=event.target.closest('[data-gp-ui]');
        if(!option)return;
        var preference=option.getAttribute('data-gp-ui');
        try{localStorage.setItem(UI_KEY,preference)}catch(e){}
        renderPreference(preference);
        window.dispatchEvent(new CustomEvent('gp-ui-change',{detail:preference}));
        closeMenu();
    });
    document.addEventListener('click',function(event){if(dropdown&&!dropdown.contains(event.target))closeMenu()});
    document.addEventListener('keydown',function(event){if(event.key==='Escape')closeMenu()});
    function renderTheme(){var theme=document.documentElement.getAttribute('data-theme');themeButton.textContent=theme==='light'?'🌙':'☀️'}
    renderTheme();
    themeButton.addEventListener('click',function(){
        var current=document.documentElement.getAttribute('data-theme');
        var next=current==='light'?'dark':'light';
        document.documentElement.setAttribute('data-theme',next);
        try{localStorage.setItem('gp-theme',next)}catch(e){}
        renderTheme();
    });
})()
</script>
<!-- gp-canonical-header:end -->`;
}
