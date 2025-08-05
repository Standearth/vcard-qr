import {
  Mode,
  MODES,
  TabState,
  DEFAULT_ADVANCED_OPTIONS,
  TAB_SPECIFIC_DEFAULTS,
} from '../config/constants';

const tabStates: { [key in Mode]?: TabState } = {};
const pixelMultipliers: { [key in Mode]?: number } = {};

export function initializeState(): void {
  for (const key in MODES) {
    const mode = MODES[key as keyof typeof MODES];
    const defaults = DEFAULT_ADVANCED_OPTIONS;
    const specifics = TAB_SPECIFIC_DEFAULTS[mode] || {};

    tabStates[mode] = {
      ...defaults,
      ...specifics,
      qrOptions: { ...defaults.qrOptions, ...(specifics.qrOptions || {}) },
      dotsOptions: {
        ...defaults.dotsOptions,
        ...(specifics.dotsOptions || {}),
      },
      cornersSquareOptions: {
        ...defaults.cornersSquareOptions,
        ...(specifics.cornersSquareOptions || {}),
      },
      cornersDotOptions: {
        ...defaults.cornersDotOptions,
        ...(specifics.cornersDotOptions || {}),
      },
      backgroundOptions: {
        ...defaults.backgroundOptions,
        ...(specifics.backgroundOptions || {}),
      },
      imageOptions: {
        ...defaults.imageOptions,
        ...(specifics.imageOptions || {}),
      },
    } as TabState;
    pixelMultipliers[mode] = 0;
  }
}

export const getTabState = (mode: Mode): TabState | undefined =>
  tabStates[mode];
export const updateTabState = (mode: Mode, newState: TabState) => {
  tabStates[mode] = newState;
};

export const getPixelMultiplier = (mode: Mode): number =>
  pixelMultipliers[mode] || 0;
export const setPixelMultiplier = (mode: Mode, multiplier: number) => {
  pixelMultipliers[mode] = multiplier;
};
