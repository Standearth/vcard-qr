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
  DEFAULT_FORM_FIELDS,
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

  public handleOrgChange = (): void => {
    const org = dom.formFields.org.value;
    this.updateOfficePhoneField(org);
  };

  private updateOfficePhoneField(organization: string): void {
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
      const matchedOptions = rawOptions.find(
        (set: any) => set.key === organization
      );

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

      // If the field type has changed, we need to update the state
      // and potentially reformat the existing number.
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
    // If it's a live update and the user wants the expensive "shape" mode,
    // temporarily fall back to the faster "box" mode.
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
    const currentTabState =
      stateService.getState(this.ui.getCurrentMode()) || ({} as TabState);

    const mergedState: TabState = {
      ...currentTabState,
      ...urlState,
      anniversaryLogo:
        urlState.anniversaryLogo ?? currentTabState?.anniversaryLogo ?? false,
      logoUrl: urlState.logoUrl ?? currentTabState?.logoUrl ?? '',
    };

    // Directly update the central state with the merged values.
    // This will trigger a re-render via the StateService.
    stateService.updateState(newMode, mergedState);

    // Update the office phone field based on the organization from the state
    this.updateOfficePhoneField(mergedState.org || DEFAULT_FORM_FIELDS.org);

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

    // Now, trigger the QR code update and URL sync directly
    await this.updateQRCode();
    this.ui.getUrlHandler().updateUrlFromState(stateService.getState(newMode)!);

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
