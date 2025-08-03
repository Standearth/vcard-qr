import '@fontsource/readex-pro/400.css';
import '@fontsource/readex-pro/500.css';
import '@fontsource/readex-pro/600.css';
import '@fontsource/readex-pro/700.css';

import AsyncQRCodeStyling from './lib/AsyncQRCodeStyling';
import {
  Options,
  DotType,
  CornerSquareType,
  CornerDotType,
  TypeNumber,
} from 'qr-code-styling';
import { library, dom as faDom } from '@fortawesome/fontawesome-svg-core';
import {
  faDownload,
  faMobileAlt,
  faCog,
  faUndo,
} from '@fortawesome/free-solid-svg-icons';

// ==========================================================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================================================

const MODES = {
  VCARD: 'vcard',
  LINK: 'link',
  WIFI: 'wifi',
} as const;

type Mode = (typeof MODES)[keyof typeof MODES];

const DESKTOP_BREAKPOINT_PX = 768;

const LOGO_URLS = {
  RED: '/Stand_Logo_Block-RGB_Red.svg',
  ANNIVERSARY: '/Stand.earth_25th-red_logo-teal_accent-RGB.svg',
  WIFI: '/Stand_WiFi.svg',
};

const OFFICE_PHONE_ALIASES: { [key: string]: string } = {
  SF: '+14158634563',
  BHAM: '+13607342951',
  VAN: '+16043316201',
};

type TabState = Partial<Options> & { anniversaryLogo: boolean };

const DEFAULT_ADVANCED_OPTIONS: TabState = {
  width: 500,
  height: 500,
  margin: 5,
  dotsOptions: { type: 'rounded', color: '#000000' },
  cornersSquareOptions: { type: undefined, color: '#000000' },
  cornersDotOptions: { type: undefined, color: '#e50b12' },
  backgroundOptions: { color: '#ffffff' },
  imageOptions: { hideBackgroundDots: true, imageSize: 0.4, margin: 5 },
  qrOptions: { typeNumber: 0, errorCorrectionLevel: 'Q' },
  anniversaryLogo: true,
};

const TAB_SPECIFIC_DEFAULTS: { [key in Mode]: Partial<TabState> } = {
  [MODES.VCARD]: {
    width: 376,
    height: 376,
    margin: 10,
    qrOptions: { typeNumber: 18, errorCorrectionLevel: 'Q' },
    anniversaryLogo: true,
  },
  [MODES.LINK]: {
    qrOptions: { errorCorrectionLevel: 'H' },
    anniversaryLogo: true,
  },
  [MODES.WIFI]: {
    qrOptions: { errorCorrectionLevel: 'H' },
    anniversaryLogo: false,
  },
};

const DEFAULT_FORM_FIELDS = {
  firstName: '',
  lastName: '',
  org: 'Stand.earth',
  title: '',
  email: '',
  officePhone: '',
  extension: '',
  workPhone: '',
  cellPhone: '',
  website: 'https://stand.earth',
  linkedin: '',
  linkUrl: 'https://stand.earth',
  wifiSsid: '',
  wifiPassword: '',
  wifiEncryption: 'WPA',
  wifiHidden: false,
};

// ==========================================================================
// 2. DOM ELEMENT SELECTION (with Type Assertions)
// ==========================================================================

