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
import { createTrackDataCache, type TrackData } from "./tracks";

// Bandcamp's markup in one place, so a change on their side is a one-file fix.
export const SELECTORS = {
  tralbum: "[data-tralbum]",
  bandCurrency: "[data-band-currency]",
  audio: "audio[src*='bcbits.com']",
  player: ".inline_player",
  progressBar: ".progbar_empty",
  progressFill: ".progbar_fill",
  progressThumb: ".thumb",
  elapsed: ".time_elapsed",
  total: ".time_total",
  title: ".title",
  titleLink: ".title_link",
  titleSection: ".title-section",
  playButton: ".playbutton",
  prevButton: ".prevbutton",
  nextButton: ".nextbutton",
  playControl: ".play_cell a",
  prevControl: ".prev_cell a",
  nextControl: ".next_cell a",
  trackBuyLink: "td.download-col .dl_link",
  footerHost: "page-footer",
  footer: "#page-footer",
} as const;

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
  const raw = root.querySelector<HTMLElement>(SELECTORS.tralbum)?.dataset.tralbum;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TralbumData;
  } catch {
    return null;
  }
};

export const isTralbumPage = (): boolean => Boolean(parseTralbum(document)?.trackinfo);

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
      currency: doc.querySelector(SELECTORS.bandCurrency)?.getAttribute("data-band-currency") ?? null,
    };
  } catch {
    return null;
  }
};

export const getTrackData = createTrackDataCache(fetchTrackData);

export const getAudio = (): HTMLAudioElement | null => document.querySelector(SELECTORS.audio);

export const findFooter = (): HTMLElement | null =>
  document.querySelector(SELECTORS.footerHost)?.shadowRoot?.querySelector<HTMLElement>(SELECTORS.footer) ??
  null;

export type BandcampCartItem = {
  checkout_now: boolean;
  item_title: string;
  item_title2: null;
  item_type: "t";
  item_id: number;
  has_download: boolean;
  band_id: number;
  artist_name: null;
  unit_price: number;
  currency: string | null;
  quantity: number;
  option_id: null;
  option_name: null;
  discount_id: null;
  discount_type: null;
  purchase_note: null;
  notify_me: boolean;
  notify_me_label: boolean;
  releases: null;
  art_id: null;
};

// Mirrors the object Bandcamp's own buy button passes, so their cart renders our row correctly.
export const toCartItem = (track: TrackData, price: number): BandcampCartItem => ({
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
