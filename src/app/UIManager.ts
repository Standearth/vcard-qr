// src/app/UIManager.ts

import { App } from './App';
import { Mode, MODES, TabState } from '../config/constants';
import { EventManager } from './ui/EventManager';
import { FormManager } from './ui/FormManager';
import { StickyManager } from './ui/StickyManager';
import { TabManager } from './ui/TabManager';
import { UrlHandler } from './ui/UrlHandler';
import { WalletManager } from './ui/WalletManager';
import { getTabState, updateTabState } from './state';
import { dom } from '../config/dom';

export class UIManager {
  private app: App;
  private currentMode: Mode = MODES.VCARD;

  private eventManager: EventManager;
  private formManager: FormManager;
  private stickyManager: StickyManager;
  private tabManager: TabManager;
  private urlHandler: UrlHandler;
  private walletManager: WalletManager;

  constructor(app: App) {
    this.app = app;
    this.formManager = new FormManager(this);
    this.eventManager = new EventManager(app, this);
    this.stickyManager = new StickyManager();
    this.tabManager = new TabManager(app, this);
    this.urlHandler = new UrlHandler(this);
    this.walletManager = new WalletManager(app, this);

    }

  // Delegated methods
  switchTab = (newMode: Mode, isInitialLoad = false): void =>
    this.tabManager.switchTab(newMode, isInitialLoad);
  getActiveFormFields = () => this.formManager.getActiveFormFields();
  getFormControlValues = (): TabState =>
    this.formManager.getFormControlValues();
  setFormControlValues = (values: TabState): void =>
    this.formManager.setFormControlValues(values);
  setDownloadButtonVisibility = (visible: boolean): void =>
    this.formManager.setDownloadButtonVisibility(visible);
  getVCardData = (): { [key: string]: string } => this.formManager.getVCardData();

  // Getters and Setters
  getCurrentMode = (): Mode => this.currentMode;
  setCurrentMode = (mode: Mode): void => {
    this.currentMode = mode;
  };
  getTabManager = (): TabManager => this.tabManager;
  getFormManager = (): FormManager => this.formManager;
  getUrlHandler = (): UrlHandler => this.urlHandler;
  getStickyManager = (): StickyManager => this.stickyManager;
  getTabState = (): TabState | undefined => getTabState(this.currentMode);

  updateDimensions = (width: number, height: number): void => {
    const state = this.getTabState();
    if (state) {
      state.width = width;
      state.height = height;
      dom.advancedControls.width.value = String(width);
      dom.advancedControls.height.value = String(height);
      updateTabState(this.currentMode, state);
      this.app.updateQRCode();
    }
  };
}
