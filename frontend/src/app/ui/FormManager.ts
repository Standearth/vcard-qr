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
import {
  formatPhoneNumber,
  parsePhoneNumberFromSignalUrl,
} from '@vcard-qr/shared-utils';

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
      signal: formFields.signal,
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
      showWrapOutline: advancedControls.showWrapOutline.checked,
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
      // logoUrl is managed by its own event handler, so we don't need to read it here.
      availableLogos: currentState.availableLogos,
      wifiSsid: formFields.wifiSsid.value,
      officePhoneFieldType: currentState.officePhoneFieldType,
      wifiPassword: formFields.wifiPassword.value,
      wifiEncryption: formFields.wifiEncryption.value,
      wifiHidden: formFields.wifiHidden.checked,
    };

    return {
      ...currentState,
      ...formValues,
    };
  }

  setFormControlValues(values: TabState, activeElement?: HTMLElement): void {
    const { advancedControls, formFields } = dom;

    const updateField = (
      field: HTMLElement,
      value: string | number | boolean | null | undefined
    ) => {
      if (field === activeElement) return;

      if (field instanceof HTMLInputElement && field.type === 'checkbox') {
        field.checked = !!value;
      } else if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement ||
        field instanceof HTMLTextAreaElement
      ) {
        field.value = String(value);
      }
    };

    updateField(
      advancedControls.width,
      values.width ?? DEFAULT_ADVANCED_OPTIONS.width
    );
    updateField(
      advancedControls.height,
      values.height ?? DEFAULT_ADVANCED_OPTIONS.height
    );
    updateField(
      advancedControls.margin,
      values.margin ?? DEFAULT_ADVANCED_OPTIONS.margin
    );
    updateField(
      advancedControls.optimizeSize,
      values.optimizeSize ?? DEFAULT_ADVANCED_OPTIONS.optimizeSize ?? false
    );
    updateField(
      advancedControls.roundSize,
      values.roundSize ?? DEFAULT_ADVANCED_OPTIONS.roundSize ?? true
    );
    updateField(
      advancedControls.showImage,
      values.showImage ?? DEFAULT_ADVANCED_OPTIONS.showImage ?? true
    );

    if (values.dotsOptions) {
      updateField(
        advancedControls.dotsType,
        values.dotsOptions.type ??
          DEFAULT_ADVANCED_OPTIONS.dotsOptions?.type ??
          ''
      );
      updateField(
        advancedControls.dotsColor,
        values.dotsOptions.color ??
          DEFAULT_ADVANCED_OPTIONS.dotsOptions?.color ??
          '#000000'
      );
    }

    if (values.backgroundOptions) {
      updateField(
        advancedControls.backgroundColor,
        values.backgroundOptions.color ??
          DEFAULT_ADVANCED_OPTIONS.backgroundOptions?.color ??
          '#ffffff'
      );
    }

    if (values.cornersSquareOptions) {
      updateField(
        advancedControls.cornersSquareType,
        values.cornersSquareOptions.type ??
          DEFAULT_ADVANCED_OPTIONS.cornersSquareOptions?.type ??
          ''
      );
      updateField(
        advancedControls.cornersSquareColor,
        values.cornersSquareOptions.color ??
          DEFAULT_ADVANCED_OPTIONS.cornersSquareOptions?.color ??
          '#000000'
      );
    }

    if (values.cornersDotOptions) {
      updateField(
        advancedControls.cornersDotType,
        values.cornersDotOptions.type ??
          DEFAULT_ADVANCED_OPTIONS.cornersDotOptions?.type ??
          ''
      );
      updateField(
        advancedControls.cornersDotColor,
        values.cornersDotOptions.color ??
          DEFAULT_ADVANCED_OPTIONS.cornersDotOptions?.color ??
          '#e50b12'
      );
    }

    if (values.imageOptions) {
      updateField(
        advancedControls.hideBackgroundDots,
        values.dotHidingMode ??
          DEFAULT_ADVANCED_OPTIONS.dotHidingMode ??
          'shape'
      );
      updateField(
        advancedControls.wrapSize,
        values.wrapSize ?? DEFAULT_ADVANCED_OPTIONS.wrapSize
      );
      updateField(
        advancedControls.showWrapOutline,
        values.showWrapOutline ?? DEFAULT_ADVANCED_OPTIONS.showWrapOutline
      );
      updateField(
        advancedControls.imageSize,
        values.imageOptions.imageSize ??
          DEFAULT_ADVANCED_OPTIONS.imageOptions?.imageSize
      );
      updateField(
        advancedControls.imageMargin,
        values.imageOptions.margin ??
          DEFAULT_ADVANCED_OPTIONS.imageOptions?.margin
      );
    }

    if (advancedControls.logoUrl) {
      updateField(
        advancedControls.logoUrl,
        values.logoUrl ?? DEFAULT_ADVANCED_OPTIONS.logoUrl
      );
    }

    if (values.qrOptions) {
      updateField(
        advancedControls.qrTypeNumber,
        values.qrOptions.typeNumber ?? 0
      );
      updateField(
        advancedControls.qrErrorCorrectionLevel,
        values.qrOptions.errorCorrectionLevel ?? 'Q'
      );
    }

    // Set vCard fields
    if (formFields.firstName)
      updateField(
        formFields.firstName,
        values.firstName ?? DEFAULT_FORM_FIELDS.firstName
      );
    if (formFields.lastName)
      updateField(
        formFields.lastName,
        values.lastName ?? DEFAULT_FORM_FIELDS.lastName
      );
    if (formFields.org)
      updateField(formFields.org, values.org ?? DEFAULT_FORM_FIELDS.org);
    if (formFields.title)
      updateField(formFields.title, values.title ?? DEFAULT_FORM_FIELDS.title);
    if (formFields.email)
      updateField(formFields.email, values.email ?? DEFAULT_FORM_FIELDS.email);

    if (values.officePhoneFieldType === 'text') {
      if (formFields.officePhoneInput)
        updateField(
          formFields.officePhoneInput,
          values.officePhone ?? DEFAULT_FORM_FIELDS.officePhone
        );
    } else {
      if (formFields.officePhone)
        updateField(
          formFields.officePhone,
          values.officePhone ?? DEFAULT_FORM_FIELDS.officePhone
        );
    }

    if (formFields.extension)
      updateField(
        formFields.extension,
        values.extension ?? DEFAULT_FORM_FIELDS.extension
      );
    if (formFields.workPhone) {
      updateField(
        formFields.workPhone,
        formatPhoneNumber(
          values.workPhone ?? (DEFAULT_FORM_FIELDS.workPhone as string),
          'CUSTOM'
        )
      );
    }
    if (formFields.cellPhone) {
      updateField(
        formFields.cellPhone,
        formatPhoneNumber(
          values.cellPhone ?? (DEFAULT_FORM_FIELDS.cellPhone as string),
          'CUSTOM'
        )
      );
    }
    if (formFields.website)
      updateField(
        formFields.website,
        values.website ?? DEFAULT_FORM_FIELDS.website
      );
    if (formFields.linkedin)
      updateField(
        formFields.linkedin,
        values.linkedin ?? DEFAULT_FORM_FIELDS.linkedin
      );
    if (formFields.whatsapp) {
      updateField(
        formFields.whatsapp,
        formatPhoneNumber(
          values.whatsapp ?? (DEFAULT_FORM_FIELDS.whatsapp as string),
          'CUSTOM'
        )
      );
    }
    if (formFields.signal) {
      // This logic now correctly derives the display value from the canonical state URL.
      const phoneNumber = parsePhoneNumberFromSignalUrl(values.signal);
      if (phoneNumber) {
        // If it's a Signal URL with a number, display the formatted number in the input.
        updateField(
          formFields.signal,
          formatPhoneNumber(phoneNumber, 'CUSTOM')
        );
      } else {
        // Otherwise, display the raw value (which could be a non-phone URL,
        // a partial phone number being typed, or empty).
        updateField(
          formFields.signal,
          values.signal ?? DEFAULT_FORM_FIELDS.signal
        );
      }
    }
    if (formFields.notes)
      updateField(formFields.notes, values.notes ?? DEFAULT_FORM_FIELDS.notes);

    // Set Link field
    if (formFields.linkUrl)
      updateField(
        formFields.linkUrl,
        values.linkUrl ?? DEFAULT_FORM_FIELDS.linkUrl
      );

    // Set WiFi fields
    if (formFields.wifiSsid)
      updateField(
        formFields.wifiSsid,
        values.wifiSsid ?? DEFAULT_FORM_FIELDS.wifiSsid
      );
    if (formFields.wifiPassword)
      updateField(
        formFields.wifiPassword,
        values.wifiPassword ?? DEFAULT_FORM_FIELDS.wifiPassword
      );
    if (formFields.wifiEncryption)
      updateField(
        formFields.wifiEncryption,
        values.wifiEncryption ?? DEFAULT_FORM_FIELDS.wifiEncryption
      );
    if (formFields.wifiHidden)
      updateField(
        formFields.wifiHidden,
        values.wifiHidden ?? DEFAULT_FORM_FIELDS.wifiHidden
      );
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
      whatsapp: state.whatsapp || '',
      signal: state.signal || '',
      notes: state.notes || '',
    };
  }
}
