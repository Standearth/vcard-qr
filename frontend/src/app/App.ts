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
import { formatPhoneNumber } from '@vcard-qr/shared-utils';

export let qrCode: AsyncQRCodeStyling;

export class App {
  private ui: UIManager;
  private modalQrCode: AsyncQRCodeStyling;

  constructor() {
    this.ui = new UIManager(this);
    stateService.initialize(this.ui);
    this.initializeIcons();
    this.populateOfficePhones();

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

  getQrCode = (): AsyncQRCodeStyling => qrCode;
  getModalQrCode = (): AsyncQRCodeStyling => this.modalQrCode;

  private initializeIcons(): void {
    library.add(faDownload, faMobileAlt, faCog, faUndo, faApple as any);
    faDom.watch();
  }

  private populateOfficePhones(): void {
    const phoneSelect = dom.formFields.officePhone;
    if (!phoneSelect) return;

    // Start with a blank option
    phoneSelect.add(new Option('', ''));

    try {
      const options = JSON.parse(
        import.meta.env.VITE_OFFICE_PHONE_OPTIONS || '[]'
      );
      if (Array.isArray(options)) {
        options.forEach((option) => {
          if (option.display && option.value) {
            phoneSelect.add(new Option(option.display, option.value));
          }
        });
      }
    } catch (error) {
      console.error('Error parsing VITE_OFFICE_PHONE_OPTIONS:', error);
    }
  }

  getQRCodeData = (): string => {
    const currentMode = this.ui.getCurrentMode();
    const state = stateService.getState(currentMode);
    if (!state) return '';
    return generateQRCodeData(state, currentMode);
  };

  private buildQrConfig = (
    data: string,
    isLiveUpdate: boolean
  ): Partial<Options> & { dotHidingMode?: 'box' | 'shape' | 'off' } => {
    const state = stateService.getState(this.ui.getCurrentMode());
    if (!state) return { data };

    let dotHidingMode = state.dotHidingMode;
    // If it's a live update and the user wants the expensive "shape" mode,
    // temporarily fall back to the faster "box" mode.
    if (isLiveUpdate && dotHidingMode === 'shape') {
      dotHidingMode = 'box';
    }

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
      dotHidingMode: dotHidingMode,
    };
  };

  private loadDefaultLogo = (): Promise<string | undefined> => {
    return new Promise((resolve, reject) => {
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
    });
  };

  private loadImageAsync = (): Promise<string | undefined> => {
    const state = stateService.getState(this.ui.getCurrentMode());
    if (!state?.showImage) {
      return Promise.resolve(undefined);
    }
    return new Promise((resolve, reject) => {
      // Priority 1: User-uploaded file
      if (
        dom.advancedControls.imageFile.files &&
        dom.advancedControls.imageFile.files.length > 0
      ) {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(dom.advancedControls.imageFile.files[0]);
      }
      // Priority 2: Logo from URL parameter
      else if (state.logoUrl) {
        fetch(state.logoUrl)
          .then((response) => {
            if (!response.ok) {
              return Promise.reject(
                `Failed to fetch logo from URL: ${response.statusText}`
              );
            }
            return response.blob();
          })
          .then((blob) => {
            if (blob.type !== 'image/svg+xml') {
              console.error('Logo from URL is not an SVG. Ignoring.');
              resolve(this.loadDefaultLogo()); // Fallback to default
              return;
            }
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
          .catch((err) => {
            console.error(err);
            resolve(this.loadDefaultLogo()); // Fallback to default on error
          });
      }
      // Priority 3: Default logos
      else {
        resolve(this.loadDefaultLogo());
      }
    });
  };

  updateQRCode = async (isLiveUpdate = false): Promise<boolean> => {
    const data = this.getQRCodeData();
    const config = this.buildQrConfig(data, isLiveUpdate);
    try {
      const image = await this.loadImageAsync();
      config.image = image || '';
      await qrCode.update(config);
      return true;
    } catch (error: unknown) {
      console.error('QR Code generation error:', error);
      qrCode.update({ ...config, data: '' });
      return false;
    }
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

    // Set the initial form values from the URL
    // Set the initial form values
    this.ui.getFormManager().setFormControlValues(mergedState);

    // Format phone numbers on initial load
    const phoneFields = [
      dom.formFields.workPhone,
      dom.formFields.cellPhone,
      dom.formFields.whatsapp,
    ];
    phoneFields.forEach((field) => {
      if (field.value) {
        field.value = formatPhoneNumber(field.value, 'CUSTOM');
      }
    });

    // Now, trigger a single, authoritative update to sync the rest of the app
    await this.ui.getEventManager().handleStateUpdate();

    // After the first render, re-calculate the sticky container's final position.
    this.ui.reinitializeStickyDimensions();

    if (this.ui.getCurrentMode() === MODES.WIFI) {
      dom.formFields.wifiEncryption.dispatchEvent(new Event('change'));
    }

    this.handleDownloadFromUrl(downloadType);

    // Manually trigger the scroll handler to correct layout on a scrolled page load.
    this.ui.getStickyManager().handleStickyBehavior();
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
