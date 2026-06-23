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
interface ChromeStorageArea {
  get: (defaults: Record<string, unknown>, cb: (items: Record<string, unknown>) => void) => void;
  set: (items: Record<string, unknown>) => void;
}
declare const chrome: { storage?: { sync: ChromeStorageArea } } | undefined;

const SETTINGS_DEFAULTS = { showCartButton: true };

const getSetting = <K extends keyof typeof SETTINGS_DEFAULTS>(
  key: K,
  cb: (value: (typeof SETTINGS_DEFAULTS)[K]) => void
): void => {
  try {
    chrome?.storage?.sync.get(SETTINGS_DEFAULTS, (items) => {
      cb(items[key] as (typeof SETTINGS_DEFAULTS)[K]);
    });
  } catch {
    cb(SETTINGS_DEFAULTS[key]);
  }
};

const getAudioElement = (): HTMLAudioElement | null => {
  return document.querySelector("audio[src*='bcbits.com']");
};

// ---------------------------------------------------------------------------
// Icons (inline SVG instead of emoji: extension content scripts often lack a
// color-emoji font and silently render emoji as invisible monochrome glyphs)
// ---------------------------------------------------------------------------

const icon = (pathD: string): string =>
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:block;"><path d="${pathD}"/></svg>`;

const ICONS = {
  cart: icon(
    "M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12L8.1 13h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"
  ),
  check: icon("M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"),
};

// ---------------------------------------------------------------------------
// Tralbum data helpers
// ---------------------------------------------------------------------------


interface TralbumCurrent {
  minimum_price: number | null;
  set_price: number | null;
  title: string;
  band_id: number;
  id: number;
  currency?: string;
}

interface TralbumData {
  item_type: string;
  current: TralbumCurrent;
  trackinfo?: { title_link?: string }[];
}

const getTralbumData = (): TralbumData | null => {
  const el = document.querySelector<HTMLElement>("[data-tralbum]");
  if (!el) return null;
  try {
    return JSON.parse(el.dataset.tralbum!) as TralbumData;
  } catch (e) {
    return null;
  }
};


// ---------------------------------------------------------------------------
// Buy-link replacement on album pages
// ---------------------------------------------------------------------------

interface TrackData {
  minimum_price: number | null;
  item_id: number;
  band_id: number;
  item_title: string;
  currency: string | null;
}

const fetchTrackData = async (path: string): Promise<TrackData | null> => {
  try {
    const res = await fetch(path);
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "text/html");
    const el = doc.querySelector<HTMLElement>("[data-tralbum]");
    if (!el) return null;
    const data = JSON.parse(el.dataset.tralbum!) as TralbumData;
    // The item currency isn't in the tralbum JSON; it's the band's selling
    // currency, exposed via the currency-data script's data-band-currency.
    const currency =
      doc.querySelector("[data-band-currency]")?.getAttribute("data-band-currency") ??
      data.current.currency ??
      null;
    return {
      minimum_price: data.current.minimum_price,
      item_id: data.current.id,
      band_id: data.current.band_id,
      item_title: data.current.title,
      currency,
    };
  } catch {
    return null;
  }
};

// Routes the add through Bandcamp's own main-world cart (Sidecart.add_to_cart)
// via a CustomEvent the bridge script (bridge.ts, injected in the page's main
// world) listens for. Going through their controller keeps their cart model,
// sidecart rendering, and show/hide animation fully in sync, so native delete
// works on our items too. The payload mirrors the object Bandcamp's own buy
// button passes, so the optimistic row renders with the right title and price.
// See bridge.ts.
interface CartItemInput {
  itemId: number;
  bandId: number;
  price: number;
  itemTitle: string;
  currency: string | null;
}

const requestAddToCart = (item: CartItemInput): void => {
  const payload = {
    checkout_now: false,
    item_title: item.itemTitle,
    item_title2: null,
    item_type: "t",
    item_id: item.itemId,
    has_download: true,
    band_id: item.bandId,
    artist_name: null,
    unit_price: item.price,
    currency: item.currency,
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
  };
  document.dispatchEvent(
    new CustomEvent("bcutils-add-to-cart", { detail: JSON.stringify(payload) })
  );
};

