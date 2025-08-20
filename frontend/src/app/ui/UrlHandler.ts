// src/app/ui/UrlHandler.ts

import { dom } from '../../config/dom';
import { UIManager } from '../UIManager';
import {
  DEFAULT_FORM_FIELDS,
  TabState,
  DEFAULT_ADVANCED_OPTIONS,
  TAB_SPECIFIC_DEFAULTS,
} from '../../config/constants';

export class UrlHandler {
  private uiManager: UIManager;

  constructor(uiManager: UIManager) {
    this.uiManager = uiManager;
  }

  getStateFromUrl(): Partial<TabState> {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const state: Partial<TabState> = {};

    for (const key in DEFAULT_FORM_FIELDS) {
      const fieldKey = key as keyof typeof DEFAULT_FORM_FIELDS;
      const paramName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      const urlValue = params.get(paramName);

      if (urlValue !== null) {
        if (typeof DEFAULT_FORM_FIELDS[fieldKey] === 'boolean') {
          (state as any)[fieldKey] = urlValue === 'true';
        } else {
          (state as any)[fieldKey] = urlValue;
        }
      }
    }

    const keys = Object.keys(dom.advancedControls) as Array<
      keyof typeof dom.advancedControls
    >;
    keys.forEach((key) => {
      const paramName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      const urlValue = params.get(paramName);
      if (urlValue !== null) {
        this.updateStateFromParam(state, key, urlValue);
      }
    });

    return state;
  }

  updateUrlFromState(state: TabState): void {
    const newUrlParams = new URLSearchParams();
    const currentMode = this.uiManager.getCurrentMode();

    const activeFormFields = this.uiManager
      .getFormManager()
      .getActiveFormFields();
    for (const fieldKey of Object.keys(activeFormFields) as Array<
      keyof typeof activeFormFields
    >) {
      const element = activeFormFields[fieldKey];
      if (!element) continue;

      const value =
        element instanceof HTMLInputElement && element.type === 'checkbox'
          ? element.checked
          : element.value;

      const defaultValue = DEFAULT_FORM_FIELDS[fieldKey];

      if (String(value) !== String(defaultValue)) {
        const paramName = fieldKey.replace(/([A-Z])/g, '_$1').toLowerCase();
        newUrlParams.set(paramName, String(value));
      }
    }

    const tabSpecifics = TAB_SPECIFIC_DEFAULTS[currentMode] || {};
    const defaultTabState: TabState = {
      ...DEFAULT_ADVANCED_OPTIONS,
      ...tabSpecifics,
      qrOptions: {
        ...DEFAULT_ADVANCED_OPTIONS.qrOptions,
        ...(tabSpecifics.qrOptions || {}),
      },
      dotsOptions: {
        ...DEFAULT_ADVANCED_OPTIONS.dotsOptions,
        ...(tabSpecifics.dotsOptions || {}),
      },
      cornersSquareOptions: {
        ...DEFAULT_ADVANCED_OPTIONS.cornersSquareOptions,
        ...(tabSpecifics.cornersSquareOptions || {}),
      },
      cornersDotOptions: {
        ...DEFAULT_ADVANCED_OPTIONS.cornersDotOptions,
        ...(tabSpecifics.cornersDotOptions || {}),
      },
      backgroundOptions: {
        ...DEFAULT_ADVANCED_OPTIONS.backgroundOptions,
        ...(tabSpecifics.backgroundOptions || {}),
      },
      imageOptions: {
        ...DEFAULT_ADVANCED_OPTIONS.imageOptions,
        ...(tabSpecifics.imageOptions || {}),
      },
    };

    const getNestedValue = (obj: any, path: string) => {
      return path
        .split('.')
        .reduce((p, c) => (p && p[c] !== undefined ? p[c] : null), obj);
    };

    const statePathMap: { [k: string]: string } = {
      width: 'width',
      height: 'height',
      margin: 'margin',
      anniversaryLogo: 'anniversaryLogo',
      optimizeSize: 'optimizeSize',
      roundSize: 'roundSize',
      showImage: 'showImage',
      dotsType: 'dotsOptions.type',
      dotsColor: 'dotsOptions.color',
      cornersSquareType: 'cornersSquareOptions.type',
      cornersSquareColor: 'cornersSquareOptions.color',
      cornersDotType: 'cornersDotOptions.type',
      cornersDotColor: 'cornersDotOptions.color',
      backgroundColor: 'backgroundOptions.color',
      hideBackgroundDots: 'dotHidingMode',
      imageSize: 'imageOptions.imageSize',
      imageMargin: 'imageOptions.margin',
      qrTypeNumber: 'qrOptions.typeNumber',
      qrErrorCorrectionLevel: 'qrOptions.errorCorrectionLevel',
      logoUrl: 'logoUrl',
    };

    for (const key in statePathMap) {
      const statePath = statePathMap[key];
      const currentValue = getNestedValue(state, statePath);
      const defaultValue = getNestedValue(defaultTabState, statePath);

      if (String(currentValue) !== String(defaultValue)) {
        newUrlParams.set(
          key.replace(/([A-Z])/g, '_$1').toLowerCase(),
          String(currentValue)
        );
      }
    }

    const newUrl = `${window.location.pathname}#/${currentMode}/?${newUrlParams.toString()}`;
    history.replaceState(null, '', newUrl);
  }

  private updateStateFromParam(
    state: Partial<TabState>,
    key: keyof typeof dom.advancedControls,
    value: string
  ): void {
    const boolValue = value === 'true';
    const numValue = parseFloat(value);

    switch (key) {
      case 'width':
      case 'height':
      case 'margin':
        if (!isNaN(numValue)) state[key] = numValue;
        break;
      case 'anniversaryLogo':
      case 'optimizeSize':
      case 'roundSize':
      case 'showImage':
        state[key] = boolValue;
        break;
      case 'dotsType':
        state.dotsOptions = { ...state.dotsOptions, type: value as any };
        break;
      case 'dotsColor':
        state.dotsOptions = { ...state.dotsOptions, color: value };
        break;
      case 'cornersSquareType':
        state.cornersSquareOptions = {
          ...state.cornersSquareOptions,
          type: value as any,
        };
        break;
      case 'cornersSquareColor':
        state.cornersSquareOptions = {
          ...state.cornersSquareOptions,
          color: value,
        };
        break;
      case 'cornersDotType':
        state.cornersDotOptions = {
          ...state.cornersDotOptions,
          type: value as any,
        };
        break;
      case 'cornersDotColor':
        state.cornersDotOptions = { ...state.cornersDotOptions, color: value };
        break;
      case 'backgroundColor':
        state.backgroundOptions = { ...state.backgroundOptions, color: value };
        break;
      case 'hideBackgroundDots': // This key comes from dom.advancedControls
        state.dotHidingMode = value as any;
        break;
      case 'imageSize':
        if (!isNaN(numValue))
          state.imageOptions = { ...state.imageOptions, imageSize: numValue };
        break;
      case 'imageMargin':
        if (!isNaN(numValue))
          state.imageOptions = { ...state.imageOptions, margin: numValue };
        break;
      case 'qrTypeNumber':
        if (!isNaN(numValue))
          state.qrOptions = { ...state.qrOptions, typeNumber: numValue as any };
        break;
      case 'qrErrorCorrectionLevel':
        state.qrOptions = {
          ...state.qrOptions,
          errorCorrectionLevel: value as any,
        };
        break;
      case 'logoUrl':
        state.logoUrl = value;
        break;
    }
  }
}
