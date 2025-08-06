import AsyncQRCodeStyling from '../lib/AsyncQRCodeStyling';
import { Options } from 'qr-code-styling';
import { library, dom as faDom } from '@fortawesome/fontawesome-svg-core';
import {
  faDownload,
  faMobileAlt,
  faCog,
  faUndo,
} from '@fortawesome/free-solid-svg-icons';
import { UIManager } from './UIManager';
import { initializeState, getTabState, updateTabState } from './state';
import { dom } from '../config/dom';
import {
  Mode,
  MODES,
  LOGO_URLS,
  DEFAULT_ADVANCED_OPTIONS,
  DEFAULT_FORM_FIELDS,
  TAB_SPECIFIC_DEFAULTS,
  TabState,
} from '../config/constants';
import { formatPhoneNumberForVCard } from '../utils/helpers';

export let qrCode: AsyncQRCodeStyling;

export class App {
  private ui: UIManager;
  private modalQrCode: AsyncQRCodeStyling;
  private initialUrlParams: URLSearchParams;

  constructor() {
    initializeState();
    this.initialUrlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    this.initializeIcons();
    this.ui = new UIManager(this);

    const defaultState =
      getTabState(this.ui.getCurrentMode()) || DEFAULT_ADVANCED_OPTIONS;
    qrCode = new AsyncQRCodeStyling(defaultState);
    qrCode.append(dom.canvasContainer);

    this.modalQrCode = new AsyncQRCodeStyling({
      width: 400,
      height: 400,
      margin: 10,
    });
    this.modalQrCode.append(dom.modal.qrCodeContainer);

    this.handleRouteChange();
  }

  getVCardData = (): object => {
    const state = getTabState(this.ui.getCurrentMode());
    if (!state) return {};

    return {
      name: `${state.firstName || ''} ${state.lastName || ''}`.trim(),
      phone: state.workPhone || state.cellPhone || state.officePhone,
      email: state.email,
      organizationName: state.org,
    };
  };

  getQrCode = (): AsyncQRCodeStyling => qrCode;
  getModalQrCode = (): AsyncQRCodeStyling => this.modalQrCode;

  private initializeIcons(): void {
    library.add(faDownload, faMobileAlt, faCog, faUndo);
    faDom.watch();
  }

  getQRCodeData = (): string => {
    const currentMode = this.ui.getCurrentMode();
    const state = getTabState(currentMode);
    if (!state) return '';

    const generators: Partial<Record<Mode, () => string>> = {
      [MODES.VCARD]: () => {
        const vcardLines = [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `N:${state.lastName || ''};${state.firstName || ''}`,
          `FN:${`${state.firstName || ''} ${state.lastName || ''}`.trim()}`,
          state.org ? `ORG:${state.org}` : '',
          state.title ? `TITLE:${state.title}` : '',
          state.email ? `EMAIL:${state.email}` : '',
          state.officePhone
            ? `TEL;TYPE=WORK,VOICE:${state.officePhone}${state.extension ? `;x=${state.extension}` : ''}`
            : '',
          state.workPhone
            ? `TEL;TYPE=WORK,VOICE,MSG,PREF:${formatPhoneNumberForVCard(state.workPhone)}`
            : '',
          state.cellPhone
            ? `TEL;TYPE=CELL:${formatPhoneNumberForVCard(state.cellPhone)}`
            : '',
          state.website ? `URL:${state.website}` : '',
          state.linkedin ? `URL:${state.linkedin}` : '',
          state.notes ? `NOTE:${state.notes.replace(/\n/g, '\n')}` : '',
          'END:VCARD',
        ];
        return vcardLines.filter(Boolean).join('\n');
      },
      [MODES.LINK]: () => state.linkUrl || 'https://stand.earth',
      [MODES.WIFI]: () => {
        return `WIFI:S:${state.wifiSsid || ''};T:${state.wifiEncryption || 'WPA'};P:${state.wifiPassword || ''};H:${state.wifiHidden ? 'true' : 'false'};;`;
      },
    };
    return generators[currentMode]!();
  };

