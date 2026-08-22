// ==========================================
// ブログ・LAB共通ヘッダー（GP本体ヘッダーの軽量版）
// ロゴ・主要ナビ・テーマ切替のみ。認証エリア・UI切替は含めない
// ブログ/LAB双方のCSS変数に依存せず、独自スコープで完結させる
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

/** ヘッダーHTML + スタイル + テーマ切替スクリプトをまとめて返す */
export function gpHeaderBlock() {
  const navHtml = NAV_LINKS.map((l) => navLinkHtml(l)).join("\n      ");
  const socialHtml = SOCIAL_LINKS.map(
    (l) =>
      `<a href="${l.href}" target="_blank" rel="noopener noreferrer" class="gp-bh-link gp-bh-hide-mobile" aria-label="${l.label}">
        <span class="gp-bh-emoji">${l.emoji}</span>
      </a>`,
  ).join("\n      ");

  return `<header class="gp-blog-header">
  <div class="gp-bh-inner">
    <a href="${SITE_ORIGIN}/" class="gp-bh-logo">Gravity Portal</a>
    <nav class="gp-bh-nav">
      ${navHtml}
      ${socialHtml}
    </nav>
    <button class="gp-bh-theme" id="gpBhThemeToggle" aria-label="テーマ切替">🌙</button>
  </div>
</header>
<style>
.gp-blog-header{background:#161b22;border-bottom:1px solid rgba(255,255,255,.1)}
[data-theme="light"] .gp-blog-header{background:#ffffff;border-bottom:1px solid rgba(0,0,0,.1)}
.gp-bh-inner{max-width:1400px;margin:0 auto;padding:0 1.25rem;height:52px;display:flex;align-items:center;gap:1.25rem}
.gp-bh-logo{font-size:1.05rem;font-weight:700;color:#7c7ff2;text-decoration:none;white-space:nowrap}
.gp-bh-nav{display:flex;align-items:center;gap:.4rem;flex:1;overflow-x:auto;scrollbar-width:none}
.gp-bh-nav::-webkit-scrollbar{display:none}
.gp-bh-link{display:inline-flex;align-items:center;gap:.3rem;height:32px;padding:0 .7rem;font-size:.85rem;color:#a0aec0;text-decoration:none;border-radius:9999px;border:1px solid rgba(255,255,255,.1);white-space:nowrap;transition:all .15s ease}
[data-theme="light"] .gp-bh-link{color:#4a5568;border-color:rgba(0,0,0,.1)}
.gp-bh-link:hover{color:#7c7ff2;border-color:#7c7ff2}
.gp-bh-emoji{font-size:.95rem;line-height:1}
.gp-bh-theme{width:32px;height:32px;flex:none;background:transparent;border:1px solid rgba(255,255,255,.1);border-radius:50%;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:all .15s ease}
[data-theme="light"] .gp-bh-theme{border-color:rgba(0,0,0,.1)}
.gp-bh-theme:hover{border-color:#7c7ff2}
@media(max-width:640px){.gp-bh-label{display:none}.gp-bh-hide-mobile{display:none}.gp-bh-link{padding:0;width:32px;justify-content:center}}
</style>
<script>
(function(){
    var btn=document.getElementById('gpBhThemeToggle');
    if(!btn)return;
    function update(){var t=document.documentElement.getAttribute('data-theme');btn.textContent=t==='light'?'🌙':'☀️'}
    update();
    btn.addEventListener('click',function(){
        var cur=document.documentElement.getAttribute('data-theme');
        var next=cur==='light'?'dark':'light';
        document.documentElement.setAttribute('data-theme',next);
        try{localStorage.setItem('gp-theme',next)}catch(e){}
        update();
    });
})()
</script>`;
}
