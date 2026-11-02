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
import { getExtensionApi } from "./ext";

export const SETTINGS_DEFAULTS = {
  showCartButton: true,
  showTrackCartButtons: true,
};

export type Settings = typeof SETTINGS_DEFAULTS;

export const SETTING_KEYS = Object.keys(SETTINGS_DEFAULTS) as (keyof Settings)[];

export const toSettings = (items: Record<string, unknown>): Settings => {
  const settings = { ...SETTINGS_DEFAULTS };
  for (const key of SETTING_KEYS) {
    const value = items[key];
    if (typeof value === "boolean") settings[key] = value;
  }
  return settings;
};

export const loadSettings = async (): Promise<Settings> => {
  const api = getExtensionApi();
  if (!api) return SETTINGS_DEFAULTS;
  try {
    return toSettings(await api.storage.sync.get(SETTINGS_DEFAULTS));
  } catch {
    return SETTINGS_DEFAULTS;
  }
};

export const saveSetting = (key: keyof Settings, value: boolean): void => {
  void getExtensionApi()?.storage.sync.set({ [key]: value });
};

export const onSettingsChanged = (cb: (settings: Settings) => void): void => {
  getExtensionApi()?.storage.onChanged.addListener((_changes, areaName) => {
    if (areaName === "sync") void loadSettings().then(cb);
  });
};
