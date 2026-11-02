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
import { requestAddToCart } from "./cart-events";
import { cachedQuery } from "./dom";
import { loadSettings, onSettingsChanged, type Settings } from "./settings";
import { applyMinimumPrice, createTrackDataCache, toTrackPath, type TrackData } from "./tracks";

const getAudioElement = (): HTMLAudioElement | null => {
  return document.querySelector("audio[src*='bcbits.com']");
};

const ICON_PATHS = {
  cart: "M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12L8.1 13h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z",
  check: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  error:
    "M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z",
};

type IconName = keyof typeof ICON_PATHS;

// Inline SVG, not emoji: content scripts often lack a color-emoji font and render emoji invisible.
const createIcon = (name: IconName): SVGSVGElement => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("fill", "currentColor");
  svg.style.display = "block";
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", ICON_PATHS[name]);
  svg.appendChild(path);
  return svg;
};

interface TralbumData {
  current: {
    minimum_price: number | null;
    title: string;
    band_id: number;
    id: number;
  };
  trackinfo?: unknown[];
}

const parseTralbum = (root: ParentNode): TralbumData | null => {
  const raw = root.querySelector<HTMLElement>("[data-tralbum]")?.dataset.tralbum;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TralbumData;
  } catch {
    return null;
  }
};

const fetchTrackData = async (path: string): Promise<TrackData | null> => {
  try {
    const res = await fetch(path);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const data = parseTralbum(doc);
    if (!data) return null;
    return {
      minimum_price: data.current.minimum_price,
      item_id: data.current.id,
      band_id: data.current.band_id,
      item_title: data.current.title,
      // Not in the tralbum JSON: it's the band's selling currency.
      currency: doc.querySelector("[data-band-currency]")?.getAttribute("data-band-currency") ?? null,
    };
  } catch {
    return null;
  }
};

const getTrackData = createTrackDataCache(fetchTrackData);

// Mirrors the object Bandcamp's own buy button passes, so their cart renders our row correctly.
const toCartItem = (track: TrackData, price: number): Record<string, unknown> => ({
  checkout_now: false,
  item_title: track.item_title,
  item_title2: null,
  item_type: "t",
  item_id: track.item_id,
  has_download: true,
  band_id: track.band_id,
  artist_name: null,
  unit_price: price,
  currency: track.currency,
  quantity: 1,
  option_id: null,
  option_name: null,
  discount_id: null,
  discount_type: null,
  purchase_note: null,
  notify_me: false,
  notify_me_label: false,
  releases: null,
  art_id: null,
});

interface Colors {
  background: string;
  color: string;
}

const getEffectiveColors = (start: Element): Colors => {
  const isTransparent = (value: string): boolean =>
    value === "transparent" || value === "rgba(0, 0, 0, 0)";

  let el: Element | null = start;
  let background = "rgb(0, 0, 0)";
  while (el) {
    const bg = getComputedStyle(el).backgroundColor;
    if (!isTransparent(bg)) {
      background = bg;
      break;
    }
    el = el.parentElement;
  }

  return { background, color: getComputedStyle(start).color };
};

const borderColorFor = ({ background, color }: Colors): string =>
  `color-mix(in srgb, ${color} 35%, ${background})`;

const createPriceInput = (colors: Colors): HTMLInputElement => {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "0.01";
  input.required = true;
  input.placeholder = "…";
  input.style.cssText = `
    appearance: none;
    -webkit-appearance: none;
    width: 48px;
    font-family: inherit;
    font-size: 0.85em;
    color: ${colors.color};
    background-color: ${colors.background};
    border: 1px solid ${borderColorFor(colors)};
    border-radius: 2px;
    padding: 1px 4px;
  `;
  return input;
};

const CART_STATES = {
  idle: { icon: "cart", title: "Add to cart" },
  added: { icon: "check", title: "Added to cart" },
  error: { icon: "error", title: "Couldn't add to cart" },
} satisfies Record<string, { icon: IconName; title: string }>;