const dom = {
  contentWrapper: document.querySelector('.content-wrapper') as HTMLDivElement,
  formColumn: document.querySelector('.form-column') as HTMLDivElement,
  qrPreviewColumn: document.getElementById(
    'qr-preview-column'
  ) as HTMLDivElement,
  qrcodeTextContainer: document.querySelector(
    '.qrcode-text-container'
  ) as HTMLDivElement,
  vcardTextOutput: document.getElementById(
    'qrcode-text-output'
  ) as HTMLPreElement,
  anniversaryLogoContainer: document.getElementById(
    'anniversary-logo-checkbox-container'
  ) as HTMLDivElement,
  canvasContainer: document.getElementById('canvas') as HTMLDivElement,
  tabLinks: {
    vcard: document.querySelector(
      '.tab-link[data-tab="vcard"]'
    ) as HTMLButtonElement,
    link: document.querySelector(
      '.tab-link[data-tab="link"]'
    ) as HTMLButtonElement,
    wifi: document.querySelector(
      '.tab-link[data-tab="wifi"]'
    ) as HTMLButtonElement,
  },
  formContainers: {
    vcard: document.getElementById('vcard-form') as HTMLFormElement,
    link: document.getElementById('link-form') as HTMLFormElement,
    wifi: document.getElementById('wifi-form') as HTMLFormElement,
  },
  formFields: {
    firstName: document.getElementById('first_name') as HTMLInputElement,
    lastName: document.getElementById('last_name') as HTMLInputElement,
    org: document.getElementById('org') as HTMLInputElement,
    title: document.getElementById('title') as HTMLInputElement,
    email: document.getElementById('email') as HTMLInputElement,
    officePhone: document.getElementById('office_phone') as HTMLSelectElement,
    extension: document.getElementById('extension') as HTMLInputElement,
    workPhone: document.getElementById('work_phone') as HTMLInputElement,
    cellPhone: document.getElementById('cell_phone') as HTMLInputElement,
    website: document.getElementById('website') as HTMLInputElement,
    linkedin: document.getElementById('linkedin') as HTMLInputElement,
    wifiSsid: document.getElementById('wifi_ssid') as HTMLInputElement,
    wifiPassword: document.getElementById('wifi_password') as HTMLInputElement,
    wifiEncryption: document.getElementById(
      'wifi_encryption'
    ) as HTMLSelectElement,
    wifiHidden: document.getElementById('wifi_hidden') as HTMLInputElement,
    wifiPasswordContainer: document.getElementById(
      'wifi-password-container'
    ) as HTMLDivElement,
    linkUrl: document.getElementById('link_url') as HTMLInputElement,
  },
  subHeadings: {
    vcard: document.querySelector(
      '.sub-heading[data-mode="vcard"]'
    ) as HTMLParagraphElement,
    link: document.querySelector(
      '.sub-heading[data-mode="link"]'
    ) as HTMLParagraphElement,
    wifi: document.querySelector(
      '.sub-heading[data-mode="wifi"]'
    ) as HTMLParagraphElement,
  },
  buttons: {
    downloadVCard: document.getElementById(
      'download-vcard'
    ) as HTMLButtonElement,
    downloadPng: document.getElementById('download-png') as HTMLButtonElement,
    downloadJpg: document.getElementById('download-jpg') as HTMLButtonElement,
    downloadSvg: document.getElementById('download-svg') as HTMLButtonElement,
    sendToPhone: document.getElementById(
      'send-to-phone-button'
    ) as HTMLButtonElement,
    toggleAdvanced: document.getElementById(
      'toggle-advanced-controls'
    ) as HTMLButtonElement,
    resetStyles: document.getElementById(
      'reset-styles-button'
    ) as HTMLButtonElement,
  },
  modal: {
    overlay: document.getElementById('send-to-phone-modal') as HTMLDivElement,
    closeButton: document.getElementById(
      'modal-close-button'
    ) as HTMLButtonElement,
    qrCodeContainer: document.getElementById('modal-qr-code') as HTMLDivElement,
  },
  advancedControls: {
    width: document.getElementById('form-width') as HTMLInputElement,
    height: document.getElementById('form-height') as HTMLInputElement,
    margin: document.getElementById('form-margin') as HTMLInputElement,
    dotsType: document.getElementById('form-dots-type') as HTMLSelectElement,
    dotsColor: document.getElementById('form-dots-color') as HTMLInputElement,
    roundSize: document.getElementById('form-round-size') as HTMLInputElement,
    cornersSquareType: document.getElementById(
      'form-corners-square-type'
    ) as HTMLSelectElement,
    cornersSquareColor: document.getElementById(
      'form-corners-square-color'
    ) as HTMLInputElement,
    cornersDotType: document.getElementById(
      'form-corners-dot-type'
    ) as HTMLSelectElement,
    cornersDotColor: document.getElementById(
      'form-corners-dot-color'
    ) as HTMLInputElement,
    backgroundColor: document.getElementById(
      'form-background-color'
    ) as HTMLInputElement,
    imageFile: document.getElementById('form-image-file') as HTMLInputElement,
    hideBackgroundDots: document.getElementById(
      'form-hide-background-dots'
    ) as HTMLInputElement,
    saveAsBlob: document.getElementById(
      'form-save-as-blob'
    ) as HTMLInputElement,
    imageSize: document.getElementById('form-image-size') as HTMLInputElement,
    imageMargin: document.getElementById(
      'form-image-margin'
    ) as HTMLInputElement,
    qrTypeNumber: document.getElementById(
      'form-qr-type-number'
    ) as HTMLInputElement,
    qrErrorCorrectionLevel: document.getElementById(
      'form-qr-error-correction-level'
    ) as HTMLSelectElement,
    anniversaryLogo: document.getElementById(
      'anniversary_logo'
    ) as HTMLInputElement,
    container: document.getElementById('advanced-controls') as HTMLDivElement,
  },
};

