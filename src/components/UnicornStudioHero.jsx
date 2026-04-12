import { useEffect, useState } from "react";

const SCRIPT_SRC =
  "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.0.5/dist/unicornStudio.umd.js";

/** Default project from LAB.01 reference embed; override with VITE_UNICORNSTUDIO_PROJECT_ID */
export const DEFAULT_UNICORN_PROJECT = "q0JSwb0l42Yf6m79xfW9";

function loadUnicornScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return;
    const U = window.UnicornStudio;
    if (U && typeof U.init === "function") {
      resolve(U);
      return;
    }
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      const done = () => {
        if (window.UnicornStudio?.init) resolve(window.UnicornStudio);
        else reject(new Error("UnicornStudio not available after load"));
      };
      if (existing.getAttribute("data-loaded") === "1") {
        done();
        return;
      }
      existing.addEventListener("load", done);
      existing.addEventListener("error", () => reject(new Error("UnicornStudio script failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => {
      s.setAttribute("data-loaded", "1");
      if (window.UnicornStudio?.init) resolve(window.UnicornStudio);
      else reject(new Error("UnicornStudio global missing"));
    };
    s.onerror = () => reject(new Error("UnicornStudio script load error"));
    (document.head || document.body).appendChild(s);
  });
}

function runInit(U) {
  if (!U?.init) return;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => U.init(), { once: true });
  } else {
    U.init();
  }
}

/**
 * Full-bleed Unicorn Studio WebGL layer (data-us-project). Matches LAB.01 hero embed behavior.
 */
export default function UnicornStudioHero({ projectId, className = "" }) {
  const [motionOk, setMotionOk] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMotionOk(!mq.matches);
    const onChange = () => setMotionOk(!mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!motionOk || !projectId) return;
    let cancelled = false;
    loadUnicornScript()
      .then((U) => {
        if (cancelled) return;
        requestAnimationFrame(() => runInit(U));
      })
      .catch(() => {
        /* optional: silent fallback — CSS mesh remains */
      });
    return () => {
      cancelled = true;
    };
  }, [motionOk, projectId]);

  if (!motionOk || !projectId) {
    return null;
  }

  return (
    <div className={`home-hero-unicorn ${className}`.trim()} aria-hidden>
      <div
        className="home-hero-unicorn-canvas"
        data-us-project={projectId}
        data-parallax-speed="-0.14"
      />
    </div>
  );
}