const setCartState = (button: HTMLButtonElement, state: keyof typeof CART_STATES): void => {
  button.replaceChildren(createIcon(CART_STATES[state].icon));
  button.title = CART_STATES[state].title;
};

const attachAddToCart = (
  button: HTMLButtonElement,
  input: HTMLInputElement,
  loadTrack: () => Promise<TrackData | null>
): void => {
  setCartState(button, "idle");
  let pending = false;
  button.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (pending) return;
    pending = true;
    try {
      const track = await loadTrack();
      if (!track) {
        setCartState(button, "error");
        return;
      }
      applyMinimumPrice(input, track);
      if (!input.reportValidity()) return;
      const added = await requestAddToCart(document, toCartItem(track, input.valueAsNumber));
      setCartState(button, added ? "added" : "error");
    } finally {
      pending = false;
    }
  });
};

const createRowCartControl = (cell: Element, path: string): HTMLElement => {
  const colors = getEffectiveColors(cell);

  const wrapper = document.createElement("span");
  wrapper.style.cssText = `display:inline-flex; align-items:center; gap:4px; font-family:inherit; color:${colors.color};`;

  const priceInput = createPriceInput(colors);

  const cartBtn = document.createElement("button");
  cartBtn.style.cssText = `
    display: inline-flex;
    align-items: center;
    background-color: ${colors.background};
    border: 1px solid ${borderColorFor(colors)};
    border-radius: 2px;
    cursor: pointer;
    color: ${colors.color};
    padding: 2px 4px;
    line-height: 1;
  `;

  const loadTrack = (): Promise<TrackData | null> => getTrackData(path);
  attachAddToCart(cartBtn, priceInput, loadTrack);

  // Fetched on first hover or focus, so an album page doesn't download every track page up front.
  const prefetch = (): void => {
    void loadTrack().then((data) => {
      if (data) applyMinimumPrice(priceInput, data);
    });
  };
  wrapper.addEventListener("pointerenter", prefetch, { once: true });
  wrapper.addEventListener("focusin", prefetch, { once: true });

  wrapper.append(priceInput, cartBtn);
  return wrapper;
};

interface BuyLinkRow {
  cell: Element;
  path: string;
  original: ChildNode[];
  control: HTMLElement | null;
}

const setupBuyLinks = (): ((enabled: boolean) => void) | null => {
  if (!parseTralbum(document)?.trackinfo) return null;

  const rows: BuyLinkRow[] = [];
  document.querySelectorAll("td.download-col .dl_link").forEach((cell) => {
    const path = toTrackPath(cell.querySelector("a")?.getAttribute("href"), location.href);
    if (path) rows.push({ cell, path, original: Array.from(cell.childNodes), control: null });
  });
  if (!rows.length) return null;

  return (enabled) => {
    for (const row of rows) {
      if (!enabled) {
        // The original nodes, not copies, so Bandcamp's handlers on them survive.
        row.cell.replaceChildren(...row.original);
        continue;
      }
      if (!row.control) row.control = createRowCartControl(row.cell, row.path);
      row.cell.replaceChildren(row.control);
    }
  };
};

