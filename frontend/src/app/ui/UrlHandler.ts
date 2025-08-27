// src/app/ui/UrlHandler.ts

import { dom } from '../../config/dom';
import { UIManager } from '../UIManager';
import {
  DEFAULT_FORM_FIELDS,
  TabState,
  DEFAULT_ADVANCED_OPTIONS,
  TAB_SPECIFIC_DEFAULTS,
} from '../../config/constants';
import { DotType, CornerDotType, CornerSquareType } from 'qr-code-styling';

type NestedState =
  | 'dotsOptions'
  | 'cornersSquareOptions'
  | 'cornersDotOptions'
  | 'backgroundOptions'
  | 'imageOptions'
  | 'qrOptions';

export class UrlHandler {
  private uiManager: UIManager;

  constructor(uiManager: UIManager) {
    this.uiManager = uiManager;
  }

  getStateFromUrl(): Partial<TabState> {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const state: Partial<TabState> = {};

    // First, handle all simple form fields
    for (const key in DEFAULT_FORM_FIELDS) {
      const fieldKey = key as keyof typeof DEFAULT_FORM_FIELDS;
      const paramName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      const urlValue = params.get(paramName);

      if (urlValue !== null) {
        const defaultFieldValue = DEFAULT_FORM_FIELDS[fieldKey];
        if (typeof defaultFieldValue === 'boolean') {
          (state as Record<string, unknown>)[fieldKey] = urlValue === 'true';
        } else {
          (state as Record<string, unknown>)[fieldKey] = urlValue;
        }
      }
    }

    // Then, handle advanced and nested controls
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

    const tabSpecifics = TAB_SPECIFIC_DEFAULTS[currentMode] || {};
    const defaultTabState: TabState = {
      ...DEFAULT_ADVANCED_OPTIONS,
      ...DEFAULT_FORM_FIELDS,
      ...tabSpecifics,
      officePhoneFieldType: 'select',
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

    const getNestedValue = (
      obj: Record<string, unknown>,
      path: string
    ): unknown => {
      return path.split('.').reduce((p: unknown, c: string) => {
        if (p && typeof p === 'object' && c in p) {
          return (p as Record<string, unknown>)[c];
        }
        return null;
      }, obj);
    };

    // A comprehensive map of all state properties to their URL parameter names
    const statePathMap: { [k: string]: string } = {
      // vCard fields
      firstName: 'firstName',
      lastName: 'lastName',
      org: 'org',
      title: 'title',
      email: 'email',
      officePhone: 'officePhone',
      extension: 'extension',
      workPhone: 'workPhone',
      cellPhone: 'cellPhone',
      whatsapp: 'whatsapp',
      signal: 'signal',
      website: 'website',
      linkedin: 'linkedin',
      notes: 'notes',
      // Link fields
      linkUrl: 'linkUrl',
      // WiFi fields
      wifiSsid: 'wifiSsid',
      wifiPassword: 'wifiPassword',
      wifiEncryption: 'wifiEncryption',
      wifiHidden: 'wifiHidden',
      // Advanced Controls
      width: 'width',
      height: 'height',
      margin: 'margin',
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
      wrapSize: 'wrapSize',
      imageSize: 'imageOptions.imageSize',
      imageMargin: 'imageOptions.margin',
      qrTypeNumber: 'qrOptions.typeNumber',
      qrErrorCorrectionLevel: 'qrOptions.errorCorrectionLevel',
      logoUrl: 'logoUrl',
    };

    for (const key in statePathMap) {
      const statePath = statePathMap[key];
      const paramName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      const currentValue = getNestedValue(
        state as unknown as Record<string, unknown>,
        statePath
      );
      const defaultValue = getNestedValue(
        defaultTabState as unknown as Record<string, unknown>,
        statePath
      );

      if (String(currentValue) !== String(defaultValue)) {
        newUrlParams.set(paramName, String(currentValue));
      }
    }

    const newUrl = `${
      window.location.pathname
    }#/${currentMode}/?${newUrlParams.toString()}`;
    history.replaceState(null, '', newUrl);
  }

  private updateStateFromParam(
    state: Partial<TabState>,
    key: keyof typeof dom.advancedControls,
    value: string
  ): void {
    const boolValue = value === 'true';
    const numValue = parseFloat(value);
    const intValue = parseInt(value, 10);

    const updateNestedState = <
      T extends NestedState,
      K extends keyof NonNullable<TabState[T]>,
    >(
      stateKey: T,
      prop: K,
      val: NonNullable<TabState[T]>[K]
    ) => {
      state[stateKey] = { ...(state[stateKey] || {}), [prop]: val };
    };

    switch (key) {
      case 'width':
      case 'height':
      case 'margin':
        if (!isNaN(intValue)) state[key] = intValue;
        break;
      case 'optimizeSize':
      case 'roundSize':
      case 'showImage':
        state[key] = boolValue;
        break;
      case 'dotsType':
        updateNestedState('dotsOptions', 'type', value as DotType);
        break;
      case 'dotsColor':
        updateNestedState('dotsOptions', 'color', value);
        break;
      case 'cornersSquareType':
        updateNestedState(
          'cornersSquareOptions',
          'type',
          value as CornerSquareType
        );
        break;
      case 'cornersSquareColor':
        updateNestedState('cornersSquareOptions', 'color', value);
        break;
      case 'cornersDotType':
        updateNestedState('cornersDotOptions', 'type', value as CornerDotType);
        break;
      case 'cornersDotColor':
        updateNestedState('cornersDotOptions', 'color', value);
        break;
      case 'backgroundColor':
        updateNestedState('backgroundOptions', 'color', value);
        break;
      case 'hideBackgroundDots': // This key comes from dom.advancedControls
        state.dotHidingMode = value as 'box' | 'shape' | 'off';
        break;
      case 'wrapSize':
        if (!isNaN(numValue)) state.wrapSize = numValue;
        break;
      case 'imageSize':
        if (!isNaN(numValue))
          updateNestedState('imageOptions', 'imageSize', numValue);
        break;
      case 'imageMargin':
        if (!isNaN(intValue))
          updateNestedState('imageOptions', 'margin', intValue);
        break;
      case 'qrTypeNumber':
        if (!isNaN(intValue))
          updateNestedState('qrOptions', 'typeNumber', intValue as 0);
        break;
      case 'qrErrorCorrectionLevel':
        updateNestedState(
          'qrOptions',
          'errorCorrectionLevel',
          value as 'L' | 'M' | 'Q' | 'H'
        );
        break;
      case 'logoUrl':
        state.logoUrl = value;
        break;
    }
  }
}
