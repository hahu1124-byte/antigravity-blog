/**
 * hero-bg.js - GP共通背景
 * gp-ui-preference（auto/classic/space）をページ遷移なしで反映する。
 */
(function () {
  const UI_KEY = "gp-ui-preference";
  const AUTO_SESSION_KEY = "gp-ui-auto-resolved";
  const DARK_VIDEOS = [
    "https://antigravity-portal.com/images/hero/dark-particles.mp4",
  ];
  const LIGHT_VIDEOS = [
    "https://antigravity-portal.com/images/hero/dark-particles.mp4",
  ];
  const DARK_IMAGES = [
    "https://antigravity-portal.com/images/hero/dark-cosmic.png",
    "https://antigravity-portal.com/images/hero/dark-geometric.png",
    "https://antigravity-portal.com/images/hero/dark-aurora.png",
    "https://antigravity-portal.com/images/hero/dark-cosmic.jpg",
    "https://antigravity-portal.com/images/hero/dark-aurora.jpg",
  ];
  const LIGHT_IMAGES = [
    "https://antigravity-portal.com/images/hero/light-watercolor.png",
    "https://antigravity-portal.com/images/hero/light-gradient.png",
    "https://antigravity-portal.com/images/hero/light-wave.png",
    "https://antigravity-portal.com/images/hero/light-watercolor.jpg",
    "https://antigravity-portal.com/images/hero/light-gradient.jpg",
    "https://antigravity-portal.com/images/hero/light-wave.jpg",
  ];
  const SPACE_COLORS = ["#7c7ff2", "#38bdf8", "#c084fc", "#f43f5e", "#10b981"];

  function pickRandom(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function readPreference() {
    try {
      const saved = localStorage.getItem(UI_KEY);
      return saved === "classic" || saved === "space" ? saved : "auto";
    } catch {
      return "auto";
    }
  }

  function resolvePreference(container, preference, renewAuto) {
    if (preference !== "auto") return preference;
    if (!renewAuto && container.dataset.autoChoice) {
      return container.dataset.autoChoice;
    }
    try {
      if (!renewAuto) {
        const saved = sessionStorage.getItem(AUTO_SESSION_KEY);
        if (saved === "classic" || saved === "space") {
          container.dataset.autoChoice = saved;
          return saved;
        }
      }
      const selected = Math.random() < 0.5 ? "classic" : "space";
      sessionStorage.setItem(AUTO_SESSION_KEY, selected);
      container.dataset.autoChoice = selected;
      return selected;
    } catch {
      const selected = Math.random() < 0.5 ? "classic" : "space";
      container.dataset.autoChoice = selected;
      return selected;
    }
  }

  async function isLowPowerMode() {
    try {
      if (typeof navigator.getBattery === "function") {
        const battery = await navigator.getBattery();
        return !battery.charging && battery.level <= 0.2;
      }
    } catch {
      // Battery Status API非対応時は通常表示を続ける。
    }
    return false;
  }

  function clearBackground(container) {
    if (typeof container._gpCleanup === "function") container._gpCleanup();
    container._gpCleanup = null;
    container.replaceChildren();
    container.classList.remove("visible");
  }

  async function renderClassic(container, renderId) {
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    const videos = isDark ? DARK_VIDEOS : LIGHT_VIDEOS;
    const images = isDark ? DARK_IMAGES : LIGHT_IMAGES;
    const lowPower = await isLowPowerMode();
    if (container.dataset.renderId !== String(renderId)) return;

    container.dataset.bgDark = isDark ? "true" : "false";
    let useVideo = !lowPower && videos.length > 0;

    function renderMedia() {
      if (container.dataset.renderId !== String(renderId)) return;
      container.replaceChildren();
      if (useVideo) {
        const video = document.createElement("video");
        video.src = pickRandom(videos);
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.setAttribute("playsinline", "");
        video.setAttribute("aria-hidden", "true");
        video.className = "gp-hero-media gp-hero-video";
        video.onerror = function () {
          useVideo = false;
          renderMedia();
        };
        container.appendChild(video);
      } else {
        const image = document.createElement("div");
        image.className = "gp-hero-media gp-hero-image";
        image.style.backgroundImage = `url(${pickRandom(images)})`;
        image.setAttribute("aria-hidden", "true");
        container.appendChild(image);
      }
      requestAnimationFrame(function () {
        container.classList.add("visible");
      });
    }

    renderMedia();
  }

  function renderSpace(container, renderId) {
    const canvas = document.createElement("canvas");
    canvas.className = "gp-space-canvas";
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);
    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let frameId = 0;
    let width = 0;
    let height = 0;
    let particles = [];
    let mouseX = 0;
    let mouseY = 0;
    let pointerActive = false;

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = width < 640 ? 48 : 95;
      particles = Array.from({ length: count }, function () {
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2,
          size: Math.random() * 2.8 + 1,
          color: pickRandom(SPACE_COLORS),
        };
      });
    }

    function draw(update) {
      if (container.dataset.renderId !== String(renderId)) return;
      context.clearRect(0, 0, width, height);
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        if (update && pointerActive) {
          const dx = mouseX - particle.x;
          const dy = mouseY - particle.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 0 && distance < 180) {
            const force = (180 - distance) / 180;
            particle.vx -= (dx / distance) * force * 0.45;
            particle.vy -= (dy / distance) * force * 0.45;
          }
        }
        if (update) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.vx *= 0.985;
          particle.vy *= 0.985;
          if (particle.x < 0) particle.x = width;
          if (particle.x > width) particle.x = 0;
          if (particle.y < 0) particle.y = height;
          if (particle.y > height) particle.y = 0;
        }
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fillStyle = particle.color;
        context.shadowColor = particle.color;
        context.shadowBlur = 12;
        context.fill();
        context.shadowBlur = 0;

        for (let otherIndex = index + 1; otherIndex < particles.length; otherIndex += 1) {
          const other = particles[otherIndex];
          const distance = Math.hypot(particle.x - other.x, particle.y - other.y);
          if (distance < 90) {
            context.beginPath();
            context.moveTo(particle.x, particle.y);
            context.lineTo(other.x, other.y);
            context.strokeStyle = `rgba(124,127,242,${(1 - distance / 90) * 0.22})`;
            context.lineWidth = 0.75;
            context.stroke();
          }
        }
      }
    }

    function animate() {
      draw(true);
      frameId = requestAnimationFrame(animate);
    }

    function handlePointerMove(event) {
      mouseX = event.clientX;
      mouseY = event.clientY;
      pointerActive = true;
    }

    function handlePointerLeave() {
      pointerActive = false;
    }

    function handleResize() {
      resize();
      if (reducedMotion) draw(false);
    }

    resize();
    if (reducedMotion) {
      draw(false);
    } else {
      window.addEventListener("pointermove", handlePointerMove, {
        passive: true,
      });
      document.addEventListener("pointerleave", handlePointerLeave);
      animate();
    }
    window.addEventListener("resize", handleResize);
    container._gpCleanup = function () {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerleave", handlePointerLeave);
    };
    requestAnimationFrame(function () {
      container.classList.add("visible");
    });
  }

  function applyPreference(container, preference, renewAuto) {
    clearBackground(container);
    const renderId = Number(container.dataset.renderId || 0) + 1;
    container.dataset.renderId = String(renderId);
    const active = resolvePreference(container, preference, renewAuto);
    container.dataset.preference = preference;
    container.dataset.gpUiActive = active;
    if (active === "space") renderSpace(container, renderId);
    else renderClassic(container, renderId);
  }

  function init() {
    if (sessionStorage.getItem("gp-no-bg") === "1") return;
    let container = document.getElementById("gp-hero-bg");
    if (!container) {
      container = document.createElement("div");
      container.id = "gp-hero-bg";
      document.body.insertBefore(container, document.body.firstChild);
    }

    applyPreference(container, readPreference(), false);
    window.addEventListener("gp-ui-change", function (event) {
      const preference =
        typeof event.detail === "string"
          ? event.detail
          : event.detail && event.detail.preference;
      const safePreference =
        preference === "classic" || preference === "space"
          ? preference
          : "auto";
      applyPreference(container, safePreference, safePreference === "auto");
    });

    new MutationObserver(function () {
      const preference = container.dataset.preference || readPreference();
      if (container.dataset.gpUiActive === "classic") {
        applyPreference(container, preference, false);
      }
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