const getEffectiveColors = (start: Element): { background: string; color: string } => {
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

const replaceBuyLinks = (): void => {
  const data = getTralbumData();
  if (!data || !data.trackinfo) return;

  document.querySelectorAll("td.download-col .dl_link").forEach((cell) => {
    const link = cell.querySelector("a");
    if (!link) return;

    const href = link.getAttribute("href")?.split("?")[0] ?? "";
    const { background, color } = getEffectiveColors(cell);
    const borderColor = `color-mix(in srgb, ${color} 35%, ${background})`;

    const wrapper = document.createElement("span");
    wrapper.style.cssText = `display:inline-flex; align-items:center; gap:4px; font-family:inherit; color:${color};`;

    const priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.min = "0";
    priceInput.step = "0.01";
    priceInput.value = "";
    priceInput.placeholder = "…";
    priceInput.style.cssText = `
      appearance: none;
      -webkit-appearance: none;
      width: 48px;
      font-family: inherit;
      font-size: 0.85em;
      color: ${color};
      background-color: ${background};
      border: 1px solid ${borderColor};
      border-radius: 2px;
      padding: 1px 4px;
    `;

    const cartBtn = document.createElement("button");
    cartBtn.innerHTML = ICONS.cart;
    cartBtn.title = "Add to cart";
    cartBtn.style.cssText = `
      display: inline-flex;
      align-items: center;
      background-color: ${background};
      border: 1px solid ${borderColor};
      border-radius: 2px;
      cursor: pointer;
      color: ${color};
      padding: 2px 4px;
      line-height: 1;
    `;
    let trackData: TrackData | null = null;

    cartBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const price = parseFloat(priceInput.value);
      if (isNaN(price) || !trackData) return;
      requestAddToCart({
        itemId: trackData.item_id,
        bandId: trackData.band_id,
        price,
        itemTitle: trackData.item_title,
        currency: trackData.currency,
      });
      cartBtn.innerHTML = ICONS.check;
    });

    wrapper.appendChild(priceInput);
    wrapper.appendChild(cartBtn);
    cell.innerHTML = "";
    cell.appendChild(wrapper);

    fetchTrackData(href).then((data) => {
      if (data) {
        trackData = data;
        if (data.minimum_price != null) {
          priceInput.min = String(data.minimum_price);
          priceInput.value = String(data.minimum_price);
        }
      }
    });
  });
};

// ---------------------------------------------------------------------------
// Player UI
// ---------------------------------------------------------------------------

const createIconButton = (svg: string, onClick: () => void): HTMLButtonElement => {
  const button = document.createElement("button");
  button.innerHTML = svg;
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
  button.onclick = onClick;
  return button;
};

// Bandcamp's native progress bar only scrubs by dragging the tiny thumb. Add
// single-click-to-seek on .progbar_empty: one click sets audio.currentTime once.
// (Dragging here would set currentTime + play() on every pointermove, restarting
// playback repeatedly and fighting Bandcamp's own thumb drag.)
// Show the pointer cursor over the whole seek bar — including the fill and thumb,
// which otherwise keep their own cursor and make it flicker back to the default.
const setSeekCursor = (track: HTMLElement): void => {
  track.style.cursor = "pointer";
  track.querySelectorAll<HTMLElement>(".progbar_fill, .thumb").forEach((el) => {
    el.style.cursor = "pointer";
  });
};

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

// The fixed bottom bar: a persistent, always-in-DOM container that holds a clone
// of the native player. Because it's always present (just translated off-screen),
// toggling the transform animates reliably instead of popping in.
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