// ==========================================================================
// 3. APPLICATION CLASS
// ==========================================================================

class QRCodeApp {
  private currentMode: Mode = MODES.VCARD;
  private tabStates: { [key in Mode]: TabState } = {} as any;
  private qrCode: AsyncQRCodeStyling;
  private modalQrCode: AsyncQRCodeStyling;

  constructor() {
    this.initializeState();
    this.initializeIcons();

    this.qrCode = new AsyncQRCodeStyling({
      ...DEFAULT_ADVANCED_OPTIONS,
      ...TAB_SPECIFIC_DEFAULTS[this.currentMode],
    });
    this.qrCode.append(dom.canvasContainer);

    this.modalQrCode = new AsyncQRCodeStyling({
      width: 400,
      height: 400,
      margin: 10,
    });
    this.modalQrCode.append(dom.modal.qrCodeContainer);

    this.setupEventListeners();
    this.handleRouteChange();
  }

  private initializeState(): void {
    for (const key in MODES) {
      const mode = MODES[key as keyof typeof MODES];
      const defaults = DEFAULT_ADVANCED_OPTIONS;
      const specifics = TAB_SPECIFIC_DEFAULTS[mode] || {};

      // By manually merging each nested object, we ensure that the
      // specific tab defaults (e.g., a new errorCorrectionLevel) are applied
      // without losing other default values (e.g., typeNumber) in that same object.
      this.tabStates[mode] = {
        ...defaults,
        ...specifics,
        // Perform a "deep merge" for all nested option objects
        qrOptions: {
          ...defaults.qrOptions,
          ...(specifics.qrOptions || {}),
        },
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
      } as TabState;
    }
  }

  private initializeIcons(): void {
    library.add(faDownload, faMobileAlt, faCog, faUndo);
    faDom.watch();
  }

