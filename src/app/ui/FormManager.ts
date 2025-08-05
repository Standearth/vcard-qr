// src/app/ui/FormManager.ts

import {
  DotType,
  CornerSquareType,
  CornerDotType,
  TypeNumber,
} from 'qr-code-styling';
import { dom } from '../../config/dom';
import { UIManager } from '../UIManager';
import {
  TabState,
  DEFAULT_ADVANCED_OPTIONS,
  MODES,
} from '../../config/constants';

export class FormManager {
  private uiManager: UIManager;

  constructor(uiManager: UIManager) {
    this.uiManager = uiManager;
  }

  getActiveFormFields() {
    const { formFields } = dom;
    const currentMode = this.uiManager.getCurrentMode();
    if (currentMode === MODES.LINK) return { linkUrl: formFields.linkUrl };
    if (currentMode === MODES.WIFI)
      return {
        wifiSsid: formFields.wifiSsid,
        wifiPassword: formFields.wifiPassword,
        wifiEncryption: formFields.wifiEncryption,
        wifiHidden: formFields.wifiHidden,
      };
    return {
      firstName: formFields.firstName,
      lastName: formFields.lastName,
      org: formFields.org,
      title: formFields.title,
      email: formFields.email,
      officePhone: formFields.officePhone,
      extension: formFields.extension,
      workPhone: formFields.workPhone,
      cellPhone: formFields.cellPhone,
      website: formFields.website,
      linkedin: formFields.linkedin,
      note: formFields.note,
    };
  }

  getFormControlValues(): TabState {
    const { advancedControls } = dom;
    const typeNumberValue = parseInt(advancedControls.qrTypeNumber.value);

    return {
      width: parseInt(advancedControls.width.value),
      height: parseInt(advancedControls.height.value),
      margin: parseInt(advancedControls.margin.value),
      anniversaryLogo: advancedControls.anniversaryLogo.checked,
      optimizeSize: advancedControls.optimizeSize.checked,
      roundSize: advancedControls.roundSize.checked,
      dotsOptions: {
        type: advancedControls.dotsType.value as DotType,
        color: advancedControls.dotsColor.value,
      },
      backgroundOptions: {
        color: advancedControls.backgroundColor.value,
      },
      cornersSquareOptions: {
        type: advancedControls.cornersSquareType.value as CornerSquareType,
        color: advancedControls.cornersSquareColor.value,
      },
      cornersDotOptions: {
        type: advancedControls.cornersDotType.value as CornerDotType,
        color: advancedControls.cornersDotColor.value,
      },
      imageOptions: {
        hideBackgroundDots: advancedControls.hideBackgroundDots.checked,
        imageSize: parseFloat(advancedControls.imageSize.value),
        margin: parseInt(advancedControls.imageMargin.value),
      },
      qrOptions: {
        typeNumber: (isNaN(typeNumberValue)
          ? 0
          : typeNumberValue) as TypeNumber,
        errorCorrectionLevel: advancedControls.qrErrorCorrectionLevel.value as
          | 'L'
          | 'M'
          | 'Q'
          | 'H',
      },
    };
  }

  setFormControlValues(values: TabState): void {
    const { advancedControls } = dom;
    advancedControls.width.value = String(
      values.width ?? DEFAULT_ADVANCED_OPTIONS.width
    );
    advancedControls.height.value = String(
      values.height ?? DEFAULT_ADVANCED_OPTIONS.height
    );
    advancedControls.margin.value = String(
      values.margin ?? DEFAULT_ADVANCED_OPTIONS.margin
    );
    advancedControls.anniversaryLogo.checked =
      values.anniversaryLogo ?? DEFAULT_ADVANCED_OPTIONS.anniversaryLogo;
    advancedControls.optimizeSize.checked =
      values.optimizeSize ?? DEFAULT_ADVANCED_OPTIONS.optimizeSize ?? false;
    advancedControls.roundSize.checked =
      values.roundSize ?? DEFAULT_ADVANCED_OPTIONS.roundSize ?? true;

    if (values.dotsOptions) {
      advancedControls.dotsType.value =
        values.dotsOptions.type ??
        DEFAULT_ADVANCED_OPTIONS.dotsOptions?.type ??
        '';
      advancedControls.dotsColor.value =
        values.dotsOptions.color ??
        DEFAULT_ADVANCED_OPTIONS.dotsOptions?.color ??
        '#000000';
    }

    if (values.backgroundOptions) {
      advancedControls.backgroundColor.value =
        values.backgroundOptions.color ??
        DEFAULT_ADVANCED_OPTIONS.backgroundOptions?.color ??
        '#ffffff';
    }

    if (values.cornersSquareOptions) {
      advancedControls.cornersSquareType.value =
        values.cornersSquareOptions.type ??
        DEFAULT_ADVANCED_OPTIONS.cornersSquareOptions?.type ??
        '';
      advancedControls.cornersSquareColor.value =
        values.cornersSquareOptions.color ??
        DEFAULT_ADVANCED_OPTIONS.cornersSquareOptions?.color ??
        '#000000';
    }

    if (values.cornersDotOptions) {
      advancedControls.cornersDotType.value =
        values.cornersDotOptions.type ??
        DEFAULT_ADVANCED_OPTIONS.cornersDotOptions?.type ??
        '';
      advancedControls.cornersDotColor.value =
        values.cornersDotOptions.color ??
        DEFAULT_ADVANCED_OPTIONS.cornersDotOptions?.color ??
        '#e50b12';
    }

    if (values.imageOptions) {
      advancedControls.hideBackgroundDots.checked =
        values.imageOptions.hideBackgroundDots ?? true;
      advancedControls.imageSize.value = String(
        values.imageOptions.imageSize ?? 0.4
      );
      advancedControls.imageMargin.value = String(
        values.imageOptions.margin ?? 5
      );
    }

    if (values.qrOptions) {
      advancedControls.qrTypeNumber.value = String(
        values.qrOptions.typeNumber ?? 0
      );
      advancedControls.qrErrorCorrectionLevel.value =
        values.qrOptions.errorCorrectionLevel ?? 'Q';
    }
  }

  setDownloadButtonVisibility(visible: boolean): void {
    const display = visible ? 'inline-flex' : 'none';
    dom.buttons.downloadPng.style.display = display;
    dom.buttons.downloadJpg.style.display = display;
    dom.buttons.downloadSvg.style.display = display;
    if (this.uiManager.getCurrentMode() === MODES.VCARD) {
      dom.buttons.downloadVCard.style.display = visible
        ? 'inline-flex'
        : 'none';
    }
  }
}
