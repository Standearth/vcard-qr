// frontend/src/app/App.ts

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
import {
  faWhatsapp,
  faSignalMessenger,
  faLinkedin,
} from '@fortawesome/free-brands-svg-icons';
import { UIManager } from './UIManager';
import { stateService } from './StateService';
import { dom } from '../config/dom';
import {
  Mode,
  MODES,
  DEFAULT_ADVANCED_OPTIONS,
  DEFAULT_FORM_FIELDS,
  TabState,
  PresetsConfig,
} from '../config/constants';
import { generateQRCodeData } from '../utils/helpers';
import { LogoManager } from './ui/LogoManager';
import { formatPhoneNumber } from '@vcard-qr/shared-utils';

export let qrCode: AsyncQRCodeStyling;

export class App {
  private ui: UIManager;
  private modalQrCode: AsyncQRCodeStyling;
  private logoManager: LogoManager;

  constructor() {
    this.ui = new UIManager(this);
    this.logoManager = new LogoManager();
    stateService.initialize(this.ui);
    this.initializeIcons();
    this.setupStateSubscriptions();

    const defaultState =
      stateService.getState(this.ui.getCurrentMode()) ||
      DEFAULT_ADVANCED_OPTIONS;
    qrCode = new AsyncQRCodeStyling(defaultState);
    void qrCode.append(dom.canvasContainer);

    this.modalQrCode = new AsyncQRCodeStyling({
      width: 400,
      height: 400,
      margin: 10,
    });
    void this.modalQrCode.append(dom.modal.qrCodeContainer);
    void this.handleRouteChange();
  }

  getQrCode = (): AsyncQRCodeStyling => qrCode;
  getModalQrCode = (): AsyncQRCodeStyling => this.modalQrCode;
  getLogoManager = (): LogoManager => this.logoManager;

  private initializeIcons(): void {
    library.add(
      faDownload,
      faMobileAlt,
      faCog,
      faUndo,
      faQrcode,
      faLink,
      faWhatsapp,
      faSignalMessenger,
      faLinkedin
    );
    faDom.watch();
  }

  private setupStateSubscriptions(): void {
    stateService.subscribe((newState, oldState) => {
      if (newState.website !== oldState.website) {
        this.handleWebsiteChange(newState.website);
      }
      if (newState.activeMode !== oldState.activeMode) {
        this.handleWebsiteChange(newState.website);
        void this.updateQRCode();
        this.ui.getUrlHandler().updateUrlFromState(newState);
      }
      if (newState.logoUrl !== oldState.logoUrl) {
        this.updateLogoOptions(newState.website);
      }
    });
  }

  public handleWebsiteChange = (website?: string): void => {
    this.updateOfficePhoneField(website);
    this.updateLogoOptions(website);
  };

