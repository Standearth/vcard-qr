import { dom } from '../../config/dom';
import {
  DEFAULT_FORM_FIELDS,
  OFFICE_PHONE_ALIASES,
} from '../../config/constants';
import { UIManager } from '../UIManager';

export class UrlHandler {
  private uiManager: UIManager;

  constructor(uiManager: UIManager) {
    this.uiManager = uiManager;
  }

  populateFormFromUrl(): void {
    const params = new URLSearchParams(
      window.location.hash.split('?')[1] || ''
    );
    const activeFormFields = this.uiManager.getActiveFormFields();

    for (const key in activeFormFields) {
      const fieldKey = key as keyof typeof activeFormFields;
      const element = activeFormFields[fieldKey];
      if (!element) continue;

      const paramKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      const paramValue = params.get(paramKey);
      const defaultValue =
        DEFAULT_FORM_FIELDS[fieldKey as keyof typeof DEFAULT_FORM_FIELDS];

      if (paramValue !== null) {
        if (
          element instanceof HTMLInputElement &&
          element.type === 'checkbox'
        ) {
          (element as HTMLInputElement).checked = paramValue === 'true';
        } else if (
          key === 'officePhone' &&
          OFFICE_PHONE_ALIASES[paramValue.toUpperCase()]
        ) {
          element.value = OFFICE_PHONE_ALIASES[paramValue.toUpperCase()];
        } else {
          element.value = paramValue;
        }
      } else {
        if (
          element instanceof HTMLInputElement &&
          element.type === 'checkbox'
        ) {
          (element as HTMLInputElement).checked = defaultValue as boolean;
        } else {
          element.value = String(defaultValue);
        }
      }
    }

    params.forEach((value, key) => {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      if (
        Object.prototype.hasOwnProperty.call(dom.advancedControls, camelKey)
      ) {
        const element = (dom.advancedControls as any)[camelKey] as
          | HTMLInputElement
          | HTMLSelectElement;
        if (element && element.type === 'checkbox') {
          (element as HTMLInputElement).checked = value === 'true';
        } else if (element) {
          element.value = value;
        }
      }
    });
  }
}
