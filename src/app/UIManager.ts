import { App } from './App';
import { Mode, MODES, TabState } from '../config/constants';
import { EventManager } from './ui/EventManager';
import { FormManager } from './ui/FormManager';
import { StickyManager } from './ui/StickyManager';
import { TabManager } from './ui/TabManager';
import { UrlHandler } from './ui/UrlHandler';

export class UIManager {
  private app: App;
  private currentMode: Mode = MODES.VCARD;

  private eventManager: EventManager;
  private formManager: FormManager;
  private stickyManager: StickyManager;
  private tabManager: TabManager;
  private urlHandler: UrlHandler;

  constructor(app: App) {
    this.app = app;
    this.formManager = new FormManager(this);
    this.eventManager = new EventManager(app, this);
    this.stickyManager = new StickyManager();
    this.tabManager = new TabManager(app, this);
    this.urlHandler = new UrlHandler(this);

    this.urlHandler.populateFormFromUrl();
  }

  // Delegated methods
  populateFormFromUrl = (): void => this.urlHandler.populateFormFromUrl();
  switchTab = (newMode: Mode, isInitialLoad = false): void =>
    this.tabManager.switchTab(newMode, isInitialLoad);
  getActiveFormFields = () => this.formManager.getActiveFormFields();
  getFormControlValues = (): TabState =>
    this.formManager.getFormControlValues();
  setFormControlValues = (values: TabState): void =>
    this.formManager.setFormControlValues(values);
  setDownloadButtonVisibility = (visible: boolean): void =>
    this.formManager.setDownloadButtonVisibility(visible);

  // Getters and Setters
  getCurrentMode = (): Mode => this.currentMode;
  setCurrentMode = (mode: Mode): void => {
    this.currentMode = mode;
  };
  getTabManager = (): TabManager => this.tabManager;
  getFormManager = (): FormManager => this.formManager;
  getUrlHandler = (): UrlHandler => this.urlHandler;
}
