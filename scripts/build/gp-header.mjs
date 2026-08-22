// ==========================================
// ブログ・GAME・LAB共通ヘッダー
// このファイルを公開HTMLへ注入する唯一の正本とする
// ==========================================

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
  return `<a href="${link.href}" class="gp-bh-link${hideMobile ? " gp-bh-hide-mobile" : ""}" aria-label="${link.label}">
        <span class="gp-bh-emoji">${link.emoji}</span><span class="gp-bh-label">${link.label}</span>
      </a>`;
}

/** ヘッダーHTML・スタイル・UI/テーマ切替スクリプトをまとめて返す */
export function gpHeaderBlock() {
  const navHtml = NAV_LINKS.map((link) => navLinkHtml(link)).join(
    "\n      ",
  );
  const socialHtml = SOCIAL_LINKS.map(
    (link) =>
      `<a href="${link.href}" target="_blank" rel="noopener noreferrer" class="gp-bh-link gp-bh-hide-mobile" aria-label="${link.label}">
        <span class="gp-bh-emoji">${link.emoji}</span>
      </a>`,
  ).join("\n      ");

  return `<!-- gp-canonical-header:start -->
<header class="gp-blog-header" data-gp-canonical-header>
  <div class="gp-bh-inner">
    <a href="${SITE_ORIGIN}/" class="gp-bh-logo">Gravity Portal</a>
    <nav class="gp-bh-nav" aria-label="主要ナビゲーション">
      ${navHtml}
      ${socialHtml}
    </nav>
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
    <button type="button" class="gp-bh-theme" id="gpBhThemeToggle" aria-label="テーマ切替">🌙</button>
  </div>
</header>
<style id="gpCanonicalHeaderStyles">
.gp-blog-header{position:sticky;top:0;z-index:1000;background:rgba(9,10,18,.82);border-bottom:1px solid rgba(255,255,255,.12);box-shadow:0 6px 24px rgba(0,0,0,.16);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
[data-theme="light"] .gp-blog-header{background:rgba(255,255,255,.82);border-bottom-color:rgba(0,0,0,.1)}
.gp-bh-inner{max-width:1400px;margin:0 auto;padding:0 1.25rem;height:62px;display:flex;align-items:center;gap:1.1rem}
.gp-bh-logo{font-size:1.05rem;font-weight:700;color:#a78bfa!important;text-decoration:none;white-space:nowrap}
.gp-bh-nav{display:flex;align-items:center;gap:.4rem;flex:1;overflow-x:auto;scrollbar-width:none}
.gp-bh-nav::-webkit-scrollbar{display:none}
.gp-bh-link{display:inline-flex;align-items:center;gap:.3rem;height:36px;padding:0 .75rem;font-size:.85rem;color:#b7bdd0!important;text-decoration:none;border-radius:9999px;border:1px solid rgba(255,255,255,.1);white-space:nowrap;transition:color .15s ease,border-color .15s ease,background .15s ease}
[data-theme="light"] .gp-bh-link{color:#4a5568!important;border-color:rgba(0,0,0,.1)}
.gp-bh-link:hover{color:#a78bfa!important;border-color:#7c7ff2;background:rgba(124,127,242,.1)}
.gp-bh-emoji{font-size:.95rem;line-height:1}
.gp-bh-ui{position:relative;flex:none}
.gp-bh-ui-trigger{height:38px;padding:0 .75rem;display:flex;align-items:center;gap:.4rem;color:#c4c8d8;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:9999px;cursor:pointer;font:600 .78rem/1 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap}
[data-theme="light"] .gp-bh-ui-trigger{color:#4a5568;background:rgba(0,0,0,.035);border-color:rgba(0,0,0,.1)}
.gp-bh-ui-trigger:hover,.gp-bh-ui-trigger[aria-expanded="true"]{border-color:#7c7ff2;background:rgba(124,127,242,.12)}
.gp-bh-caret{font-size:.55rem;transition:transform .15s ease}
.gp-bh-ui-trigger[aria-expanded="true"] .gp-bh-caret{transform:rotate(180deg)}
.gp-bh-ui-menu{position:absolute;right:0;top:calc(100% + .55rem);width:270px;padding:.55rem;background:rgba(16,17,28,.97);border:1px solid rgba(255,255,255,.14);border-radius:14px;box-shadow:0 18px 48px rgba(0,0,0,.42);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
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
.gp-bh-theme{width:36px;height:36px;flex:none;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:50%;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:border-color .15s ease,background .15s ease}
[data-theme="light"] .gp-bh-theme{background:rgba(0,0,0,.025);border-color:rgba(0,0,0,.1)}
.gp-bh-theme:hover{border-color:#7c7ff2;background:rgba(124,127,242,.1)}
body.gp-ui-shell{background:transparent!important}
body.gp-ui-shell .hub-layout{background:transparent!important}
body.gp-ui-shell>#gp-hero-bg{position:fixed;inset:0;width:100vw;height:100vh;z-index:0;pointer-events:none;overflow:hidden}
body.gp-ui-shell>*:not(#gp-hero-bg){position:relative;z-index:1}
body.gp-ui-shell>.gp-blog-header{position:sticky;z-index:1000}
body.gp-ui-shell .hub-card,body.gp-ui-shell .tool-card{background:rgba(24,27,40,.76)!important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
[data-theme="light"] body.gp-ui-shell .hub-card,[data-theme="light"] body.gp-ui-shell .tool-card{background:rgba(255,255,255,.76)!important}
@media(max-width:760px){.gp-bh-inner{height:56px;padding:0 .65rem;gap:.45rem}.gp-bh-logo{font-size:.92rem}.gp-bh-nav{gap:.28rem}.gp-bh-label,.gp-bh-hide-mobile{display:none}.gp-bh-link{padding:0;width:34px;height:34px;justify-content:center}.gp-bh-ui-trigger{width:38px;padding:0;justify-content:center}.gp-bh-ui-label,.gp-bh-caret{display:none}.gp-bh-ui-menu{position:fixed;top:64px;right:.65rem;width:min(270px,calc(100vw - 1.3rem))}.gp-bh-theme{width:34px;height:34px}}
@media(max-width:430px){.gp-bh-logo{max-width:78px;overflow:hidden;text-overflow:ellipsis}.gp-bh-nav .gp-bh-link:nth-of-type(4){display:none}}
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