  private getQRCodeData = (): string => {
    const formatPhoneNumberForVCard = (phoneNumber: string) => {
      if (!phoneNumber) return '';
      let cleanedNumber = phoneNumber.replace(/[^0-9,+]/g, '');
      if (/^\d{10}$/.test(cleanedNumber)) {
        cleanedNumber = `+1${cleanedNumber}`;
      }
      return cleanedNumber;
    };

    const generators: { [key in Mode]: () => string } = {
      [MODES.VCARD]: () => {
        const {
          firstName,
          lastName,
          org,
          title,
          email,
          officePhone,
          extension,
          workPhone,
          cellPhone,
          website,
          linkedin,
        } = dom.formFields;
        const vcardLines = [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `N:${lastName.value || ''};${firstName.value || ''}`,
          `FN:${`${firstName.value || ''} ${lastName.value || ''}`.trim()}`,
          org.value ? `ORG:${org.value}` : '',
          title.value ? `TITLE:${title.value}` : '',
          email.value ? `EMAIL:${email.value}` : '',
          officePhone.value
            ? `TEL;TYPE=WORK,VOICE:${officePhone.value}${
                extension.value ? `;x=${extension.value}` : ''
              }`
            : '',
          workPhone.value
            ? `TEL;TYPE=WORK,VOICE,MSG,PREF:${formatPhoneNumberForVCard(
                workPhone.value
              )}`
            : '',
          cellPhone.value
            ? `TEL;TYPE=CELL:${formatPhoneNumberForVCard(cellPhone.value)}`
            : '',
          website.value ? `URL:${website.value}` : '',
          linkedin.value ? `URL:${linkedin.value}` : '',
          'END:VCARD',
        ];
        return vcardLines.filter(Boolean).join('\n');
      },
      [MODES.LINK]: () => dom.formFields.linkUrl.value || 'https://stand.earth',
      [MODES.WIFI]: () => {
        const { wifiSsid, wifiPassword, wifiEncryption, wifiHidden } =
          dom.formFields;
        return `WIFI:S:${wifiSsid.value || ''};T:${
          wifiEncryption.value || 'WPA'
        };P:${wifiPassword.value || ''};H:${
          wifiHidden.checked ? 'true' : 'false'
        };;`;
      },
    };

    return generators[this.currentMode]();
  };

  private buildQrConfig = (data: string): Partial<Options> => {
    const state = this.tabStates[this.currentMode];
    return {
      data,
      width: state.width,
      height: state.height,
      margin: state.margin,
      qrOptions: state.qrOptions,
      imageOptions: state.imageOptions,
      dotsOptions: state.dotsOptions,
      backgroundOptions: state.backgroundOptions,
      cornersSquareOptions: state.cornersSquareOptions,
      cornersDotOptions: state.cornersDotOptions,
    };
  };

