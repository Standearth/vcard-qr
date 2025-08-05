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

  constructor() {
    initializeState();
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

  getQrCode = (): AsyncQRCodeStyling => qrCode;
  getModalQrCode = (): AsyncQRCodeStyling => this.modalQrCode;

  private initializeIcons(): void {
    library.add(faDownload, faMobileAlt, faCog, faUndo);
    faDom.watch();
  }

  getQRCodeData = (): string => {
    const currentMode = this.ui.getCurrentMode();
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
            ? `TEL;TYPE=WORK,VOICE:${officePhone.value}${extension.value ? `;x=${extension.value}` : ''}`
            : '',
          workPhone.value
            ? `TEL;TYPE=WORK,VOICE,MSG,PREF:${formatPhoneNumberForVCard(workPhone.value)}`
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
        return `WIFI:S:${wifiSsid.value || ''};T:${wifiEncryption.value || 'WPA'};P:${wifiPassword.value || ''};H:${wifiHidden.checked ? 'true' : 'false'};;`;
      },
    };
    return generators[currentMode]();
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
      config.image = await this.loadImageAsync();
      await qrCode.update(config);
      dom.vcardTextOutput.textContent = data;
      dom.vcardTextOutput.style.color = '';
      this.ui.setDownloadButtonVisibility(true);
    } catch (error) {
      console.error('QR Code generation error:', error);
      qrCode.update({ ...config, data: '' });
      dom.vcardTextOutput.textContent = 'Invalid settings combination.';
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
    this.ui.getUrlHandler().populateFormFromUrl();
    updateTabState(
      this.ui.getCurrentMode(),
      this.ui.getFormManager().getFormControlValues()
    );

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

    for (const key in activeFormFields) {
      const fieldKey = key as keyof typeof activeFormFields;
      const element = activeFormFields[fieldKey];
      if (!element) continue;
      const value =
        element.type === 'checkbox' ? element.checked : element.value;
      const defaultValue =
        DEFAULT_FORM_FIELDS[fieldKey as keyof typeof DEFAULT_FORM_FIELDS];
      if (String(value) !== String(defaultValue)) {
        newUrlParams.set(
          key.replace(/([A-Z])/g, '_$1').toLowerCase(),
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
      qrOptions: {
        ...DEFAULT_ADVANCED_OPTIONS.qrOptions,
        ...tabSpecifics.qrOptions,
      },
    };

    const flatCurrentState = this.getFlatState(currentTabState);
    const flatDefaultState = this.getFlatState(defaultTabState);

    for (const key in flatCurrentState) {
      if (['container', 'imageFile', 'saveAsBlob'].includes(key)) continue;

      const currentValue = flatCurrentState[key];
      const defaultValue = flatDefaultState[key];

      const currentString =
        currentValue === undefined || currentValue === null
          ? ''
          : String(currentValue);
      const defaultString =
        defaultValue === undefined || defaultValue === null
          ? ''
          : String(defaultValue);

      if (currentString !== defaultString) {
        newUrlParams.set(
          key.replace(/([A-Z])/g, '_$1').toLowerCase(),
          currentString
        );
      }
    }

    const newUrl = `${window.location.pathname}#/${currentMode}/?${newUrlParams.toString()}`;
    history.replaceState(null, '', newUrl);
  }
}