  private buildQrConfig = (data: string): Partial<Options> => {
    const state = getTabState(this.ui.getCurrentMode());
    if (!state) return { data };
    return {
      data,
      width: state.width,
      height: state.height,
      margin: state.margin,
      qrOptions: state.qrOptions,
      imageOptions: state.imageOptions,
      dotsOptions: { ...state.dotsOptions, roundSize: state.roundSize },
      backgroundOptions: state.backgroundOptions,
      cornersSquareOptions: state.cornersSquareOptions,
      cornersDotOptions: state.cornersDotOptions,
    };
  };

  private loadImageAsync = (): Promise<string | undefined> => {
    const state = getTabState(this.ui.getCurrentMode());
    if (!state?.showImage) {
      return Promise.resolve(undefined);
    }
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
        const currentMode = this.ui.getCurrentMode();
        const state = getTabState(currentMode);
        let imageUrl: string;

        if (currentMode === MODES.WIFI) {
          imageUrl = LOGO_URLS.WIFI;
        } else {
          imageUrl = state?.anniversaryLogo
            ? LOGO_URLS.ANNIVERSARY
            : LOGO_URLS.RED;
        }

        fetch(imageUrl)
          .then((response) =>
            response.ok
              ? response.blob()
              : Promise.reject('Logo network response was not ok')
          )
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

  updateQRCode = async (): Promise<void> => {
    const data = this.getQRCodeData();
    const config = this.buildQrConfig(data);

    try {
      const image = await this.loadImageAsync();
      if (image) {
        config.image = image;
      } else {
        config.image = null;
      }
      
      await qrCode.update(config);
      dom.vcardTextOutput.innerHTML = data.replace(/\n/g, '<br>');
      dom.vcardTextOutput.style.color = '';
      this.ui.setDownloadButtonVisibility(true);
    } catch (error) {
      console.error('QR Code generation error:', error);
      qrCode.update({ ...config, data: '' });
      if (error.startsWith('code length overflow')) {
        dom.vcardTextOutput.innerHTML = dom.vcardTextOutput.innerHTML =
          data.replace(/\n/g, '<br>') +
          '<br><br>' +
          'Invalid settings combination. The contents are too long for the selected QR code type and error correction level.';
      } else {
        dom.vcardTextOutput.innerHTML = dom.vcardTextOutput.innerHTML =
          data.replace(/\n/g, '<br>') +
          '<br><br>' +
          'Invalid settings combination.';
      }
      dom.vcardTextOutput.style.color = 'red';
      this.ui.setDownloadButtonVisibility(false);
    }
    this.updateUrlParameters();
  };

  handleRouteChange = async (): Promise<void> => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const downloadType = params.get('download');

    let newMode: Mode = MODES.VCARD;
    if (hash.includes(`#/${MODES.LINK}`)) newMode = MODES.LINK;
    if (hash.includes(`#/${MODES.WIFI}`)) newMode = MODES.WIFI;

    this.ui.getTabManager().switchTab(newMode, true);

    const urlState = this.ui.getUrlHandler().getStateFromUrl();
    const currentTabState = getTabState(this.ui.getCurrentMode());
    const mergedState: TabState = {
      ...currentTabState,
      ...urlState,
    };

    this.ui.getFormManager().setFormControlValues(mergedState);
    updateTabState(this.ui.getCurrentMode(), mergedState);

    if (this.ui.getCurrentMode() === MODES.WIFI) {
      dom.formFields.wifiEncryption.dispatchEvent(new Event('change'));
    }

    await this.updateQRCode();
    this.handleDownloadFromUrl(downloadType);
  };

