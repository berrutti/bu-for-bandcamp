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
export interface TrackData {
  minimum_price: number | null;
  item_id: number;
  band_id: number;
  item_title: string;
  currency: string | null;
}

type TrackFetcher = (path: string) => Promise<TrackData | null>;

export const toTrackPath = (href: string | null | undefined, pageUrl: string): string | null => {
  if (!href) return null;
  try {
    const url = new URL(href, pageUrl);
    if (url.origin !== new URL(pageUrl).origin || !url.pathname.startsWith("/track/")) return null;
    return url.pathname;
  } catch {
    return null;
  }
};

export const createTrackDataCache = (fetcher: TrackFetcher): TrackFetcher => {
  const cache = new Map<string, Promise<TrackData | null>>();
  return (path) => {
    const cached = cache.get(path);
    if (cached) return cached;
    const request = fetcher(path).then((data) => {
      if (!data) cache.delete(path);
      return data;
    });
    cache.set(path, request);
    return request;
  };
};
