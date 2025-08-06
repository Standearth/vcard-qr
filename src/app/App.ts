// src/app/App.ts

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
import { stateService } from './StateService';
import { dom } from '../config/dom';
import {
  Mode,
  MODES,
  LOGO_URLS,
  DEFAULT_ADVANCED_OPTIONS,
  TabState,
} from '../config/constants';
import { formatPhoneNumberForVCard } from '../utils/helpers';

export let qrCode: AsyncQRCodeStyling;

export class App {
  private ui: UIManager;
  private modalQrCode: AsyncQRCodeStyling;

  constructor() {
    this.ui = new UIManager(this);
    stateService.initialize(this.ui);

    this.initializeIcons();

    const defaultState =
      stateService.getState(this.ui.getCurrentMode()) ||
      DEFAULT_ADVANCED_OPTIONS;
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
    const state = stateService.getState(this.ui.getCurrentMode());
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
    const state = stateService.getState(currentMode);
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
            ? `TEL;TYPE=WORK,VOICE:${state.officePhone}${
                state.extension ? `;x=${state.extension}` : ''
              }`
            : '',
          state.workPhone
            ? `TEL;TYPE=WORK,VOICE,MSG,PREF:${formatPhoneNumberForVCard(
                state.workPhone
              )}`
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
        return `WIFI:S:${state.wifiSsid || ''};T:${
          state.wifiEncryption || 'WPA'
        };P:${state.wifiPassword || ''};H:${
          state.wifiHidden ? 'true' : 'false'
        };;`;
      },
    };
    return generators[currentMode]!();
  };

  private buildQrConfig = (data: string): Partial<Options> => {
    const state = stateService.getState(this.ui.getCurrentMode());
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
    const state = stateService.getState(this.ui.getCurrentMode());
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
        const state = stateService.getState(currentMode);
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
    const currentMode = this.ui.getCurrentMode();
    let isQrCodeValid = true;
    let qrCodeContent = data;

    try {
      const image = await this.loadImageAsync();
      if (image) {
        config.image = image;
      } else {
        config.image = '';
      }
      await qrCode.update(config);
    } catch (error: unknown) {
      console.error('QR Code generation error:', error);
      qrCode.update({ ...config, data: '' });
      isQrCodeValid = false;
      if (
        typeof error === 'string' &&
        error.startsWith('code length overflow')
      ) {
        qrCodeContent =
          data +
          '\n\n' +
          'Invalid settings combination. The contents are too long for the selected QR code type and error correction level.';
      } else {
        qrCodeContent = data + '\n\n' + 'Invalid settings combination.';
      }
    }

    stateService.updateState(currentMode, { qrCodeContent, isQrCodeValid });
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
    const currentTabState = stateService.getState(this.ui.getCurrentMode());
    const mergedState: TabState = {
      ...currentTabState,
      ...urlState,
      anniversaryLogo:
        urlState.anniversaryLogo ?? currentTabState?.anniversaryLogo ?? false,
    };

    this.ui.getFormManager().setFormControlValues(mergedState);
    stateService.updateState(this.ui.getCurrentMode(), mergedState);

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
}
