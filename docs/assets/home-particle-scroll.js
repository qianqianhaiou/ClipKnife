import {
  createParticleScroll,
  supportsHtmlInCanvas
} from "./particle-scroll.js";

const smallViewport = window.matchMedia("(max-width: 767px)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (
  supportsHtmlInCanvas() &&
  !smallViewport.matches &&
  !reducedMotion.matches
) {
  const main = document.getElementById("main");
  const footer = document.querySelector("body > footer");

  if (main && footer) {
    const mainMarker = document.createComment("particle-scroll-main");
    const footerMarker = document.createComment("particle-scroll-footer");
    main.before(mainMarker);
    footer.before(footerMarker);

    const host = document.createElement("div");
    host.className = "particle-scroll-host";

    const source = document.createElement("canvas");
    source.className = "particle-scroll-source";
    source.setAttribute("layoutsubtree", "true");

    const content = document.createElement("div");
    content.className = "particle-scroll-content";
    content.dataset.particleScrollContent = "";
    content.append(main, footer);
    source.append(content);

    const output = document.createElement("canvas");
    output.className = "particle-scroll-output";
    output.setAttribute("aria-hidden", "true");

    host.append(source, output);
    mainMarker.after(host);
    document.documentElement.classList.add("home-particle-scroll");

    const instance = createParticleScroll(
      { source, content, output },
      {
        point: 0.74,
        band: 340,
        density: 2.5,
        size: 1.15,
        spread: 160,
        gravity: 0.38,
        drift: 0.42,
        swirl: 40,
        stagger: 0.58,
        fade: 0.62,
        settle: 0.9,
        smoothing: 0.4
      }
    );

    if (!instance) {
      host.remove();
      mainMarker.replaceWith(main);
      footerMarker.replaceWith(footer);
      document.documentElement.classList.remove("home-particle-scroll");
    } else {
      window.addEventListener(
        "pagehide",
        () => instance.destroy(),
        { once: true }
      );
    }
  }
}
