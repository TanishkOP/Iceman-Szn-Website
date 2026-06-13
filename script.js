const root = document.documentElement;
const stage = document.querySelector(".scroll-stage");
const video = document.querySelector(".hand-video");
const playNow = document.querySelector("[data-scroll-albums]");
const albumCards = [...document.querySelectorAll(".album-card")];

const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max);
const lerp = (from, to, progress) => from + (to - from) * progress;
const smoothstep = (edge0, edge1, value) => {
  const x = clamp((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
};

let targetProgress = 0;
let visualProgress = 0;
let targetTime = 0;
let renderedTime = 0;
let videoDuration = 1;
let stageScrollDistance = 1;
let hasVideoMetadata = false;
let objectUrl;

function measure() {
  stageScrollDistance = Math.max(1, stage.offsetHeight - window.innerHeight);
}

function setVariable(name, value) {
  root.style.setProperty(name, value);
}

function updateScene(nextProgress) {
  const progress = clamp(nextProgress);

  const heroOut = smoothstep(0.12, 0.34, progress);
  const transitionIn = smoothstep(0.22, 0.42, progress);
  const transitionOut = smoothstep(0.55, 0.76, progress);
  const albumsIn = smoothstep(0.64, 0.86, progress);
  const handMove = smoothstep(0.14, 0.68, progress);
  const handExit = smoothstep(0.7, 0.88, progress);

  setVariable("--stage-progress", progress.toFixed(4));
  setVariable("--hero-opacity", (1 - heroOut).toFixed(4));
  setVariable("--hero-y", `${lerp(0, -24, heroOut).toFixed(2)}px`);
  setVariable("--transition-opacity", (transitionIn * (1 - transitionOut)).toFixed(4));
  setVariable("--albums-opacity", albumsIn.toFixed(4));
  setVariable("--albums-y", `${lerp(48, 0, albumsIn).toFixed(2)}px`);
  setVariable("--palm-opacity", albumsIn.toFixed(4));
  setVariable("--palm-y", `${lerp(72, 0, albumsIn).toFixed(2)}px`);
  setVariable("--hand-left", `${lerp(-2, 12, handMove).toFixed(2)}vw`);
  setVariable("--hand-top", `${lerp(54, 51, handMove).toFixed(2)}%`);
  setVariable("--hand-scale", lerp(1, 0.76, handExit).toFixed(4));
  setVariable("--hand-opacity", (1 - handExit).toFixed(4));
  setVariable("--hand-blur", `${lerp(0, 2.2, handExit).toFixed(2)}px`);

  targetTime = progress * videoDuration;
}

function readScroll() {
  const rect = stage.getBoundingClientRect();
  targetProgress = clamp(-rect.top / stageScrollDistance);
}

function renderScene() {
  const delta = targetProgress - visualProgress;

  if (Math.abs(delta) < 0.0006) {
    visualProgress = targetProgress;
  } else {
    visualProgress += delta * 0.115;
  }

  updateScene(visualProgress);

  if (hasVideoMetadata && Number.isFinite(targetTime)) {
    renderedTime = lerp(renderedTime, targetTime, 0.2);

    if (Math.abs(video.currentTime - renderedTime) > 0.025) {
      try {
        video.currentTime = clamp(renderedTime, 0, Math.max(0, videoDuration - 0.04));
      } catch {
        // Some browsers briefly reject seeks before the first frame is decoded.
      }
    }
  }

  requestAnimationFrame(renderScene);
}

function syncVideoMetadata() {
  videoDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
  renderedTime = clamp(visualProgress * videoDuration, 0, videoDuration);
  targetTime = renderedTime;
  hasVideoMetadata = true;
  video.pause();
  readScroll();
}

function jumpToAlbums() {
  const stageTop = window.scrollY + stage.getBoundingClientRect().top;
  const target = stageTop + stageScrollDistance * 0.82;
  window.scrollTo({ top: target, behavior: "smooth" });
}

function setActiveAlbum(card) {
  albumCards.forEach((albumCard) => albumCard.classList.toggle("is-active", albumCard === card));
}

window.addEventListener("resize", () => {
  measure();
  readScroll();
});

window.addEventListener(
  "scroll",
  () => {
    readScroll();
  },
  { passive: true },
);

video.addEventListener("loadedmetadata", syncVideoMetadata, { once: true });
video.addEventListener("durationchange", syncVideoMetadata);
video.pause();

async function loadSeekableVideo() {
  const originalSource = video.currentSrc || video.getAttribute("src");

  try {
    const response = await fetch(originalSource);
    const blob = await response.blob();
    objectUrl = URL.createObjectURL(blob);
    video.src = objectUrl;
  } catch {
    video.src = originalSource;
  }

  video.load();
}

window.addEventListener("beforeunload", () => {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
  }
});

loadSeekableVideo();

playNow?.addEventListener("click", jumpToAlbums);

albumCards.forEach((card) => {
  const button = card.querySelector("button");
  button?.addEventListener("click", () => setActiveAlbum(card));
});

measure();
readScroll();
visualProgress = targetProgress;
updateScene(visualProgress);
requestAnimationFrame(renderScene);
