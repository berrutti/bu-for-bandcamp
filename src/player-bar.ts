/*
 * BU for Bandcamp - Enhance your experience.
 * Copyright (C) 2026 Matias Berrutti
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import { findFooter, getAudio, getTrackData, SELECTORS } from "./bandcamp";
import {
  applyMinimumPrice,
  attachAddToCart,
  createIconButton,
  createPriceInput,
  getEffectiveColors,
  setCartState,
} from "./cart-ui";
import { cachedQuery } from "./dom";
import { toTrackPath } from "./tracks";

const WIRED_ATTRIBUTE = "data-bcu-wired";

const seekTo = (fraction: number): void => {
  const audio = getAudio();
  if (!audio || !audio.duration) return;
  audio.currentTime = fraction * audio.duration;
  // play() rejects when the browser blocks playback; the seek itself has already happened.
  audio.play().catch(() => {});
};

// The fill and thumb set their own cursor, which flickers back to the default otherwise.
const setSeekCursor = (track: HTMLElement): void => {
  track.style.cursor = "pointer";
  track.querySelectorAll<HTMLElement>(`${SELECTORS.progressFill}, ${SELECTORS.progressThumb}`).forEach((el) => {
    el.style.cursor = "pointer";
  });
};

// Click only: seeking on every pointermove restarts playback and fights Bandcamp's own thumb drag.
const enableClickToSeek = (player: Element): void => {
  const bar = player.querySelector<HTMLElement>(SELECTORS.progressBar);
  if (!bar) return;
  setSeekCursor(bar);
  bar.addEventListener("click", (e) => {
    const rect = bar.getBoundingClientRect();
    seekTo(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
  });
};

// Always in the DOM and translated off-screen, so showing it animates instead of popping in.
const createBottomBar = (player: Element): HTMLDivElement => {
  const { background, color } = getEffectiveColors(player);
  const bar = document.createElement("div");
  bar.id = "bu-player-bar";
  bar.style.cssText = `
    position: fixed;
    left: 0;
    bottom: 0;
    width: 100%;
    box-sizing: border-box;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    z-index: 9999;
    background: ${background};
    color: ${color};
    border-top: 1px solid color-mix(in srgb, ${color} 25%, ${background});
    box-shadow: 0 -4px 14px rgba(0, 0, 0, 0.22);
    transform: translateY(100%);
    transition: transform 0.28s ease-out;
  `;
  return bar;
};

// Clones the player instead of moving it, so the page never jumps.
const clonePlayer = (player: HTMLElement): HTMLElement => {
  const clone = player.cloneNode(true) as HTMLElement;
  clone.removeAttribute(WIRED_ATTRIBUTE);
  clone.removeAttribute("id");
  // The mirrored thumb `left` is in pixels, so both bars must be the same width.
  clone.style.width = `${player.getBoundingClientRect().width}px`;
  clone.style.flex = "0 0 auto";
  return clone;
};

// The clone has no jQuery draggable, so scrub by hand and seek once on release.
const enableScrub = (clone: HTMLElement): (() => boolean) => {
  const track = clone.querySelector<HTMLElement>(SELECTORS.progressBar);
  if (!track) return () => false;
  const fill = clone.querySelector<HTMLElement>(SELECTORS.progressFill);
  const thumb = clone.querySelector<HTMLElement>(SELECTORS.progressThumb);
  let dragging = false;

  const previewAt = (clientX: number): number => {
    const rect = track.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, clientX - rect.left));
    const fraction = x / rect.width;
    if (fill) fill.style.width = `${fraction * 100}%`;
    if (thumb) thumb.style.left = `${x - thumb.offsetWidth / 2}px`;
    return fraction;
  };

  setSeekCursor(track);
  track.addEventListener("pointerdown", (e) => {
    dragging = true;
    track.setPointerCapture?.(e.pointerId);
    previewAt(e.clientX);
    e.preventDefault();
  });
  track.addEventListener("pointermove", (e) => {
    if (dragging) previewAt(e.clientX);
  });
  track.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;
    track.releasePointerCapture?.(e.pointerId);
    seekTo(previewAt(e.clientX));
  });
  return () => dragging;
};

const proxyClick = (cloneEl: Element | null, original: HTMLElement | null): void => {
  if (!cloneEl || !original) return;
  cloneEl.addEventListener("click", (e) => {
    // The clone keeps Bandcamp's classes, so their delegated handlers would toggle playback twice.
    e.preventDefault();
    e.stopImmediatePropagation();
    original.click();
  });
};

const proxyControls = (clone: HTMLElement, player: HTMLElement): void => {
  proxyClick(clone.querySelector(SELECTORS.playControl), player.querySelector(SELECTORS.playButton));
  proxyClick(clone.querySelector(SELECTORS.prevControl), player.querySelector(SELECTORS.prevButton));
  proxyClick(clone.querySelector(SELECTORS.nextControl), player.querySelector(SELECTORS.nextButton));
};

const mirrorPlayer = (clone: HTMLElement, player: HTMLElement, isDragging: () => boolean): void => {
  const mirror = <T extends Element>(selector: string, copy: (from: T, to: T) => void) => {
    const from = cachedQuery<T>(player, selector);
    const to = cachedQuery<T>(clone, selector);
    return (): void => {
      const o = from();
      const c = to();
      if (o && c) copy(o, c);
    };
  };
  const copyText = (from: Element, to: Element): void => {
    to.textContent = from.textContent;
  };
  const copyClass = (from: Element, to: Element): void => {
    to.className = from.className;
  };

  const progress = [
    mirror<HTMLElement>(SELECTORS.progressFill, (o, c) => {
      c.style.width = o.style.width;
    }),
    mirror<HTMLElement>(SELECTORS.progressThumb, (o, c) => {
      c.style.left = o.style.left;
    }),
  ];
  const details = [
    mirror(SELECTORS.elapsed, copyText),
    mirror(SELECTORS.total, copyText),
    mirror(SELECTORS.title, copyText),
    mirror<HTMLAnchorElement>(SELECTORS.titleLink, (o, c) => {
      c.href = o.href;
    }),
    mirror(SELECTORS.titleSection, copyClass),
    mirror(SELECTORS.playButton, copyClass),
  ];

  const sync = (): void => {
    if (!isDragging()) progress.forEach((run) => run());
    details.forEach((run) => run());
  };
  sync();
  new MutationObserver(sync).observe(player, {
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class"],
    childList: true,
    characterData: true,
  });
};

// Pads the footer, not the body: Bandcamp rewrites body padding.
const createSpaceReserver = (bar: HTMLElement): ((shown: boolean) => void) => {
  const footer = findFooter();
  const spacer = document.createElement("div");
  if (!footer) document.body.appendChild(spacer);

  let shown = false;
  const reserve = (): void => {
    // +16 because the cloned player can render a bit taller than the bar's content box.
    const space = shown ? `${bar.offsetHeight + 16}px` : "0";
    if (footer) footer.style.paddingBottom = space;
    else spacer.style.height = space;
  };
  new ResizeObserver(reserve).observe(bar);
  return (next) => {
    shown = next;
    reserve();
  };
};

const showWhenPlayerScrollsAway = (player: HTMLElement, bar: HTMLElement): void => {
  const reserveSpace = createSpaceReserver(bar);
  new IntersectionObserver(
    ([entry]) => {
      const shown = !entry.isIntersecting;
      bar.style.transform = shown ? "translateY(0)" : "translateY(100%)";
      reserveSpace(shown);
    },
    { threshold: 0 }
  ).observe(player);
};

const wireBottomBar = (player: HTMLElement, bar: HTMLDivElement): void => {
  const clone = clonePlayer(player);
  bar.appendChild(clone);
  // Under <body> the clone would lose Bandcamp's scoped CSS.
  player.parentElement?.appendChild(bar);

  const isDragging = enableScrub(clone);
  proxyControls(clone, player);
  mirrorPlayer(clone, player, isDragging);
  showWhenPlayerScrollsAway(player, bar);
};

// No title link means Bandcamp removed it, or this is a track page and the page is the track.
const currentTrackPath = (player: HTMLElement): string | null => {
  const href = player.querySelector(SELECTORS.titleLink)?.getAttribute("href");
  return toTrackPath(href ?? location.pathname, location.href);
};

// Not the whole player: that would also fire on every elapsed-time tick.
const onTrackChange = (player: HTMLElement, callback: () => void): void => {
  const titleSection = player.querySelector(SELECTORS.titleSection) ?? player;
  new MutationObserver(callback).observe(titleSection, {
    subtree: true,
    attributes: true,
    attributeFilter: ["href"],
    childList: true,
  });
};

interface TrackCartControls {
  element: HTMLDivElement;
  setActive: (active: boolean) => void;
}

const createTrackCartControls = (player: HTMLElement): TrackCartControls => {
  const colors = getEffectiveColors(player);

  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position:absolute; right:16px; top:50%; transform:translateY(-50%); display:flex; align-items:center; gap:4px; font-family:inherit;";

  const priceInput = createPriceInput(colors);
  const cartBtn = createIconButton();

  let active = false;
  // undefined, not null, so the first update always runs and sets the disabled state.
  let currentPath: string | null | undefined;

  attachAddToCart(cartBtn, priceInput, () =>
    currentPath ? getTrackData(currentPath) : Promise.resolve(null)
  );

  const showTrack = (path: string | null): void => {
    if (path === currentPath) return;
    currentPath = path;
    setCartState(cartBtn, "idle");
    priceInput.value = "";
    priceInput.min = "0";
    priceInput.disabled = cartBtn.disabled = path === null;
    wrapper.style.opacity = path === null ? "0.5" : "";
    if (!path) return;
    void getTrackData(path).then((data) => {
      if (data && path === currentPath) applyMinimumPrice(priceInput, data);
    });
  };

  onTrackChange(player, () => {
    if (active) showTrack(currentTrackPath(player));
  });

  wrapper.append(priceInput, cartBtn);
  return {
    element: wrapper,
    setActive: (next) => {
      active = next;
      wrapper.style.display = next ? "flex" : "none";
      if (next) showTrack(currentTrackPath(player));
    },
  };
};

export const setupPlayer = (): ((showCart: boolean) => void) | null => {
  const player = document.querySelector<HTMLElement>(SELECTORS.player);
  if (!player || player.hasAttribute(WIRED_ATTRIBUTE)) return null;
  player.setAttribute(WIRED_ATTRIBUTE, "1");

  enableClickToSeek(player);
  const bar = createBottomBar(player);
  wireBottomBar(player, bar);

  let cart: TrackCartControls | null = null;
  return (showCart) => {
    if (showCart && !cart) {
      cart = createTrackCartControls(player);
      bar.appendChild(cart.element);
    }
    cart?.setActive(showCart);
  };
};
