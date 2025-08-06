import { dom } from '../../config/dom';
import { UIManager } from '../UIManager';
import {
  DEFAULT_FORM_FIELDS,
  TabState,
} from '../../config/constants';

export class UrlHandler {
  private uiManager: UIManager;

  constructor(uiManager: UIManager) {
    this.uiManager = uiManager;
  }

  getStateFromUrl(): Partial<TabState> {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const state: Partial<TabState> = {};

    // Populate form fields from URL
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

    // Populate advanced controls from URL
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
    
    console.log('UrlHandler.getStateFromUrl - state:', state);
    return state;
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
        state.cornersSquareOptions = { ...state.cornersSquareOptions, type: value as any };
        break;
      case 'cornersSquareColor':
        state.cornersSquareOptions = { ...state.cornersSquareOptions, color: value };
        break;
      case 'cornersDotType':
        state.cornersDotOptions = { ...state.cornersDotOptions, type: value as any };
        break;
      case 'cornersDotColor':
        state.cornersDotOptions = { ...state.cornersDotOptions, color: value };
        break;
      case 'backgroundColor':
        state.backgroundOptions = { ...state.backgroundOptions, color: value };
        break;
      case 'hideBackgroundDots':
        state.imageOptions = { ...state.imageOptions, hideBackgroundDots: boolValue };
        break;
      case 'imageSize':
        if (!isNaN(numValue)) state.imageOptions = { ...state.imageOptions, imageSize: numValue };
        break;
      case 'imageMargin':
        if (!isNaN(numValue)) state.imageOptions = { ...state.imageOptions, margin: numValue };
        break;
      case 'qrTypeNumber':
        if (!isNaN(numValue)) state.qrOptions = { ...state.qrOptions, typeNumber: numValue as any };
        break;
      case 'qrErrorCorrectionLevel':
        state.qrOptions = { ...state.qrOptions, errorCorrectionLevel: value as any };
        break;
    }
  }
}