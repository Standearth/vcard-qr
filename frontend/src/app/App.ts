// src/app/App.ts

import AsyncQRCodeStyling from '../lib/AsyncQRCodeStyling';
import { Options } from 'qr-code-styling';
import { library, dom as faDom } from '@fortawesome/fontawesome-svg-core';
import { faApple } from '@fortawesome/free-brands-svg-icons';
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
import { generateQRCodeData } from '../utils/helpers';

export let qrCode: AsyncQRCodeStyling;

/**
 * The main application class. Orchestrates the initialization of all major components.
 */
export class App {
  private ui: UIManager;
  private modalQrCode: AsyncQRCodeStyling;

  /**
   * Initializes the application, sets up the UI and state managers,
   * and renders the initial QR code.
   */
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

  /**
   * Retrieves the current vCard data from the application state.
   * @returns An object containing the vCard data for the Apple Wallet pass.
   */
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

  /**
   * Returns the main QR code instance.
   * @returns The primary AsyncQRCodeStyling instance.
   */
  getQrCode = (): AsyncQRCodeStyling => qrCode;

  /**
   * Returns the modal QR code instance used for the "Send to Phone" feature.
   * @returns The modal's AsyncQRCodeStyling instance.
   */
  getModalQrCode = (): AsyncQRCodeStyling => this.modalQrCode;

  /**
   * Initializes the FontAwesome icons used in the application.
   */
  private initializeIcons(): void {
    library.add(faDownload, faMobileAlt, faCog, faUndo, faApple as any);
    faDom.watch();
  }

  /**
   * Generates the raw string data for the QR code based on the current application mode and state.
   * This function is pure and operates only on the state object.
   * @returns The raw data string for the QR code (vCard, URL, or WiFi string).
   */
  getQRCodeData = (): string => {
    const currentMode = this.ui.getCurrentMode();
    const state = stateService.getState(currentMode);
    if (!state) return '';
    return generateQRCodeData(state, currentMode);
  };

  /**
   * Builds the configuration object for the qr-code-styling library from the current state.
   * @param data The raw data string for the QR code.
   * @returns A partial Options object for the qr-code-styling library.
   */
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

  /**
   * Asynchronously loads the image/logo for the QR code.
   * It prioritizes a user-uploaded file, otherwise falls back to default logos.
   * @returns A promise that resolves with the base64-encoded image data string.
   */
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

  /**
   * Updates the QR code with the current data and styling options from the state.
   * This is the main re-rendering trigger for the QR code itself.
   */
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

  /**
   * Handles changes in the URL hash, updating the application state accordingly.
   * This is called on initial load and on hashchange events.
   */
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

  /**
   * Triggers a file download if a 'download' parameter is found in the URL.
   * @param downloadType The file type to download (e.g., 'png', 'svg').
   */
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
