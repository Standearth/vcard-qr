// src/app/stateService.ts

import {
  Mode,
  MODES,
  TabState,
  DEFAULT_ADVANCED_OPTIONS,
  TAB_SPECIFIC_DEFAULTS,
  DEFAULT_FORM_FIELDS,
} from '../config/constants';
import { UIManager } from './UIManager';

class StateService {
  private tabStates: Partial<Record<Mode, TabState>> = {};
  private pixelMultipliers: Partial<Record<Mode, number>> = {};
  private uiManager!: UIManager;

  constructor() {
    for (const mode of Object.values(MODES)) {
      const defaults = DEFAULT_ADVANCED_OPTIONS;
      const specifics = TAB_SPECIFIC_DEFAULTS[mode] || {};

      this.tabStates[mode] = {
        ...defaults,
        ...specifics,
        ...DEFAULT_FORM_FIELDS,
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
        showImage: defaults.showImage,
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

  public getState(mode: Mode): TabState | undefined {
    return this.tabStates[mode];
  }

  public updateState(mode: Mode, newState: Partial<TabState>): void {
    const currentState = this.getState(mode);
    if (currentState) {
      this.tabStates[mode] = { ...currentState, ...newState };
      this.uiManager.renderUIFromState(this.getState(mode)!);
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
