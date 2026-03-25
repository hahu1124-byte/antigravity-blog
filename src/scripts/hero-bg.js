/**
 * hero-bg.js - Global Background Video System
 * Applies the Gravity Portal video/image background to arbitrary HTML pages.
 */
(function() {
    const DARK_VIDEOS = ["https://antigravity-portal.com/images/hero/dark-particles.mp4"];
    const LIGHT_VIDEOS = ["https://antigravity-portal.com/images/hero/dark-particles.mp4"];
    
    // 静止画フォールバック
    const DARK_IMAGES = [
      "https://antigravity-portal.com/images/hero/dark-cosmic.png",
      "https://antigravity-portal.com/images/hero/dark-geometric.png",
      "https://antigravity-portal.com/images/hero/dark-aurora.png",
      "https://antigravity-portal.com/images/hero/dark-cosmic.jpg",
      "https://antigravity-portal.com/images/hero/dark-aurora.jpg"
    ];
    const LIGHT_IMAGES = [
      "https://antigravity-portal.com/images/hero/light-watercolor.png",
      "https://antigravity-portal.com/images/hero/light-gradient.png",
      "https://antigravity-portal.com/images/hero/light-wave.png",
      "https://antigravity-portal.com/images/hero/light-watercolor.jpg",
      "https://antigravity-portal.com/images/hero/light-gradient.jpg",
      "https://antigravity-portal.com/images/hero/light-wave.jpg"
    ];

    function pickRandom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    async function isLowPowerMode() {
        try {
            if (typeof navigator.getBattery === "function") {
                const battery = await navigator.getBattery();
                if (!battery.charging && battery.level <= 0.2) return true;
            }
        } catch { /* ignored */ }
        return false;
    }

    async function applyBackground(container) {
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        const isDark = theme !== 'light';
        const lowPower = await isLowPowerMode();

        const videos = isDark ? DARK_VIDEOS : LIGHT_VIDEOS;
        const images = isDark ? DARK_IMAGES : LIGHT_IMAGES;

        let useVideo = !lowPower && videos.length > 0;
        let mediaSrc = useVideo ? pickRandom(videos) : pickRandom(images);

        function render() {
            container.innerHTML = '';
            container.setAttribute('data-bg-dark', isDark ? 'true' : 'false');
            
            if (useVideo) {
                const video = document.createElement('video');
                video.src = mediaSrc;
                video.autoplay = true;
                video.loop = true;
                video.muted = true;
                video.setAttribute('playsinline', '');
                video.setAttribute('aria-hidden', 'true');
                video.className = 'gp-hero-media gp-hero-video';
                
                video.onerror = function() {
                    useVideo = false;
                    mediaSrc = pickRandom(images);
                    render();
                };
                container.appendChild(video);
            } else {
                const div = document.createElement('div');
                div.className = 'gp-hero-media gp-hero-image';
                div.style.backgroundImage = `url(${mediaSrc})`;
                div.setAttribute('aria-hidden', 'true');
                container.appendChild(div);
            }
            // フェードイン
            setTimeout(() => container.classList.add('visible'), 200);
        }

        render();
    }

    function init() {
        if (sessionStorage.getItem('gp-no-bg') === '1') return;
        
        let container = document.getElementById('gp-hero-bg');
        if (!container) {
            container = document.createElement('div');
            container.id = 'gp-hero-bg';
            document.body.insertBefore(container, document.body.firstChild);
        }

        applyBackground(container);

        // テーマ切替監視
        const observer = new MutationObserver(() => {
            container.classList.remove('visible');
            setTimeout(() => {
                applyBackground(container);
            }, 400);
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
