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
  DEFAULT_ADVANCED_OPTIONS,
  DEFAULT_FORM_FIELDS,
  TabState,
} from '../config/constants';
import { generateQRCodeData } from '../utils/helpers';
import logosConfig from '../../src/config/logos.json';

import { formatPhoneNumber } from '@vcard-qr/shared-utils';

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

  getQrCode = (): AsyncQRCodeStyling => qrCode;
  getModalQrCode = (): AsyncQRCodeStyling => this.modalQrCode;

  private initializeIcons(): void {
    library.add(faDownload, faMobileAlt, faCog, faUndo);
    faDom.watch();
  }

  public handleWebsiteChange = (): void => {
    const website = dom.formFields.website.value;
    this.updateOfficePhoneField(website);
    this.updateLogoOptions(website);
  };

  private getLogoOptions(website: string, mode: Mode): string[] {
    let domain = '';
    try {
      const url = new URL(website);
      domain = url.hostname.replace(/^www\./, '');
    } catch (e) {
      // ignore invalid url
    }

    const domainTemplate =
      logosConfig[domain as keyof typeof logosConfig] || {};
    const defaultTemplate = logosConfig.default;

    const logoSet = new Set<string>();

    const addLogos = (template: { main?: string[]; wifi?: string[] }) => {
      if (mode === 'wifi' && template.wifi) {
        template.wifi.forEach((logo) => logoSet.add(logo));
      } else if (template.main) {
        template.main.forEach((logo) => logoSet.add(logo));
      }
    };

    addLogos(domainTemplate);
    addLogos(defaultTemplate);

    return Array.from(logoSet);
  }

  private updateLogoOptions(website: string): void {
    const currentMode = this.ui.getCurrentMode();
    const logoOptions = this.getLogoOptions(website, currentMode);

    this.ui.renderLogoThumbnails(logoOptions);

    if (logoOptions.length > 0) {
      dom.advancedControls.logoUrl.value = logoOptions[0];
    } else {
      dom.advancedControls.logoUrl.value = '';
    }
    this.ui.getEventManager().handleStateUpdate();
  }

  private updateOfficePhoneField(website: string): void {
    const phoneSelect = dom.formFields.officePhone;
    if (!phoneSelect) return;

    const currentState = stateService.getState(this.ui.getCurrentMode());
    const currentPhoneValue = currentState?.officePhone;
    const normalizedPhone = currentPhoneValue
      ? formatPhoneNumber(currentPhoneValue, 'E.164')
      : '';

    try {
      const rawOptions = JSON.parse(
        import.meta.env.VITE_OFFICE_PHONE_OPTIONS || '[]'
      );
      let optionsToDisplay: any = null;
      let newFieldType: 'select' | 'text';

      const defaultOptions = rawOptions.find((set: any) => !set.key);
      const isOldFormat =
        Array.isArray(rawOptions) &&
        rawOptions.length > 0 &&
        rawOptions[0].display;

      let domain = '';
      try {
        const url = new URL(website);
        domain = url.hostname.replace(/^www\./, '');
      } catch (e) {
        // ignore invalid url
      }

      const matchedOptions = rawOptions.find((set: any) => set.key === domain);

      if (matchedOptions) {
        optionsToDisplay = matchedOptions;
      } else if (isOldFormat) {
        optionsToDisplay = { phone_options: rawOptions };
      } else if (defaultOptions) {
        optionsToDisplay = defaultOptions;
      }

      if (optionsToDisplay && Array.isArray(optionsToDisplay.phone_options)) {
        newFieldType = 'select';
        const currentValue = phoneSelect.value;
        phoneSelect.innerHTML = '';
        phoneSelect.add(new Option('', ''));
        optionsToDisplay.phone_options.forEach((option: any) => {
          if (option.display && option.value) {
            phoneSelect.add(new Option(option.display, option.value));
          }
        });
        if (
          Array.from(phoneSelect.options).some(
            (opt) => opt.value === currentValue
          )
        ) {
          phoneSelect.value = currentValue;
        }
      } else {
        newFieldType = 'text';
      }

      if (currentState?.officePhoneFieldType !== newFieldType) {
        const newState: Partial<TabState> = {
          officePhoneFieldType: newFieldType,
        };
        if (newFieldType === 'text') {
          newState.officePhone = formatPhoneNumber(normalizedPhone, 'CUSTOM');
        } else {
          newState.officePhone = normalizedPhone;
        }
        stateService.updateState(this.ui.getCurrentMode(), newState);
      }
    } catch (error) {
      console.error('Error processing VITE_OFFICE_PHONE_OPTIONS:', error);
      if (currentState?.officePhoneFieldType !== 'text') {
        stateService.updateState(this.ui.getCurrentMode(), {
          officePhoneFieldType: 'text',
          officePhone: formatPhoneNumber(normalizedPhone, 'CUSTOM'),
        });
      }
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
  ): Partial<Options> & {
    dotHidingMode?: 'box' | 'shape' | 'off';
    wrapSize?: number;
  } => {
    const state = stateService.getState(this.ui.getCurrentMode());
    if (!state) return { data };

    let dotHidingMode = state.dotHidingMode;
    let imageMargin = state.imageOptions?.margin;
    if (isLiveUpdate && dotHidingMode === 'shape') {
      dotHidingMode = 'box';
      imageMargin = 0;
    }

    return {
      data,
      width: state.width,
      height: state.height,
      margin: state.margin,
      qrOptions: { ...state.qrOptions },
      imageOptions: { ...state.imageOptions, margin: imageMargin },
      dotsOptions: { ...state.dotsOptions, roundSize: state.roundSize },
      backgroundOptions: { ...state.backgroundOptions },
      cornersSquareOptions: { ...state.cornersSquareOptions },
      cornersDotOptions: { ...state.cornersDotOptions },
      dotHidingMode: dotHidingMode,
      wrapSize: state.wrapSize,
    };
  };

  private loadDefaultLogo = (): Promise<string | undefined> => {
    return new Promise((resolve, reject) => {
      const state = stateService.getState(this.ui.getCurrentMode());
      const website = state?.website || '';
      const logoOptions = this.getLogoOptions(
        website,
        this.ui.getCurrentMode()
      );
      const imageUrl = logoOptions.length > 0 ? logoOptions[0] : undefined;

      if (!imageUrl) {
        resolve(undefined);
        return;
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
      if (
        dom.advancedControls.imageFile.files &&
        dom.advancedControls.imageFile.files.length > 0
      ) {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(dom.advancedControls.imageFile.files[0]);
      } else if (state.logoUrl) {
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
            if (blob.type !== 'image/svg+xml' && blob.size > 0) {
              console.error('Logo from URL is not an SVG. Ignoring.');
              resolve(this.loadDefaultLogo());
              return;
            }
            if (blob.size === 0) {
              resolve(undefined);
              return;
            }
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
          .catch((err) => {
            console.error(err);
            resolve(this.loadDefaultLogo());
          });
      } else {
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
    const currentTabState =
      stateService.getState(this.ui.getCurrentMode()) || ({} as TabState);

    const mergedState: TabState = {
      ...currentTabState,
      ...urlState,
      logoUrl: urlState.logoUrl ?? currentTabState?.logoUrl ?? '',
    };

    if (urlState.officePhone) {
      const website = mergedState.website || DEFAULT_FORM_FIELDS.website;
      this.updateOfficePhoneField(website);
      const updatedState = stateService.getState(newMode);
      if (updatedState?.officePhoneFieldType === 'text') {
        mergedState.officePhone = formatPhoneNumber(
          urlState.officePhone,
          'CUSTOM'
        );
      } else {
        mergedState.officePhone = formatPhoneNumber(
          urlState.officePhone,
          'E.164'
        );
      }
    }

    stateService.updateState(newMode, mergedState);

    this.updateOfficePhoneField(mergedState.website || '');
    this.updateLogoOptions(mergedState.website || '');

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

    await this.updateQRCode();
    this.ui.getUrlHandler().updateUrlFromState(stateService.getState(newMode)!);

    this.ui.reinitializeStickyDimensions();

    if (this.ui.getCurrentMode() === MODES.WIFI) {
      dom.formFields.wifiEncryption.dispatchEvent(new Event('change'));
    }

    this.handleDownloadFromUrl(downloadType);

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
