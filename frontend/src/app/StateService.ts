// src/app/StateService.ts

import {
  Mode,
  MODES,
  TabState,
  DEFAULT_ADVANCED_OPTIONS,
  TAB_SPECIFIC_DEFAULTS,
  DEFAULT_FORM_FIELDS,
} from '../config/constants';
import { UIManager } from './UIManager';
import { generateQRCodeData } from '../utils/helpers'; // Import the helper

/**
 * Manages the application's state. It is the single source of truth for all tab states
 * and UI-related data. It ensures that state changes are centralized and predictable.
 */
class StateService {
  private tabStates: Partial<Record<Mode, TabState>> = {};
  private pixelMultipliers: Partial<Record<Mode, number>> = {};
  private uiManager!: UIManager;
  private subscribers: (() => void)[] = []; // Array of subscriber callbacks

  /**
   * Initializes the default state for all modes when the service is instantiated.
   */
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
        showImage: specifics.showImage ?? defaults.showImage,
        isAdvancedControlsVisible: false,
        isModalVisible: false,
        qrCodeContent: '',
        isQrCodeValid: true,
      } as TabState;
      this.pixelMultipliers[mode] = 0;
    }
  }

  /**
   * Initializes the StateService with the UIManager instance.
   * This must be called once at application startup to connect the state to the UI.
   * @param uiManager The UIManager instance responsible for rendering the UI.
   */
  public initialize(uiManager: UIManager): void {
    this.uiManager = uiManager;
  }

  /**
   * Retrieves the current state for a given mode.
   * @param mode The tab mode ('vcard', 'link', 'wifi') to get the state for.
   * @returns The state object for the given mode, or undefined if not found.
   */
  public getState(mode: Mode): TabState | undefined {
    return this.tabStates[mode];
  }

  public subscribe(callback: () => void): void {
    this.subscribers.push(callback);
  }

  /**
   * Updates the state for a given mode and triggers a UI re-render.
   * @param mode The tab mode to update.
   * @param newState A partial state object containing the properties to update.
   */
  public updateState(mode: Mode, newState: Partial<TabState>): void {
    const currentState = this.getState(mode);
    if (currentState) {
      const updatedState = { ...currentState, ...newState };

      updatedState.qrCodeContent = generateQRCodeData(updatedState, mode);

      this.tabStates[mode] = updatedState;

      this.uiManager.renderUIFromState(this.getState(mode)!);

      // Notify all subscribers of the state change
      this.subscribers.forEach((callback) => callback());
    }
  }

  /**
   * Gets the pixel multiplier used for QR code size optimization.
   * @param mode The tab mode for which to get the multiplier.
   * @returns The current pixel multiplier.
   */
  public getPixelMultiplier(mode: Mode): number {
    return this.pixelMultipliers[mode] || 0;
  }

  /**
   * Sets the pixel multiplier for QR code size optimization.
   * @param mode The tab mode for which to set the multiplier.
   * @param multiplier The new pixel multiplier value.
   */
  public setPixelMultiplier(mode: Mode, multiplier: number): void {
    this.pixelMultipliers[mode] = multiplier;
  }
}

export const stateService = new StateService();
