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
  DEFAULT_FORM_FIELDS,
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
    const currentState = this.uiManager.getTabState();

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
      officePhone:
        currentState?.officePhoneFieldType === 'text'
          ? formFields.officePhoneInput
          : formFields.officePhone,
      extension: formFields.extension,
      workPhone: formFields.workPhone,
      cellPhone: formFields.cellPhone,
      website: formFields.website,
      linkedin: formFields.linkedin,
      whatsapp: formFields.whatsapp,
      notes: formFields.notes,
    };
  }

  getFormControlValues(): TabState {
    const currentState =
      this.uiManager.getTabState() || ({} as Partial<TabState>);
    const { advancedControls, formFields } = dom;
    const typeNumberValue = parseInt(advancedControls.qrTypeNumber.value);

    const formValues: Partial<TabState> = {
      width: parseInt(advancedControls.width.value),
      height: parseInt(advancedControls.height.value),
      showImage: advancedControls.showImage.checked,
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
      dotHidingMode: advancedControls.hideBackgroundDots.value as
        | 'box'
        | 'shape'
        | 'off',
      wrapSize: parseFloat(advancedControls.wrapSize.value),
      imageOptions: {
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
      firstName: formFields.firstName.value,
      lastName: formFields.lastName.value,
      org: formFields.org.value,
      title: formFields.title.value,
      email: formFields.email.value,
      officePhone:
        currentState.officePhoneFieldType === 'text'
          ? formFields.officePhoneInput.value
          : formFields.officePhone.value,
      extension: formFields.extension.value,
      workPhone: formFields.workPhone.value,
      cellPhone: formFields.cellPhone.value,

      website: formFields.website.value,
      linkedin: formFields.linkedin.value,
      whatsapp: formFields.whatsapp.value,
      notes: formFields.notes.value,
      linkUrl: formFields.linkUrl.value,
      logoUrl: advancedControls.logoUrl.value,
      wifiSsid: formFields.wifiSsid.value,
      officePhoneFieldType: currentState.officePhoneFieldType,
      wifiPassword: formFields.wifiPassword.value,
      wifiEncryption: formFields.wifiEncryption.value,
      wifiHidden: formFields.wifiHidden.checked,
    };

    return {
      ...(currentState as TabState),
      ...formValues,
      anniversaryLogo: formValues.anniversaryLogo ?? false,
    };
  }

  setFormControlValues(values: TabState): void {
    const { advancedControls, formFields } = dom;
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
    advancedControls.showImage.checked =
      values.showImage ?? DEFAULT_ADVANCED_OPTIONS.showImage ?? true;

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
      advancedControls.hideBackgroundDots.value =
        values.dotHidingMode ??
        DEFAULT_ADVANCED_OPTIONS.dotHidingMode ??
        'shape';
      advancedControls.wrapSize.value = String(
        values.wrapSize ?? DEFAULT_ADVANCED_OPTIONS.wrapSize
      );
      advancedControls.imageSize.value = String(
        values.imageOptions.imageSize ??
          DEFAULT_ADVANCED_OPTIONS.imageOptions?.imageSize
      );
      advancedControls.imageMargin.value = String(
        values.imageOptions.margin ??
          DEFAULT_ADVANCED_OPTIONS.imageOptions?.margin
      );
    }

    if (advancedControls.logoUrl) {
      advancedControls.logoUrl.value =
        values.logoUrl ?? DEFAULT_ADVANCED_OPTIONS.logoUrl;
    }

    if (values.qrOptions) {
      advancedControls.qrTypeNumber.value = String(
        values.qrOptions.typeNumber ?? 0
      );
      advancedControls.qrErrorCorrectionLevel.value =
        values.qrOptions.errorCorrectionLevel ?? 'Q';
    }

    // Set vCard fields
    if (formFields.firstName) {
      formFields.firstName.value =
        values.firstName ?? DEFAULT_FORM_FIELDS.firstName;
    }
    if (formFields.lastName) {
      formFields.lastName.value =
        values.lastName ?? DEFAULT_FORM_FIELDS.lastName;
    }
    if (formFields.org) {
      formFields.org.value = values.org ?? DEFAULT_FORM_FIELDS.org;
    }
    if (formFields.title) {
      formFields.title.value = values.title ?? DEFAULT_FORM_FIELDS.title;
    }
    if (formFields.email) {
      formFields.email.value = values.email ?? DEFAULT_FORM_FIELDS.email;
    }
    if (values.officePhoneFieldType === 'text') {
      if (formFields.officePhoneInput) {
        formFields.officePhoneInput.value =
          values.officePhone ?? DEFAULT_FORM_FIELDS.officePhone;
      }
    } else {
      if (formFields.officePhone) {
        formFields.officePhone.value =
          values.officePhone ?? DEFAULT_FORM_FIELDS.officePhone;
      }
    }

    if (formFields.extension) {
      formFields.extension.value =
        values.extension ?? DEFAULT_FORM_FIELDS.extension;
    }
    if (formFields.workPhone) {
      formFields.workPhone.value =
        values.workPhone ?? DEFAULT_FORM_FIELDS.workPhone;
    }
    if (formFields.cellPhone) {
      formFields.cellPhone.value =
        values.cellPhone ?? DEFAULT_FORM_FIELDS.cellPhone;
    }
    if (formFields.website) {
      formFields.website.value = values.website ?? DEFAULT_FORM_FIELDS.website;
    }
    if (formFields.linkedin) {
      formFields.linkedin.value =
        values.linkedin ?? DEFAULT_FORM_FIELDS.linkedin;
    }
    if (formFields.whatsapp) {
      formFields.whatsapp.value =
        values.whatsapp ?? DEFAULT_FORM_FIELDS.whatsapp;
    }
    if (formFields.notes) {
      formFields.notes.value = values.notes ?? DEFAULT_FORM_FIELDS.notes;
    }

    // Set Link field
    if (formFields.linkUrl)
      formFields.linkUrl.value = values.linkUrl ?? DEFAULT_FORM_FIELDS.linkUrl;

    // Set WiFi fields
    if (formFields.wifiSsid)
      formFields.wifiSsid.value =
        values.wifiSsid ?? DEFAULT_FORM_FIELDS.wifiSsid;
    if (formFields.wifiPassword)
      formFields.wifiPassword.value =
        values.wifiPassword ?? DEFAULT_FORM_FIELDS.wifiPassword;
    if (formFields.wifiEncryption)
      formFields.wifiEncryption.value =
        values.wifiEncryption ?? DEFAULT_FORM_FIELDS.wifiEncryption;
    if (formFields.wifiHidden)
      formFields.wifiHidden.checked =
        values.wifiHidden ?? DEFAULT_FORM_FIELDS.wifiHidden;
  }

  getVCardData(): { [key: string]: string } {
    const state = this.uiManager.getTabState();
    if (!state) return {};

    return {
      firstName: state.firstName || '',
      lastName: state.lastName || '',
      org: state.org || '',
      title: state.title || '',
      email: state.email || '',
      officePhone: state.officePhone || '',
      extension: state.extension || '',
      workPhone: state.workPhone || '',
      cellPhone: state.cellPhone || '',
      website: state.website || '',
      linkedin: state.linkedin || '',
      notes: state.notes || '',
    };
  }
}