  private updateLogoOptions(website = ''): void {
    const currentMode = this.ui.getCurrentMode();
    const logoOptions = this.logoManager.getLogoOptions(website, currentMode);
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

  private _getDomainFromUrl(urlString: string): string {
    if (!urlString) return '';
    try {
      // Prepend protocol if missing
      const urlWithProtocol = /^(https?:\/\/)/.test(urlString)
        ? urlString
        : `https://${urlString}`;
      const url = new URL(urlWithProtocol);
      return url.hostname.replace(/^www\./, '');
    } catch (_e) {
      // Return empty string for invalid URLs
      return '';
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
      const rawOptions: {
        key?: string;
        phone_options?: { display: string; value: string }[];
        display?: string;
        value?: string;
      }[] = JSON.parse(import.meta.env.VITE_OFFICE_PHONE_OPTIONS || '[]') as {
        key?: string;
        phone_options?: { display: string; value: string }[];
        display?: string;
        value?: string;
      }[];

      let optionsToDisplay: {
        phone_options?: { display: string; value: string }[];
      } | null = null;
      let newFieldType: 'select' | 'text';

      const defaultOptions = rawOptions.find((set) => !set.key);
      const isOldFormat =
        Array.isArray(rawOptions) &&
        rawOptions.length > 0 &&
        rawOptions[0].display;

      const domain = this._getDomainFromUrl(website);

      const matchedOptions = rawOptions.find((set) => set.key === domain);

      if (matchedOptions) {
        optionsToDisplay = matchedOptions;
      } else if (isOldFormat) {
        optionsToDisplay = {
          phone_options: rawOptions as unknown as {
            display: string;
            value: string;
          }[],
        };
      } else if (defaultOptions) {
        optionsToDisplay = defaultOptions;
      }

      if (optionsToDisplay && Array.isArray(optionsToDisplay.phone_options)) {
        newFieldType = 'select';
        const currentValue = phoneSelect.value;
        phoneSelect.innerHTML = '';
        phoneSelect.add(new Option('', ''));
        optionsToDisplay.phone_options.forEach((option) => {
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
    showWrapOutline?: boolean;
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
      showWrapOutline: state.showWrapOutline,
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

  updateQRCode = (isLiveUpdate = false): Promise<boolean> => {
    const data = this.getQRCodeData();
    const config = this.buildQrConfig(data, isLiveUpdate);

    return this.loadImageAsync()
      .then((image) => {
        config.image = image || '';
        qrCode.update(config); // This is synchronous
        return true;
      })
      .catch((error: unknown) => {
        console.error('QR Code generation error:', error);
        qrCode.update({ ...config, data: '' });
        return false;
      });
  };

  // frontend/src/app/App.ts

  handleRouteChange = async (): Promise<void> => {
    let hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const presetName = params.get('presets');

    if (presetName) {
      try {
        const presets = JSON.parse(
          import.meta.env.VITE_PRESETS_CONFIG
        ) as PresetsConfig;
        const preset = presets[presetName];

        if (preset) {
          const snakeCasePreset = Object.fromEntries(
            Object.entries(preset).map(([key, value]) => [
              key.replace(/([A-Z])/g, '_$1').toLowerCase(),
              value,
            ])
          );

          for (const key in snakeCasePreset) {
            params.set(key, snakeCasePreset[key]);
          }
          params.delete('presets');

          const newUrl = `${
            window.location.pathname
          }#/${MODES.VCARD}/?${params.toString()}`;
          history.replaceState(null, '', newUrl);

          hash = newUrl.split('.html')[1] || newUrl;
        }
      } catch (error) {
        console.error('Error parsing presets config:', error);
      }
    }

    const downloadType = params.get('download');
    let newMode: Mode = MODES.VCARD;
    if (hash.includes(`#/${MODES.LINK}`)) newMode = MODES.LINK;
    if (hash.includes(`#/${MODES.WIFI}`)) newMode = MODES.WIFI;

    this.ui.getTabManager().switchTab(newMode, true);

    const urlState = this.ui.getUrlHandler().getStateFromUrl();

    const currentTabState =
      stateService.getState(this.ui.getCurrentMode()) || ({} as TabState);

    // --- CORRECTED MERGE LOGIC ---
    const mergedState: TabState = {
      ...currentTabState,
      ...urlState,
      // Deep merge the nested option objects to preserve defaults
      dotsOptions: {
        ...currentTabState.dotsOptions,
        ...urlState.dotsOptions,
      },
      cornersSquareOptions: {
        ...currentTabState.cornersSquareOptions,
        ...urlState.cornersSquareOptions,
      },
      cornersDotOptions: {
        ...currentTabState.cornersDotOptions,
        ...urlState.cornersDotOptions,
      },
      backgroundOptions: {
        ...currentTabState.backgroundOptions,
        ...urlState.backgroundOptions,
      },
      imageOptions: {
        ...currentTabState.imageOptions,
        ...urlState.imageOptions,
      },
      qrOptions: {
        ...currentTabState.qrOptions,
        ...urlState.qrOptions,
      },
    };

    // This logic will now execute correctly because urlState is properly populated
    if (urlState.logoUrl) {
      const availableLogos = [...(mergedState.availableLogos || [])];
      if (!availableLogos.includes(urlState.logoUrl)) {
        availableLogos.push(urlState.logoUrl);
      }
      mergedState.availableLogos = availableLogos;
    }

    if (typeof urlState.officePhone === 'string') {
      const website =
        mergedState.website || (DEFAULT_FORM_FIELDS.website as string);
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
