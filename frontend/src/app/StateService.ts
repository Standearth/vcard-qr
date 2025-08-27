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

// Define a specific type for the subscriber callback
type StateSubscriber = (newState: TabState, oldState: TabState) => void;

/**
 * Manages the application's state. It is the single source of truth for all tab states
 * and UI-related data. It ensures that state changes are centralized and predictable.
 */
class StateService {
  private formState: Partial<TabState> = {}; // Shared content state
  private tabStates: Partial<Record<Mode, TabState>> = {}; // Tab-specific config state
  private pixelMultipliers: Partial<Record<Mode, number>> = {};
  private uiManager!: UIManager;
  private subscribers: StateSubscriber[] = []; // Array of subscriber callbacks

  /**
   * Initializes the default state for all modes when the service is instantiated.
   */
  constructor() {
    // Initialize the shared form content state
    this.formState = { ...DEFAULT_FORM_FIELDS };

    // Initialize the tab-specific configuration states
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

  /**
   * Initializes the StateService with the UIManager instance.
   * This must be called once at application startup to connect the state to the UI.
   * @param uiManager The UIManager instance responsible for rendering the UI.
   */
  public initialize(uiManager: UIManager): void {
    this.uiManager = uiManager;
  }

  /**
   * Retrieves the current state for a given mode, merged with the shared form state.
   * @param mode The tab mode ('vcard', 'link', 'wifi') to get the state for.
   * @returns The combined state object for the given mode, or undefined if not found.
   */
  public getState(mode: Mode): TabState | undefined {
    const tabState = this.tabStates[mode];
    if (tabState) {
      return { ...this.formState, ...tabState };
    }
    return undefined;
  }

  public subscribe(callback: StateSubscriber): void {
    this.subscribers.push(callback);
  }

  /**
   * Updates the state for a given mode and triggers a UI re-render.
   * @param mode The tab mode to update.
   * @param newState A partial state object containing the properties to update.
   */
  public updateState(
    mode: Mode,
    newState: Partial<TabState>,
    _activeElement?: HTMLElement
  ): void {
    const oldState = this.getState(mode);
    const currentTabState = this.tabStates[mode];
    if (currentTabState) {
      // Separate the incoming state changes into formState and tabState
      const newFormState: Partial<TabState> = {};
      const newTabState: Partial<TabState> = {};

      // Separate shared and tab-specific properties
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

      this.uiManager.renderUIFromState(finalState);

      // Notify all subscribers of the state change
      this.subscribers.forEach((callback) => callback(finalState, oldState!));
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
