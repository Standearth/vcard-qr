// frontend/src/app/StateService.ts

import {
  DotType,
  CornerSquareType,
  CornerDotType,
  Options, // Keep this for type definitions
} from 'qr-code-styling';
import {
  Mode,
  MODES,
  TabState,
  DEFAULT_ADVANCED_OPTIONS,
  TAB_SPECIFIC_DEFAULTS,
  DEFAULT_FORM_FIELDS,
  Preset,
} from '../config/constants';
import { UIManager } from './UIManager';
import { generateQRCodeData } from '../utils/helpers';

class StateService {
  private formState: Partial<TabState> = {};
  private tabStates: Partial<Record<Mode, TabState>> = {};
  private pixelMultipliers: Partial<Record<Mode, number>> = {};
  private uiManager!: UIManager;
  private subscribers: ((newState: TabState, oldState: TabState) => void)[] =
    [];

  constructor() {
    this.formState = { ...DEFAULT_FORM_FIELDS };
    for (const mode of Object.values(MODES)) {
      const defaults = DEFAULT_ADVANCED_OPTIONS;
      const specifics = TAB_SPECIFIC_DEFAULTS[mode] || {};
      this.tabStates[mode] = {
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
        showImage: specifics.showImage ?? defaults.showImage,
        isAdvancedControlsVisible: false,
        isModalVisible: false,
        qrCodeContent: '',
        isQrCodeValid: true,
      } as TabState;
      this.pixelMultipliers[mode] = 0;
    }
  }

  public initialize(uiManager: UIManager): void {
    this.uiManager = uiManager;
  }

  /**
   * Applies a preset's settings to all existing tab states as a base override.
   * This method correctly maps flat preset keys to the nested state structure,
   * only updating values that are explicitly defined in the preset.
   * @param preset A partial state object containing the properties to override.
   */
  public applyPresetOverrides(preset: Preset): void {
    const presetOverrides: Partial<TabState> = {
      ...preset,
    };

    // --- CORRECTED AND TYPE-SAFE LOGIC ---
    const dotsOptions: Partial<Options['dotsOptions']> = {};
    if (preset.dotsType) dotsOptions.type = preset.dotsType as DotType;
    if (preset.dotsColor) dotsOptions.color = preset.dotsColor as string;
    if (Object.keys(dotsOptions).length > 0) {
      presetOverrides.dotsOptions = dotsOptions;
    }

    const cornersSquareOptions: Partial<Options['cornersSquareOptions']> = {};
    if (preset.cornersSquareType)
      cornersSquareOptions.type = preset.cornersSquareType as CornerSquareType;
    if (preset.cornersSquareColor)
      cornersSquareOptions.color = preset.cornersSquareColor as string;
    if (Object.keys(cornersSquareOptions).length > 0) {
      presetOverrides.cornersSquareOptions = cornersSquareOptions;
    }

    const cornersDotOptions: Partial<Options['cornersDotOptions']> = {};
    if (preset.cornersDotType)
      cornersDotOptions.type = preset.cornersDotType as CornerDotType;
    if (preset.cornersDotColor)
      cornersDotOptions.color = preset.cornersDotColor as string;
    if (Object.keys(cornersDotOptions).length > 0) {
      presetOverrides.cornersDotOptions = cornersDotOptions;
    }

    const imageOptions: Partial<Options['imageOptions']> = {};
    if (preset.imageSize) imageOptions.imageSize = Number(preset.imageSize);
    if (preset.imageMargin) imageOptions.margin = Number(preset.imageMargin);
    if (Object.keys(imageOptions).length > 0) {
      presetOverrides.imageOptions = imageOptions;
    }

    for (const mode in this.tabStates) {
      if (Object.prototype.hasOwnProperty.call(this.tabStates, mode)) {
        const typedMode = mode as Mode;
        const currentTabState = this.tabStates[typedMode];

        if (currentTabState) {
          this.tabStates[typedMode] = {
            ...currentTabState,
            ...presetOverrides,
            dotsOptions: {
              ...currentTabState.dotsOptions,
              ...presetOverrides.dotsOptions,
            },
            cornersSquareOptions: {
              ...currentTabState.cornersSquareOptions,
              ...presetOverrides.cornersSquareOptions,
            },
            cornersDotOptions: {
              ...currentTabState.cornersDotOptions,
              ...presetOverrides.cornersDotOptions,
            },
            imageOptions: {
              ...currentTabState.imageOptions,
              ...presetOverrides.imageOptions,
            },
          };
        }
      }
    }
  }

  public getState(mode: Mode): TabState | undefined {
    const tabState = this.tabStates[mode];
    if (tabState) {
      return { ...this.formState, ...tabState };
    }
    return undefined;
  }

  public subscribe(
    callback: (newState: TabState, oldState: TabState) => void
  ): void {
    this.subscribers.push(callback);
  }

  public updateState(
    mode: Mode,
    newState: Partial<TabState>,
    activeElement?: HTMLElement
  ): void {
    const oldState = this.getState(mode);
    const currentTabState = this.tabStates[mode];
    if (currentTabState) {
      const newFormState: Partial<TabState> = {};
      const newTabState: Partial<TabState> = {};

      for (const key in newState) {
        const propKey = key as keyof TabState;
        if (propKey in DEFAULT_FORM_FIELDS) {
          (newFormState as Record<string, unknown>)[propKey] =
            newState[propKey];
        } else {
          (newTabState as Record<string, unknown>)[propKey] = newState[propKey];
        }
      }

      this.formState = { ...this.formState, ...newFormState };
      this.tabStates[mode] = { ...currentTabState, ...newTabState };

      const finalState = this.getState(mode)!;
      finalState.qrCodeContent = generateQRCodeData(finalState, mode);

      this.uiManager.renderUIFromState(finalState, activeElement);

      this.subscribers.forEach((callback) => callback(finalState, oldState!));
    }
  }

  public getPixelMultiplier(mode: Mode): number {
    return this.pixelMultipliers[mode] || 0;
  }

  public setPixelMultiplier(mode: Mode, multiplier: number): void {
    this.pixelMultipliers[mode] = multiplier;
  }
}

export const stateService = new StateService();
