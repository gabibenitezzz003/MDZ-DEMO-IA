"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSessionId } from "@/components/SessionProvider";
import {
  closeResourceViewer,
  openResourceUrl,
  resourceViewerIsOpen,
} from "@/lib/open-resource";
import type { AgentEvent } from "@/lib/types";

declare global {
  interface Window {
    DograhWidget?: {
      setContext?: (vars: Record<string, unknown>) => void;
      getContext?: () => Record<string, unknown>;
      start?: () => void;
      end?: () => void;
      onStatusChange?: (cb: (status: string) => void) => void;
    };
  }
}

function highlightElement(el: HTMLElement, ms = 4500) {
  el.classList.add("agent-highlight");
  window.setTimeout(() => el.classList.remove("agent-highlight"), ms);
}

function findSectionEl(sectionId: string): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(`[data-section-id="${sectionId}"]`) ||
    document.getElementById(sectionId)
  );
}

function openUrl(
  url: string,
  redirect = true,
  meta?: { sectionId?: string; title?: string; forceTab?: boolean }
) {
  openResourceUrl(url, {
    redirect,
    sectionId: meta?.sectionId,
    title: meta?.title,
    forceTab: meta?.forceTab ?? true,
  });
}

export function VoiceAssistantBridge() {
  const sessionId = useSessionId();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (!sessionId) return;

    const useDograh = process.env.NEXT_PUBLIC_USE_DOGRAH === "true";
    const embedUrl = useDograh
      ? process.env.NEXT_PUBLIC_DOGRAH_EMBED_URL
      : undefined;
    if (embedUrl) {
      const existing = document.getElementById("dograh-widget");
      if (!existing) {
        const js = document.createElement("script");
        js.id = "dograh-widget";
        js.src = embedUrl;
        js.async = true;
        js.setAttribute(
          "data-dograh-context",
          JSON.stringify({
            session_id: sessionId,
            current_page: pathnameRef.current,
            demo: true,
            locale: "es-AR",
          })
        );
        document.body.appendChild(js);
      } else if (window.DograhWidget?.setContext) {
        window.DograhWidget.setContext({
          session_id: sessionId,
          current_page: pathnameRef.current,
        });
      }
    }

    const historyStack: string[] = [];

    const clickPrimary = (root: HTMLElement): boolean => {
      window.dispatchEvent(
        new CustomEvent("demo:section-activate", {
          detail: { sectionId: root.dataset.sectionId || root.id },
        })
      );

      const primary =
        root.matches("[data-demo-primary]")
          ? root
          : root.querySelector<HTMLElement>("[data-demo-primary]");
      if (primary) {
        if (primary.tagName === "A") {
          const href = (primary as HTMLAnchorElement).href;
          if (/^https?:/.test(href) && !href.includes(window.location.host)) {
            openUrl(href);
            return true;
          }
        }
        primary.click();
        return true;
      }

      if (root.tagName === "BUTTON" || root.getAttribute("role") === "tab") {
        root.click();
        return true;
      }

      if (root.tagName === "A") {
        const href = (root as HTMLAnchorElement).href;
        if (href && !href.endsWith("#") && !href.includes("/#")) {
          openUrl(href);
          return true;
        }
        root.click();
        return true;
      }

      const anchor = root.querySelector<HTMLAnchorElement>("a[href]");
      if (anchor?.href) {
        if (anchor.target === "_blank" || /^https?:/.test(anchor.href)) {
          openUrl(anchor.href);
          return true;
        }
        anchor.click();
        return true;
      }

      root.click();
      return false;
    };

    const focusSection = (
      target: string,
      openLink = true,
      fallbackUrl?: string
    ) => {
      const el = findSectionEl(target);
      if (!el) return false;

      try {
        history.replaceState(null, "", `/#${target}`);
      } catch {
        // ignore
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      highlightElement(el);

      window.dispatchEvent(
        new CustomEvent("demo:section-activate", {
          detail: { sectionId: target },
        })
      );

      if (
        ["autoridades", "mision", "vision", "funcion", "normativa"].includes(
          target
        )
      ) {
        el.click();
      }

      if (openLink) {
        // Open ASAP (same tick when possible). If the browser blocks the popup,
        // OfficialToast shows a clickable "Abrir sitio oficial".
        const href =
          fallbackUrl ||
          (el.tagName === "A"
            ? (el as HTMLAnchorElement).href
            : el.querySelector<HTMLAnchorElement>("a[href]")?.href);
        const external =
          href &&
          /^https?:/.test(href) &&
          !href.includes(window.location.host)
            ? href
            : fallbackUrl;
        if (external) {
          openUrl(external, true, { sectionId: target });
        }
      }
      return true;
    };

    const goToSection = (
      target: string,
      openLink = true,
      fallbackUrl?: string
    ) => {
      const current = window.location.hash.replace(/^#/, "");
      if (current && current !== target) historyStack.push(current);
      else if (pathnameRef.current === "/rut") historyStack.push("__rut__");

      const tryFocus = () => focusSection(target, openLink, fallbackUrl);

      if (pathnameRef.current !== "/") {
        router.push(`/#${target}`);
        let attempts = 0;
        const timer = window.setInterval(() => {
          attempts += 1;
          if (tryFocus() || attempts >= 16) window.clearInterval(timer);
        }, 140);
        return;
      }

      if (!tryFocus()) {
        window.setTimeout(tryFocus, 250);
        window.setTimeout(tryFocus, 700);
      }
    };

    const applyEvent = (event: AgentEvent) => {
      switch (event.action) {
        case "navigate":
        case "highlight":
        case "describe": {
          const target = event.target;
          if (!target) return;
          const openLink = Boolean(event.payload?.openLink);
          const url = event.payload?.url
            ? String(event.payload.url)
            : undefined;
          // Close previous embed if we're jumping to another in-page section without a link
          if (!openLink && resourceViewerIsOpen()) {
            closeResourceViewer();
          }
          goToSection(target, openLink, url);
          if (openLink && url && !findSectionEl(target)) {
            openUrl(url, true, { sectionId: target });
          }
          break;
        }
        case "scroll": {
          const direction = String(
            event.target ?? event.payload?.direction ?? "down"
          );
          const amount = Number(event.payload?.amount ?? 700);
          if (direction === "top") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else if (direction === "bottom") {
            window.scrollTo({
              top: document.documentElement.scrollHeight,
              behavior: "smooth",
            });
          } else if (direction === "up") {
            window.scrollBy({ top: -amount, behavior: "smooth" });
          } else {
            window.scrollBy({ top: amount, behavior: "smooth" });
          }
          break;
        }
        case "go_home": {
          closeResourceViewer();
          historyStack.push(
            pathnameRef.current === "/rut"
              ? "__rut__"
              : window.location.hash.replace(/^#/, "") || "__home__"
          );
          router.push("/");
          window.setTimeout(() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }, 200);
          break;
        }
        case "go_back": {
          if (resourceViewerIsOpen()) {
            window.dispatchEvent(new CustomEvent("demo:resource-back"));
            break;
          }
          const prev = historyStack.pop();
          if (prev === "__rut__") {
            router.push("/rut");
          } else if (prev && prev !== "__home__") {
            goToSection(prev);
            historyStack.pop();
          } else if (pathnameRef.current !== "/") {
            router.push("/");
          } else {
            window.history.back();
          }
          break;
        }
        case "go_forward": {
          if (resourceViewerIsOpen()) {
            window.dispatchEvent(new CustomEvent("demo:resource-forward"));
          }
          break;
        }
        case "open_rut": {
          closeResourceViewer();
          router.push("/rut");
          if (event.payload?.openExternal) {
            openUrl("https://sia.mendoza.gov.ar/account/login", true, {
              title: "SIA oficial",
              sectionId: "rut",
            });
          }
          break;
        }
        case "rut_set_step": {
          const step = event.target ?? String(event.payload?.step ?? "1");
          window.dispatchEvent(
            new CustomEvent("demo:rut-set-step", {
              detail: { step: Number(step) },
            })
          );
          if (pathnameRef.current !== "/rut") {
            router.push(`/rut?step=${step}`);
          }
          break;
        }
        case "rut_focus_field": {
          const field = event.target ?? String(event.payload?.field ?? "");
          window.dispatchEvent(
            new CustomEvent("demo:rut-focus-field", { detail: { field } })
          );
          break;
        }
        case "show_checklist": {
          window.dispatchEvent(
            new CustomEvent("demo:rut-show-checklist", {
              detail: event.payload ?? {},
            })
          );
          if (pathnameRef.current !== "/rut") {
            router.push("/rut?step=4");
          } else {
            window.dispatchEvent(
              new CustomEvent("demo:rut-set-step", { detail: { step: 4 } })
            );
          }
          break;
        }
        case "fill_form": {
          const step = Number(event.payload?.step ?? 1);
          const runFill = () => {
            window.dispatchEvent(
              new CustomEvent("demo:rut-fill", {
                detail: {
                  fields: event.payload?.fields ?? {},
                  mode: event.payload?.mode ?? "auto",
                  step,
                },
              })
            );
          };
          if (pathnameRef.current !== "/rut") {
            router.push(`/rut?step=${step || 1}`);
            window.setTimeout(runFill, 550);
          } else {
            runFill();
          }
          break;
        }
        case "ask_confirm": {
          if (pathnameRef.current !== "/rut") router.push("/rut");
          break;
        }
        case "open_external": {
          const url = event.target || String(event.payload?.url ?? "");
          const sectionId = event.payload?.sectionId
            ? String(event.payload.sectionId)
            : undefined;
          const title = event.payload?.title
            ? String(event.payload.title)
            : sectionId
              ? `Oficial · ${sectionId}`
              : "Recurso oficial";
          if (sectionId) {
            goToSection(sectionId, false);
          }
          if (url) {
            // Always real tab for gobierno sites — never blank iframe wall
            openUrl(url, true, {
              sectionId,
              title,
              forceTab: true,
            });
          }
          break;
        }
        default:
          break;
      }
    };

    const es = new EventSource(
      `/api/agent/events?sessionId=${encodeURIComponent(sessionId)}`
    );

    es.addEventListener("agent", (msg) => {
      try {
        const data = JSON.parse((msg as MessageEvent).data) as AgentEvent;
        applyEvent(data);
      } catch {
        // ignore malformed
      }
    });

    const onLocal = (msg: Event) => {
      const data = (msg as CustomEvent<AgentEvent>).detail;
      if (data?.action) applyEvent(data);
    };
    window.addEventListener("demo:agent-event", onLocal);

    return () => {
      es.close();
      window.removeEventListener("demo:agent-event", onLocal);
    };
  }, [sessionId, router]);

  useEffect(() => {
    if (!sessionId) return;
    if (window.DograhWidget?.setContext) {
      window.DograhWidget.setContext({
        session_id: sessionId,
        current_page: pathname,
      });
    }
  }, [pathname, sessionId]);

  if (!sessionId) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-[15rem] rounded-2xl border border-white/50 bg-white/95 px-3 py-2.5 text-xs text-slate-600 shadow-xl backdrop-blur-xl">
      <p className="font-semibold text-mza-blue">Demo en vivo · GABI B</p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
        Bot a la derecha · oficiales en otra pestaña · yo sigo acá
      </p>
    </div>
  );
}
