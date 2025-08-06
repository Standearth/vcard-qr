// src/app/UIManager.ts

import { Mode, MODES, TabState } from '../config/constants';
import { EventManager } from './ui/EventManager';
import { FormManager } from './ui/FormManager';
import { StickyManager } from './ui/StickyManager';
import { TabManager } from './ui/TabManager';
import { UrlHandler } from './ui/UrlHandler';
import { WalletManager } from './ui/WalletManager';
import { stateService } from './StateService';
import { dom } from '../config/dom';
import { App } from './App';

export class UIManager {
  private currentMode: Mode = MODES.VCARD;

  private formManager: FormManager;
  private stickyManager: StickyManager;
  private tabManager: TabManager;
  private urlHandler: UrlHandler;

  constructor(app: App) {
    this.formManager = new FormManager(this);
    new EventManager(app, this);
    this.stickyManager = new StickyManager();
    this.tabManager = new TabManager(app, this);
    this.urlHandler = new UrlHandler(this);
    new WalletManager(this);
  }

  // Delegated methods
  switchTab = (newMode: Mode, isInitialLoad = false): void =>
    this.tabManager.switchTab(newMode, isInitialLoad);
  getActiveFormFields = () => this.formManager.getActiveFormFields();
  getFormControlValues = (): TabState =>
    this.formManager.getFormControlValues();
  setFormControlValues = (values: TabState): void =>
    this.formManager.setFormControlValues(values);
  getVCardData = (): { [key: string]: string } =>
    this.formManager.getVCardData();

  // Getters and Setters
  getCurrentMode = (): Mode => this.currentMode;
  setCurrentMode = (mode: Mode): void => {
    this.currentMode = mode;
  };
  getTabManager = (): TabManager => this.tabManager;
  getFormManager = (): FormManager => this.formManager;
  getUrlHandler = (): UrlHandler => this.urlHandler;
  getStickyManager = (): StickyManager => this.stickyManager;
  getTabState = (): TabState | undefined =>
    stateService.getState(this.currentMode);

  private renderTabsAndButtons(state: TabState): void {
    const currentMode = this.getCurrentMode();

    Object.keys(dom.tabLinks).forEach((key) => {
      const modeKey = key as Mode;
      const isActive = modeKey === currentMode;
      dom.tabLinks[modeKey].classList.toggle('active', isActive);
      dom.formContainers[modeKey].classList.toggle('active', isActive);
      dom.formContainers[modeKey].classList.toggle('hidden', !isActive);
      dom.subHeadings[modeKey].classList.toggle('hidden', !isActive);
    });

    const isVCard = currentMode === MODES.VCARD;
    const isWifi = currentMode === MODES.WIFI;
    const areButtonsVisible = state.isQrCodeValid ?? true;
    const buttonDisplay = areButtonsVisible ? 'inline-flex' : 'none';

    dom.buttons.downloadPng.style.display = buttonDisplay;
    dom.buttons.downloadJpg.style.display = buttonDisplay;
    dom.buttons.downloadSvg.style.display = buttonDisplay;
    dom.buttons.downloadVCard.style.display =
      isVCard && areButtonsVisible ? 'inline-flex' : 'none';
    dom.buttons.addToWallet.style.display =
      isVCard && areButtonsVisible ? 'inline-flex' : 'none';
    dom.anniversaryLogoContainer.style.display = isWifi ? 'none' : 'flex';
  }

  renderUIFromState = (state: TabState): void => {
    this.setFormControlValues(state);
    this.renderTabsAndButtons(state);

    dom.advancedControls.container.classList.toggle(
      'hidden',
      !state.isAdvancedControlsVisible
    );
    dom.toggleAdvancedText.textContent = state.isAdvancedControlsVisible
      ? 'Hide Advanced Controls'
      : 'Show Advanced Controls';

    dom.modal.overlay.classList.toggle('hidden', !state.isModalVisible);

    if (dom.vcardTextOutput) {
      dom.vcardTextOutput.innerHTML = (state.qrCodeContent || '').replace(
        /\n/g,
        '<br>'
      );
      dom.vcardTextOutput.style.color =
        state.isQrCodeValid === false ? 'red' : '';
    }
  };

  updateDimensions = (width: number, height: number): void => {
    const state = this.getTabState();
    if (state) {
      state.width = width;
      state.height = height;
      stateService.updateState(this.currentMode, state);
    }
  };
}