const createIconButton = (): HTMLButtonElement => {
  const button = document.createElement("button");
  button.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 30px;
    min-height: 30px;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
  `;
  return button;
};

// The fill and thumb set their own cursor, which flickers back to the default otherwise.
const setSeekCursor = (track: HTMLElement): void => {
  track.style.cursor = "pointer";
  track.querySelectorAll<HTMLElement>(".progbar_fill, .thumb").forEach((el) => {
    el.style.cursor = "pointer";
  });
};

// Click only: seeking on every pointermove restarts playback and fights Bandcamp's own thumb drag.
const enableNativeSeek = (playerEl: Element): void => {
  const bar = playerEl.querySelector<HTMLElement>(".progbar_empty");
  if (!bar) return;
  setSeekCursor(bar);
  bar.addEventListener("click", (e) => {
    const audio = getAudioElement();
    if (!audio || !audio.duration) return;
    const rect = bar.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = fraction * audio.duration;
    audio.play();
  });
};

// Always in the DOM and translated off-screen, so showing it animates instead of popping in.
const createBottomBar = (existingPlayer: Element): HTMLDivElement => {
  const { background, color } = getEffectiveColors(existingPlayer);
  const bar = document.createElement("div");
  bar.id = "new-player";
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

const proxyClick = (cloneEl: Element | null, original: HTMLElement | null): void => {
  if (!cloneEl || !original) return;
  cloneEl.addEventListener("click", (e) => {
    // The clone keeps Bandcamp's classes, so their delegated handlers would toggle playback twice.
    e.preventDefault();
    e.stopImmediatePropagation();
    original.click();
  });
};

const mirrorPlayer = (
  clone: HTMLElement,
  existingPlayer: HTMLElement,
  isDragging: () => boolean
): void => {
  const mirror = <T extends Element>(selector: string, copy: (from: T, to: T) => void) => {
    const from = cachedQuery<T>(existingPlayer, selector);
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
    mirror<HTMLElement>(".progbar_fill", (o, c) => {
      c.style.width = o.style.width;
    }),
    mirror<HTMLElement>(".thumb", (o, c) => {
      c.style.left = o.style.left;
    }),
  ];
  const details = [
    mirror(".time_elapsed", copyText),
    mirror(".time_total", copyText),
    mirror(".title", copyText),
    mirror<HTMLAnchorElement>(".title_link", (o, c) => {
      c.href = o.href;
    }),
    mirror(".title-section", copyClass),
    mirror(".playbutton", copyClass),
  ];

  const sync = (): void => {
    if (!isDragging()) progress.forEach((run) => run());
    details.forEach((run) => run());
  };
  sync();
  const observer = new MutationObserver(sync);
  observer.observe(existingPlayer, {
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class"],
    childList: true,
    characterData: true,
  });
};

// Clones the player instead of moving it, so the page never jumps.
const wireBottomBar = (existingPlayer: HTMLElement, bar: HTMLDivElement): void => {
  const clone = existingPlayer.cloneNode(true) as HTMLElement;
  clone.removeAttribute("data-bcu-wired");
  clone.removeAttribute("id");
  // The mirrored thumb `left` is in pixels, so both bars must be the same width.
  clone.style.width = `${existingPlayer.getBoundingClientRect().width}px`;
  clone.style.flex = "0 0 auto";

  bar.appendChild(clone);
  // Under <body> the clone would lose Bandcamp's scoped CSS.
  existingPlayer.parentElement?.appendChild(bar);

  // The clone has no jQuery draggable, so scrub by hand and seek once on release.
  let dragging = false;
  const cloneTrack = clone.querySelector<HTMLElement>(".progbar_empty");
  const cloneFill = clone.querySelector<HTMLElement>(".progbar_fill");
  const cloneThumb = clone.querySelector<HTMLElement>(".thumb");
  const previewAt = (clientX: number): number => {
    if (!cloneTrack) return 0;
    const rect = cloneTrack.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, clientX - rect.left));
    const fraction = x / rect.width;
    if (cloneFill) cloneFill.style.width = `${fraction * 100}%`;
    if (cloneThumb) cloneThumb.style.left = `${x - cloneThumb.offsetWidth / 2}px`;
    return fraction;
  };
  if (cloneTrack) {
    setSeekCursor(cloneTrack);
    cloneTrack.addEventListener("pointerdown", (e) => {
      dragging = true;
      cloneTrack.setPointerCapture?.(e.pointerId);
      previewAt(e.clientX);
      e.preventDefault();
    });
    cloneTrack.addEventListener("pointermove", (e) => {
      if (dragging) previewAt(e.clientX);
    });
    cloneTrack.addEventListener("pointerup", (e) => {
      if (!dragging) return;
      dragging = false;
      cloneTrack.releasePointerCapture?.(e.pointerId);
      const fraction = previewAt(e.clientX);
      const audio = getAudioElement();
      if (audio && audio.duration) {
        audio.currentTime = fraction * audio.duration;
        audio.play();
      }
    });
  }

  proxyClick(clone.querySelector(".play_cell a"), existingPlayer.querySelector(".playbutton"));
  proxyClick(clone.querySelector(".prev_cell a"), existingPlayer.querySelector(".prevbutton"));
  proxyClick(clone.querySelector(".next_cell a"), existingPlayer.querySelector(".nextbutton"));
  mirrorPlayer(clone, existingPlayer, () => dragging);

  // Pad the footer, not the body: Bandcamp rewrites body padding.
  const footerEl =
    document.querySelector("page-footer")?.shadowRoot?.querySelector<HTMLElement>("#page-footer") ??
    null;
  const spacer = document.createElement("div");
  if (!footerEl) document.body.appendChild(spacer);

  let shown = false;
  const reserveSpace = (): void => {
    // +16 because the cloned player can render a bit taller than the bar's content box.
    const reserve = shown ? `${bar.offsetHeight + 16}px` : "0";
    if (footerEl) footerEl.style.paddingBottom = reserve;
    else spacer.style.height = reserve;
  };
  const setShown = (next: boolean): void => {
    shown = next;
    bar.style.transform = shown ? "translateY(0)" : "translateY(100%)";
    reserveSpace();
  };

  const observer = new IntersectionObserver(
    ([entry]) => setShown(!entry.isIntersecting),
    { threshold: 0 }
  );
  observer.observe(existingPlayer);

  new ResizeObserver(reserveSpace).observe(bar);
};

interface TrackCartControls {
  element: HTMLDivElement;
  setActive: (active: boolean) => void;
}

const createTrackCartControls = (existingPlayer: HTMLElement): TrackCartControls => {
  const colors = getEffectiveColors(existingPlayer);

  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position:absolute; right:16px; top:50%; transform:translateY(-50%); display:flex; align-items:center; gap:4px; font-family:inherit;";

  const priceInput = createPriceInput(colors);
  const cartBtn = createIconButton();

  let active = false;
  // undefined, not null, so the first resolve always runs and sets the disabled state.
  let currentPath: string | null | undefined;

  attachAddToCart(cartBtn, priceInput, () =>
    currentPath ? getTrackData(currentPath) : Promise.resolve(null)
  );

  const resolveCurrentTrack = (): void => {
    // No title link means Bandcamp removed it, or this is a track page and the page is the track.
    const href = existingPlayer.querySelector(".title_link")?.getAttribute("href");
    const path = toTrackPath(href ?? location.pathname, location.href);
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

  // Not the whole player: that would also fire on every elapsed-time tick.
  const titleSection = existingPlayer.querySelector(".title-section") ?? existingPlayer;
  new MutationObserver(() => {
    if (active) resolveCurrentTrack();
  }).observe(titleSection, {
    subtree: true,
    attributes: true,
    attributeFilter: ["href"],
    childList: true,
  });

  wrapper.append(priceInput, cartBtn);
  return {
    element: wrapper,
    setActive: (next) => {
      active = next;
      wrapper.style.display = next ? "flex" : "none";
      if (next) resolveCurrentTrack();
    },
  };
};

const setupPlayer = (): ((showCart: boolean) => void) | null => {
  const existingPlayer = document.querySelector<HTMLElement>(".inline_player");
  if (!existingPlayer || existingPlayer.dataset.bcuWired) return null;
  existingPlayer.dataset.bcuWired = "1";

  enableNativeSeek(existingPlayer);
  const bar = createBottomBar(existingPlayer);
  wireBottomBar(existingPlayer, bar);

  let cart: TrackCartControls | null = null;
  return (showCart) => {
    if (showCart && !cart) {
      cart = createTrackCartControls(existingPlayer);
      bar.appendChild(cart.element);
    }
    cart?.setActive(showCart);
  };
};

const start = async (): Promise<void> => {
  const settings = await loadSettings();
  const setPlayerCart = setupPlayer();
  const setBuyLinks = setupBuyLinks();
  const apply = (next: Settings): void => {
    setPlayerCart?.(next.showCartButton);
    setBuyLinks?.(next.showTrackCartButtons);
  };
  apply(settings);
  onSettingsChanged(apply);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void start());
} else {
  void start();
}