  private handleDownloadFromUrl(downloadType: string | null): void {
    if (!downloadType) return;
    setTimeout(() => {
      const type = downloadType.toLowerCase();
      if (type === 'png') dom.buttons.downloadPng.click();
      if (type === 'jpg') dom.buttons.downloadJpg.click();
      if (type === 'svg') dom.buttons.downloadSvg.click();
      if (type === 'vcf' && this.ui.getCurrentMode() === MODES.VCARD)
        dom.buttons.downloadVCard.click();
    }, 250);
  }

  private getFlatState(state: TabState): { [key: string]: any } {
    return {
      width: state.width,
      height: state.height,
      margin: state.margin,
      anniversaryLogo: state.anniversaryLogo,
      optimizeSize: state.optimizeSize,
      roundSize: state.roundSize,
      showImage: state.showImage,
      dotsType: state.dotsOptions?.type,
      dotsColor: state.dotsOptions?.color,
      cornersSquareType: state.cornersSquareOptions?.type,
      cornersSquareColor: state.cornersSquareOptions?.color,
      cornersDotType: state.cornersDotOptions?.type,
      cornersDotColor: state.cornersDotOptions?.color,
      backgroundColor: state.backgroundOptions?.color,
      hideBackgroundDots: state.imageOptions?.hideBackgroundDots,
      imageSize: state.imageOptions?.imageSize,
      imageMargin: state.imageOptions?.margin,
      qrTypeNumber: state.qrOptions?.typeNumber,
      qrErrorCorrectionLevel: state.qrOptions?.errorCorrectionLevel,
    };
  }

  private updateUrlParameters(): void {
    const newUrlParams = new URLSearchParams();
    const currentMode = this.ui.getCurrentMode();
    const activeFormFields = this.ui.getFormManager().getActiveFormFields();
    console.log('activeFormFields:', activeFormFields);

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
      const paramName = fieldKey.replace(/([A-Z])/g, '_$1').toLowerCase();

      // Include if different from default
      if (String(value) !== String(defaultValue)) {
        newUrlParams.set(
          paramName,
          String(value)
        );
      }
    }

    const currentTabState = getTabState(currentMode);
    if (!currentTabState) return;

    const tabSpecifics = TAB_SPECIFIC_DEFAULTS[currentMode] || {};
    const defaultTabState: TabState = {
      ...DEFAULT_ADVANCED_OPTIONS,
      ...tabSpecifics,
      ...DEFAULT_FORM_FIELDS,
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
    console.log('currentTabState:', currentTabState);
    console.log('defaultTabState:', defaultTabState);

    

    

    const getNestedValue = (obj: any, path: string) => {
      const parts = path.split('.');
      let current = obj;
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          return undefined;
        }
      }
      return current;
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
      hideBackgroundDots: 'imageOptions.hideBackgroundDots',
      imageSize: 'imageOptions.imageSize',
      imageMargin: 'imageOptions.margin',
      qrTypeNumber: 'qrOptions.typeNumber',
      qrErrorCorrectionLevel: 'qrOptions.errorCorrectionLevel',
    };

    for (const key in statePathMap) {
      const statePath = statePathMap[key];
      const currentValue = getNestedValue(currentTabState, statePath);
      const defaultValue = getNestedValue(defaultTabState, statePath);

      const currentString =
        currentValue === undefined || currentValue === null
          ? ''
          : String(currentValue);
      const defaultString =
        defaultValue === undefined || defaultValue === null
          ? ''
          : String(defaultValue);

      console.log(`  Advanced Control: ${key}, Value: '${currentString}', Default: '${defaultString}', Differs: ${currentString !== defaultString}`);
      if (currentString !== defaultString) {
        newUrlParams.set(
          key.replace(/([A-Z])/g, '_$1').toLowerCase(),
          currentString
        );
      }
    }

    const newUrl = `${window.location.pathname}#/${currentMode}/?${newUrlParams.toString()}`;
    console.log('Final newUrlParams:', newUrlParams.toString());
    history.replaceState(null, '', newUrl);
  }
}