// Forwards clicks on a cloned control to Bandcamp's real control so playback,
// prev/next etc. all run through their native handlers.
const proxyClick = (cloneEl: Element | null, original: Element | null): void => {
  if (!cloneEl || !original) return;
  cloneEl.addEventListener("click", (e) => {
    // Stop the clone's own click from also reaching Bandcamp's delegated handlers
    // (the clone still carries .inline_player/.playbutton classes), which would
    // double-toggle playback and desync the two players.
    e.preventDefault();
    e.stopImmediatePropagation();
    (original as HTMLElement).click();
  });
};

// Keeps the cloned player visually in sync with the live one: progress fill,
// thumb position, elapsed/total time, and the play/pause button state. While the
// user is dragging the clone's bar, progress updates are skipped so the mirror
// doesn't fight the drag preview.
const mirrorPlayer = (
  clone: HTMLElement,
  existingPlayer: HTMLElement,
  isDragging: () => boolean
): void => {
  const sync = (): void => {
    if (!isDragging()) {
      const oFill = existingPlayer.querySelector<HTMLElement>(".progbar_fill");
      const cFill = clone.querySelector<HTMLElement>(".progbar_fill");
      const oThumb = existingPlayer.querySelector<HTMLElement>(".thumb");
      const cThumb = clone.querySelector<HTMLElement>(".thumb");
      // Copy both verbatim. The fill width is a percentage, but the thumb's `left`
      // is in PIXELS relative to the bar width, so the clone's bar must keep the
      // original's width for the thumb to line up (no width override).
      if (oFill && cFill) cFill.style.width = oFill.style.width;
      if (oThumb && cThumb) cThumb.style.left = oThumb.style.left;
    }
    const copyText = (sel: string): void => {
      const o = existingPlayer.querySelector(sel);
      const c = clone.querySelector(sel);
      if (o && c) c.textContent = o.textContent;
    };
    copyText(".time_elapsed");
    copyText(".time_total");
    copyText(".title");
    // The title link's href/visibility also change as the playing track changes.
    const oTitleLink = existingPlayer.querySelector<HTMLAnchorElement>(".title_link");
    const cTitleLink = clone.querySelector<HTMLAnchorElement>(".title_link");
    if (oTitleLink && cTitleLink) cTitleLink.href = oTitleLink.href;
    const oTitleSection = existingPlayer.querySelector(".title-section");
    const cTitleSection = clone.querySelector(".title-section");
    if (oTitleSection && cTitleSection) cTitleSection.className = oTitleSection.className;
    const oPlay = existingPlayer.querySelector(".playbutton");
    const cPlay = clone.querySelector(".playbutton");
    if (oPlay && cPlay) cPlay.className = oPlay.className;
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

// Builds the bottom bar from a clone of the native player and shows/hides it as
// the original scrolls in/out of view. The original is never touched, so the page
// never jumps.
const wireBottomBar = (
  existingPlayer: HTMLElement,
  bar: HTMLDivElement,
  cartControls: HTMLDivElement | null
): void => {
  const clone = existingPlayer.cloneNode(true) as HTMLElement;
  clone.removeAttribute("data-bcu-wired");
  clone.removeAttribute("id");
  // The native player is a block element; inside our full-width bar it would
  // stretch and render larger than the original. Pin it to the original's width
  // so it matches exactly.
  clone.style.width = `${existingPlayer.getBoundingClientRect().width}px`;
  clone.style.flex = "0 0 auto";

  bar.appendChild(clone);
  if (cartControls) {
    cartControls.style.position = "absolute";
    cartControls.style.right = "16px";
    cartControls.style.top = "50%";
    cartControls.style.transform = "translateY(-50%)";
    bar.appendChild(cartControls);
  }
  // Append inside the player's own parent so the clone inherits Bandcamp's scoped
  // CSS and renders identically (a clone under <body> loses those styles).
  existingPlayer.parentElement?.appendChild(bar);

  // Drag-to-scrub on the clone: preview the thumb/fill while dragging and commit
  // the seek once on release (the clone has no jQuery draggable like the original,
  // and a click without moving seeks to that point too).
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
    // Center the thumb on the cursor (its `left` is the left edge, so offset by
    // half its width) — otherwise the thumb sits to the right of the click.
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

  // Reserve space so the page footer clears the bar. We pad the footer itself
  // rather than the body, because Bandcamp manages body padding (has-rec-footer /
  // has-corpbanner2) and overwrites ours. The footer lives in the <page-footer>
  // custom element's (open) shadow DOM, so reach it via shadowRoot. A spacer at
  // the end of <body> is the fallback if the footer isn't found.
  const footerEl =
    document.querySelector("page-footer")?.shadowRoot?.querySelector<HTMLElement>("#page-footer") ??
    null;
  const spacer = document.createElement("div");
  if (!footerEl) document.body.appendChild(spacer);

  let shown = false;
  const reserveSpace = (): void => {
    // Match the bar's real height plus a small buffer (the cloned player can
    // render a touch taller than the bar's content box). ResizeObserver also
    // calls this so late layout from sprite icons/fonts stays in sync.
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

// Add-to-cart control for the bottom bar: price field + 🛒 that buys the track
// CURRENTLY PLAYING. The playing track changes as the album advances, so we track
// the player's .title_link and re-fetch that track's data (id/price/title) on
// change, mirroring the per-line buy buttons.
const createTrackCartControls = (existingPlayer: HTMLElement): HTMLDivElement => {
  const { background, color } = getEffectiveColors(existingPlayer);
  const borderColor = `color-mix(in srgb, ${color} 35%, ${background})`;

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex; align-items:center; gap:4px; margin-left:8px; font-family:inherit;";

  const priceInput = document.createElement("input");
  priceInput.type = "number";
  priceInput.step = "0.01";
  priceInput.style.cssText = `
    appearance: none;
    -webkit-appearance: none;
    width: 48px;
    font-family: inherit;
    font-size: 0.85em;
    color: ${color};
    background-color: ${background};
    border: 1px solid ${borderColor};
    border-radius: 2px;
    padding: 1px 4px;
  `;

  let trackData: TrackData | null = null;

  const cartBtn = createIconButton(ICONS.cart, () => {
    const price = parseFloat(priceInput.value);
    if (isNaN(price) || !trackData) return;
    requestAddToCart({
      itemId: trackData.item_id,
      bandId: trackData.band_id,
      price,
      itemTitle: trackData.item_title,
      currency: trackData.currency,
    });
    cartBtn.innerHTML = ICONS.check;
  });
  cartBtn.title = "Add to cart";

  let lastPath = "";
  const resolveCurrentTrack = async (): Promise<void> => {
    const link = existingPlayer.querySelector<HTMLAnchorElement>(".title_link");
    const path = link?.getAttribute("href") ?? window.location.pathname;
    if (path === lastPath) return;
    lastPath = path;
    cartBtn.innerHTML = ICONS.cart; // reset the ✓ when the track changes
    const data = await fetchTrackData(path);
    if (!data || path !== lastPath) return;
    trackData = data;
    const minPrice = data.minimum_price ?? 0;
    priceInput.min = String(minPrice);
    priceInput.value = String(minPrice);
  };
  resolveCurrentTrack();
  // The player updates the title link (href/text) as it advances through tracks.
  new MutationObserver(() => resolveCurrentTrack()).observe(existingPlayer, {
    subtree: true,
    attributes: true,
    attributeFilter: ["href"],
    childList: true,
    characterData: true,
  });

  wrapper.append(priceInput, cartBtn);
  return wrapper;
};

const createToolbar = (): void => {
  const existingPlayer = document.querySelector<HTMLElement>(".inline_player");
  if (!existingPlayer || existingPlayer.dataset.bcuWired) return;
  existingPlayer.dataset.bcuWired = "1";

  enableNativeSeek(existingPlayer);

  getSetting("showCartButton", (showCartButton) => {
    const cartControls = showCartButton ? createTrackCartControls(existingPlayer) : null;
    const bar = createBottomBar(existingPlayer);
    wireBottomBar(existingPlayer, bar, cartControls);
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    createToolbar();
    replaceBuyLinks();
  });
} else {
  createToolbar();
  replaceBuyLinks();
}

export {};
