import { dom } from '../../config/dom';
import { UIManager } from '../UIManager';
import {
  DEFAULT_FORM_FIELDS,
  DEFAULT_ADVANCED_OPTIONS,
  OFFICE_PHONE_ALIASES,
  TabState,
} from '../../config/constants';

export class UrlHandler {
  private uiManager: UIManager;

  constructor(uiManager: UIManager) {
    this.uiManager = uiManager;
  }

  populateFormFromUrl(): void {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const { formFields, advancedControls } = dom;

    // Populate form fields
    for (const key in formFields) {
      const fieldKey = key as keyof typeof formFields;
      const element = formFields[fieldKey];
      if (!element) continue;

      const paramName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      const value = params.get(paramName);

      if (value !== null) {
        if (
          element instanceof HTMLInputElement &&
          element.type === 'checkbox'
        ) {
          element.checked = value === 'true';
        } else if (
          key === 'officePhone' &&
          OFFICE_PHONE_ALIASES[value.toUpperCase()]
        ) {
          (element as HTMLInputElement | HTMLSelectElement).value =
            OFFICE_PHONE_ALIASES[value.toUpperCase()];
        } else {
          (element as HTMLInputElement | HTMLSelectElement).value = value;
        }
      } else {
        const defaultValue =
          DEFAULT_FORM_FIELDS[fieldKey as keyof typeof DEFAULT_FORM_FIELDS];
        if (
          element instanceof HTMLInputElement &&
          element.type === 'checkbox'
        ) {
          element.checked = defaultValue as boolean;
        } else {
          (element as HTMLInputElement | HTMLSelectElement).value =
            defaultValue as string;
        }
      }
    }

    // Populate advanced controls
    const newTabState: TabState = { ...DEFAULT_ADVANCED_OPTIONS };
    const keys = Object.keys(advancedControls) as Array<
      keyof typeof advancedControls
    >;
    keys.forEach((key) => {
      const paramName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      const value = params.get(paramName);
      if (value !== null) {
        this.updateStateFromParam(newTabState, key, value);
      }
    });

    this.uiManager.getFormManager().setFormControlValues(newTabState);
  }

  private updateStateFromParam(
    state: TabState,
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
        if (state.dotsOptions) state.dotsOptions.type = value as any;
        break;
      case 'dotsColor':
        if (state.dotsOptions) state.dotsOptions.color = value;
        break;
      case 'cornersSquareType':
        if (state.cornersSquareOptions)
          state.cornersSquareOptions.type = value as any;
        break;
      case 'cornersSquareColor':
        if (state.cornersSquareOptions)
          state.cornersSquareOptions.color = value;
        break;
      case 'cornersDotType':
        if (state.cornersDotOptions)
          state.cornersDotOptions.type = value as any;
        break;
      case 'cornersDotColor':
        if (state.cornersDotOptions) state.cornersDotOptions.color = value;
        break;
      case 'backgroundColor':
        if (state.backgroundOptions) state.backgroundOptions.color = value;
        break;
      case 'hideBackgrounddots':
        if (state.imageOptions)
          state.imageOptions.hideBackgroundDots = boolValue;
        break;
      case 'imageSize':
        if (state.imageOptions && !isNaN(numValue))
          state.imageOptions.imageSize = numValue;
        break;
      case 'imageMargin':
        if (state.imageOptions && !isNaN(numValue))
          state.imageOptions.margin = numValue;
        break;
      case 'qrTypeNumber':
        if (state.qrOptions && !isNaN(numValue))
          state.qrOptions.typeNumber = numValue as any;
        break;
      case 'qrErrorCorrectionLevel':
        if (state.qrOptions)
          state.qrOptions.errorCorrectionLevel = value as any;
        break;
    }
  }
}
