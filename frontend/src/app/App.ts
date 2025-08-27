// src/app/App.ts

import AsyncQRCodeStyling from '../lib/AsyncQRCodeStyling';
import { Options } from 'qr-code-styling';
import { library, dom as faDom } from '@fortawesome/fontawesome-svg-core';
import {
  faDownload,
  faMobileAlt,
  faCog,
  faUndo,
  faQrcode,
  faLink,
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
    this.setupStateSubscriptions();

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
    library.add(faDownload, faMobileAlt, faCog, faUndo, faQrcode, faLink);
    faDom.watch();
  }

  private setupStateSubscriptions(): void {
    stateService.subscribe((newState, oldState) => {
      // When the website URL changes, update logos and office phone options
      if (newState.website !== oldState.website) {
        this.handleWebsiteChange(newState.website);
      }

      // When the active tab changes, also trigger these updates
      if (newState.activeMode !== oldState.activeMode) {
        this.handleWebsiteChange(newState.website);
        this.updateQRCode();
        this.ui.getUrlHandler().updateUrlFromState(newState);
      }

      // When the logoUrl changes, update logo options to include the new image
      if (newState.logoUrl !== oldState.logoUrl) {
        this.updateLogoOptions(newState.website);
      }
    });
  }

  private _getDomainFromUrl(urlString: string): string {
    if (!urlString) return '';
    try {
      // Prepend protocol if missing
      const urlWithProtocol = /^(https?:\/\/)/.test(urlString)
        ? urlString
        : `https://${urlString}`;
      const url = new URL(urlWithProtocol);
      return url.hostname.replace(/^www\./, '');
    } catch (e) {
      // Return empty string for invalid URLs
      return '';
    }
  }

  public handleWebsiteChange = (website?: string): void => {
    this.updateOfficePhoneField(website);
    this.updateLogoOptions(website);
  };

  private getLogoOptions(website: string, mode: Mode): string[] {
    const domain = this._getDomainFromUrl(website);
    const currentState = stateService.getState(this.ui.getCurrentMode());
    const sessionLogos = currentState?.availableLogos || [];

    const domainTemplate =
      logosConfig[domain as keyof typeof logosConfig] || {};
    const defaultTemplate = logosConfig.default;

    const logoSet = new Set<string>();

    // Add session logos first to ensure they are available
    sessionLogos.forEach((logo) => logoSet.add(logo));

    const addLogos = (template: { main?: string[]; wifi?: string[] }) => {
      if (mode === 'wifi' && template.wifi) {
        template.wifi.forEach((logo) => logo && logoSet.add(logo));
      } else if (template.main) {
        template.main.forEach((logo) => logo && logoSet.add(logo));
      }
    };

    addLogos(domainTemplate);
    addLogos(defaultTemplate);

    return Array.from(logoSet);
  }

  private updateLogoOptions(website = ''): void {
    const currentMode = this.ui.getCurrentMode();
    const logoOptions = this.getLogoOptions(website, currentMode);
    const currentState = stateService.getState(currentMode);
    const currentLogoUrl = currentState?.logoUrl;

    const finalLogoOptions = [...logoOptions];

    if (currentLogoUrl && !logoOptions.includes(currentLogoUrl)) {
      finalLogoOptions.unshift(currentLogoUrl);
    }

    this.ui.renderLogoThumbnails(finalLogoOptions);
    if (
      finalLogoOptions.length > 0 &&
      !finalLogoOptions.includes(currentLogoUrl || '')
    ) {
      stateService.updateState(currentMode, { logoUrl: finalLogoOptions[0] });
    }
  }

  private updateOfficePhoneField(website = ''): void {
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

      const domain = this._getDomainFromUrl(website);

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

  private loadImageAsync = (): Promise<string | undefined> => {
    const state = stateService.getState(this.ui.getCurrentMode());

    if (!state || !state.showImage || !state.logoUrl) {
      return Promise.resolve(undefined);
    }

    return new Promise((resolve) => {
      if (state.logoUrl) {
        if (state.logoUrl.startsWith('data:image')) {
          resolve(state.logoUrl);
        } else {
          fetch(state.logoUrl)
            .then((response) => {
              if (!response.ok) {
                resolve(undefined);
                return;
              }
              response
                .blob()
                .then((blob) => {
                  if (blob.type !== 'image/svg+xml' && blob.size > 0) {
                    console.error('Logo from URL is not an SVG. Ignoring.');
                    resolve(undefined);
                    return;
                  }
                  if (blob.size === 0) {
                    resolve(undefined);
                    return;
                  }
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.onerror = () => resolve(undefined);
                  reader.readAsDataURL(blob);
                })
                .catch(() => resolve(undefined));
            })
            .catch((err) => {
              console.error(err);
              resolve(undefined);
            });
        }
      } else {
        resolve(undefined);
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
    };

    if (urlState.logoUrl) {
      const availableLogos = [...(mergedState.availableLogos || [])];
      if (!availableLogos.includes(urlState.logoUrl)) {
        availableLogos.push(urlState.logoUrl);
      }
      mergedState.availableLogos = availableLogos;
    }

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

    this.updateLogoOptions(mergedState.website || '');
    this.updateOfficePhoneField(mergedState.website || '');

    const phoneFields = [
      dom.formFields.workPhone,
      dom.formFields.cellPhone,
      dom.formFields.whatsapp,
      dom.formFields.signal,
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