  private loadImageAsync = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (
        dom.advancedControls.imageFile.files &&
        dom.advancedControls.imageFile.files.length > 0
      ) {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(dom.advancedControls.imageFile.files[0]);
      } else {
        let imageUrl: string;
        if (this.currentMode === MODES.WIFI) {
          imageUrl = LOGO_URLS.WIFI;
        } else {
          imageUrl = this.tabStates[this.currentMode].anniversaryLogo
            ? LOGO_URLS.ANNIVERSARY
            : LOGO_URLS.RED;
        }
        fetch(imageUrl)
          .then((response) => {
            if (!response.ok)
              throw new Error('Logo network response was not ok');
            return response.blob();
          })
          .then((blob) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
          .catch(reject);
      }
    });
  };

  private updateQRCode = async (): Promise<void> => {
    const data = this.getQRCodeData();
    const config = this.buildQrConfig(data);

    try {
      const imageSrc = await this.loadImageAsync();
      config.image = imageSrc;

      await this.qrCode.update(config);

      dom.vcardTextOutput.textContent = data;
      dom.vcardTextOutput.style.color = '';
      this.setDownloadButtonVisibility(true);
    } catch (error) {
      console.error('QR Code generation error:', error);
      this.qrCode.update({ ...config, data: '' });
      dom.vcardTextOutput.textContent = 'Invalid settings combination.';
      dom.vcardTextOutput.style.color = 'red';
      this.setDownloadButtonVisibility(false);
    }
    this.updateUrlParameters();
  };

  private handleRouteChange = async (): Promise<void> => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const downloadType = params.get('download');

    let newMode: Mode = MODES.VCARD;
    if (hash.includes(`#/${MODES.LINK}`)) newMode = MODES.LINK;
    if (hash.includes(`#/${MODES.WIFI}`)) newMode = MODES.WIFI;

    this.switchTab(newMode, true);
    this.populateFormFromUrl();
    this.tabStates[this.currentMode] = this.getFormControlValues();

    if (this.currentMode === MODES.WIFI) {
      dom.formFields.wifiEncryption.dispatchEvent(new Event('change'));
    }

    await this.updateQRCode();
    this.handleDownloadFromUrl(downloadType);
  };

  private setDownloadButtonVisibility = (visible: boolean): void => {
    const display = visible ? 'inline-block' : 'none';
    dom.buttons.downloadPng.style.display = display;
    dom.buttons.downloadJpg.style.display = display;
    dom.buttons.downloadSvg.style.display = display;
    if (this.currentMode === MODES.VCARD) {
      dom.buttons.downloadVCard.style.display = visible ? 'block' : 'none';
    }
  };

  private updateUrlParameters = (): void => {
    const newUrlParams = new URLSearchParams();
    const activeFormFields = this.getActiveFormFields();

    for (const key in activeFormFields) {
      const fieldKey = key as keyof typeof activeFormFields;
      const element = activeFormFields[fieldKey];
      if (!element) continue;

      const value =
        element.type === 'checkbox' ? element.checked : element.value;
      const defaultValue =
        DEFAULT_FORM_FIELDS[fieldKey as keyof typeof DEFAULT_FORM_FIELDS];

      if (String(value) !== String(defaultValue)) {
        const paramKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        newUrlParams.set(paramKey, String(value));
      }
    }

    const currentTabState = this.tabStates[this.currentMode];
    for (const key in dom.advancedControls) {
      if (key === 'container') continue;
      const controlKey = key as keyof Omit<
        typeof dom.advancedControls,
        'container'
      >;
      const value = (currentTabState as any)[controlKey];
      const defaultValue =
        (TAB_SPECIFIC_DEFAULTS[this.currentMode] as any)[controlKey] ??
        (DEFAULT_ADVANCED_OPTIONS as any)[controlKey];

      if (String(value) !== String(defaultValue)) {
        const paramKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        newUrlParams.set(paramKey, String(value));
      }
    }

    const newUrl = `${window.location.pathname}#/${this.currentMode}/?${newUrlParams.toString()}`;
    history.replaceState(null, '', newUrl);
  };

  private populateFormFromUrl = (): void => {
    const params = new URLSearchParams(
      window.location.hash.split('?')[1] || ''
    );
    const activeFormFields = this.getActiveFormFields();

    for (const key in activeFormFields) {
      const fieldKey = key as keyof typeof activeFormFields;
      const element = activeFormFields[fieldKey];
      if (!element) continue;

      const paramKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      const paramValue = params.get(paramKey);
      const defaultValue =
        DEFAULT_FORM_FIELDS[fieldKey as keyof typeof DEFAULT_FORM_FIELDS];

      if (paramValue !== null) {
        if (element.type === 'checkbox') {
          element.checked = paramValue === 'true';
        } else if (
          key === 'officePhone' &&
          OFFICE_PHONE_ALIASES[paramValue.toUpperCase()]
        ) {
          element.value = OFFICE_PHONE_ALIASES[paramValue.toUpperCase()];
        } else {
          element.value = paramValue;
        }
      } else {
        if (element.type === 'checkbox') {
          element.checked = defaultValue as boolean;
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
  };

  private switchTab = (newMode: Mode, isInitialLoad = false): void => {
    if (!isInitialLoad) {
      this.tabStates[this.currentMode] = this.getFormControlValues();
    }
    this.currentMode = newMode;

    Object.keys(dom.tabLinks).forEach((key) => {
      const modeKey = key as keyof typeof dom.tabLinks;
      dom.tabLinks[modeKey].classList.toggle('active', modeKey === newMode);
      dom.formContainers[modeKey].classList.toggle(
        'active',
        modeKey === newMode
      );
      dom.formContainers[modeKey].classList.toggle(
        'hidden',
        modeKey !== newMode
      );
      dom.subHeadings[modeKey].classList.toggle('hidden', modeKey !== newMode);
    });

    dom.buttons.downloadVCard.style.display =
      newMode === MODES.VCARD ? 'block' : 'none';
    dom.anniversaryLogoContainer.style.display =
      newMode === MODES.WIFI ? 'none' : 'flex';

    this.setFormControlValues(this.tabStates[newMode]);

    if (!isInitialLoad) {
      this.updateQRCode();
    }
    this.handleQrTextContainerPlacement();
  };

  private handleDownloadFromUrl = (downloadType: string | null): void => {
    if (!downloadType) return;
    setTimeout(() => {
      const type = downloadType.toLowerCase();
      if (type === 'png') dom.buttons.downloadPng.click();
      if (type === 'jpg') dom.buttons.downloadJpg.click();
      if (type === 'svg') dom.buttons.downloadSvg.click();
      if (type === 'vcf' && this.currentMode === MODES.VCARD)
        dom.buttons.downloadVCard.click();
    }, 250);
  };

  private getFormControlValues = (): TabState => {
    const { advancedControls } = dom;
    return {
      width: parseInt(advancedControls.width.value),
      height: parseInt(advancedControls.height.value),
      margin: parseInt(advancedControls.margin.value),
      anniversaryLogo: advancedControls.anniversaryLogo.checked,
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
        typeNumber: parseInt(advancedControls.qrTypeNumber.value) as TypeNumber,
        errorCorrectionLevel: advancedControls.qrErrorCorrectionLevel.value as
          | 'L'
          | 'M'
          | 'Q'
          | 'H',
      },
    };
  };

  private setFormControlValues = (values: TabState): void => {
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

    advancedControls.dotsType.value =
      values.dotsOptions?.type ??
      DEFAULT_ADVANCED_OPTIONS.dotsOptions?.type ??
      '';
    advancedControls.dotsColor.value =
      values.dotsOptions?.color ??
      DEFAULT_ADVANCED_OPTIONS.dotsOptions?.color ??
      '#000000';

    advancedControls.backgroundColor.value =
      values.backgroundOptions?.color ??
      DEFAULT_ADVANCED_OPTIONS.backgroundOptions?.color ??
      '#ffffff';

    advancedControls.cornersSquareType.value =
      values.cornersSquareOptions?.type ??
      DEFAULT_ADVANCED_OPTIONS.cornersSquareOptions?.type ??
      '';
    advancedControls.cornersSquareColor.value =
      values.cornersSquareOptions?.color ??
      DEFAULT_ADVANCED_OPTIONS.cornersSquareOptions?.color ??
      '#000000';

    advancedControls.cornersDotType.value =
      values.cornersDotOptions?.type ??
      DEFAULT_ADVANCED_OPTIONS.cornersDotOptions?.type ??
      '';
    advancedControls.cornersDotColor.value =
      values.cornersDotOptions?.color ??
      DEFAULT_ADVANCED_OPTIONS.cornersDotOptions?.color ??
      '#e50b12';

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
  };

  private handleQrTextContainerPlacement = (): void => {
    const shouldMove =
      (this.currentMode === MODES.LINK || this.currentMode === MODES.WIFI) &&
      window.innerWidth >= DESKTOP_BREAKPOINT_PX;
    if (shouldMove) {
      dom.formColumn.appendChild(dom.qrcodeTextContainer);
    } else {
      dom.contentWrapper.appendChild(dom.qrcodeTextContainer);
    }
  };

  private getActiveFormFields = () => {
    const { formFields } = dom;
    if (this.currentMode === MODES.LINK) return { linkUrl: formFields.linkUrl };
    if (this.currentMode === MODES.WIFI)
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
    };
  };

  private sanitizeFilename = (name: string): string => {
    if (!name) return '';
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_.-]/g, '')
      .replace(/__+/g, '_');
  };

  private generateFilename = (): string => {
    if (this.currentMode === MODES.VCARD) {
      const namePart = [
        dom.formFields.firstName.value,
        dom.formFields.lastName.value,
      ]
        .map(this.sanitizeFilename)
        .filter(Boolean)
        .join('-');
      return `Stand-QR-vCard${namePart ? `-${namePart}` : ''}`;
    }
    if (this.currentMode === MODES.WIFI) {
      const ssid = this.sanitizeFilename(dom.formFields.wifiSsid.value);
      return `Stand-QR-WiFi-${ssid || 'network'}`;
    }
    if (this.currentMode === MODES.LINK) {
      try {
        let urlString = dom.formFields.linkUrl.value;
        if (!/^(https?|ftp):\/\//i.test(urlString))
          urlString = `https://${urlString}`;
        const fqdn = new URL(urlString).hostname;
        return `Stand-QR-URL-${this.sanitizeFilename(fqdn) || 'link'}`;
      } catch (e) {
        return 'Stand-QR-URL-invalid_link';
      }
    }
    return 'qr-code';
  };

  private closeModal = () => dom.modal.overlay.classList.add('hidden');

  private handleAdvancedControlsChange = (): void => {
    this.tabStates[this.currentMode] = this.getFormControlValues();
    this.updateQRCode();
  };

  private setupEventListeners = (): void => {
    window.addEventListener('hashchange', this.handleRouteChange.bind(this));

    Object.values(dom.tabLinks).forEach((tab) => {
      tab.addEventListener('click', () =>
        this.switchTab(tab.dataset.tab as Mode)
      );
    });

    Object.values(dom.formFields).forEach((field) => {
      if (field instanceof HTMLElement) {
        field.addEventListener('input', this.updateQRCode.bind(this));
      }
    });

    Object.values(dom.advancedControls).forEach((field) => {
      if (field instanceof HTMLElement && field.id !== 'advanced-controls') {
        field.addEventListener(
          'input',
          this.handleAdvancedControlsChange.bind(this)
        );
      }
    });

    dom.buttons.downloadPng.addEventListener('click', () =>
      this.qrCode.download({ name: this.generateFilename(), extension: 'png' })
    );
    dom.buttons.downloadJpg.addEventListener('click', () =>
      this.qrCode.download({ name: this.generateFilename(), extension: 'jpeg' })
    );
    dom.buttons.downloadSvg.addEventListener('click', () =>
      this.qrCode.download({ name: this.generateFilename(), extension: 'svg' })
    );

    dom.buttons.downloadVCard.addEventListener('click', () => {
      const blob = new Blob([this.getQRCodeData()], { type: 'text/vcard' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.generateFilename()}.vcf`;
      a.click();
      URL.revokeObjectURL(url);
    });

    dom.buttons.toggleAdvanced.addEventListener('click', () => {
      const isHidden =
        dom.advancedControls.container.classList.toggle('hidden');
      const textSpan = dom.buttons.toggleAdvanced.querySelector('span');
      if (textSpan) {
        textSpan.textContent = isHidden
          ? 'Show Advanced Controls'
          : 'Hide Advanced Controls';
      }
    });

    dom.buttons.resetStyles.addEventListener('click', () => {
      this.tabStates[this.currentMode] = {
        ...DEFAULT_ADVANCED_OPTIONS,
        ...(TAB_SPECIFIC_DEFAULTS[this.currentMode] || {}),
      } as TabState;
      this.setFormControlValues(this.tabStates[this.currentMode]);
      dom.advancedControls.imageFile.value = '';
      this.updateQRCode();
    });

    dom.buttons.sendToPhone.addEventListener('click', () => {
      let finalUrl = window.location.href;
      if (finalUrl.includes('?')) {
        finalUrl += '&download=png';
      } else {
        finalUrl += '?download=png';
      }
      this.modalQrCode.update({ data: finalUrl });
      dom.modal.overlay.classList.remove('hidden');
    });

    dom.modal.closeButton.addEventListener('click', this.closeModal);
    dom.modal.overlay.addEventListener('click', (event) => {
      if (event.target === dom.modal.overlay) this.closeModal();
    });
  };
}

// ==========================================================================
// 4. APPLICATION INITIALIZATION
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  new QRCodeApp();
});
