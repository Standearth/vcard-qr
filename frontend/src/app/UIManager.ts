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
import { generateWhatsAppLink } from '@vcard-qr/shared-utils';

/**
 * Manages all direct interactions with the DOM. It is responsible for rendering the UI
 * based on the current state and does not contain any business logic.
 */
export class UIManager {
  private currentMode: Mode = MODES.VCARD;

  private formManager: FormManager;
  private eventManager: EventManager;
  private stickyManager: StickyManager;
  private tabManager: TabManager;
  private urlHandler: UrlHandler;
  private walletManager: WalletManager;

  /**
   * Initializes all UI sub-managers.
   * @param app The main App instance.
   */
  constructor(app: App) {
    this.formManager = new FormManager(this);
    this.eventManager = new EventManager(app, this);
    this.stickyManager = new StickyManager(this);
    this.tabManager = new TabManager(app, this);
    this.urlHandler = new UrlHandler(this);
    this.walletManager = new WalletManager(this);
  }

  // Delegated methods
  /** Switches the active tab in the UI. */
  switchTab = (newMode: Mode, isInitialLoad = false): void =>
    this.tabManager.switchTab(newMode, isInitialLoad);

  /** Gets the currently active form fields based on the tab mode. */
  getActiveFormFields = () => this.formManager.getActiveFormFields();

  /** Reads all values from the form controls and returns them as a TabState object. */
  getFormControlValues = (): TabState =>
    this.formManager.getFormControlValues();

  /** Sets the values of all form controls based on a TabState object. */
  setFormControlValues = (values: TabState): void =>
    this.formManager.setFormControlValues(values);

  /** Retrieves the vCard data specifically for the Apple Wallet feature. */
  getVCardData = (): { [key: string]: string } =>
    this.formManager.getVCardData();

  // Getters and Setters
  /** Gets the current active tab mode. */
  getCurrentMode = (): Mode => this.currentMode;

  /** Sets the current active tab mode. */
  setCurrentMode = (mode: Mode): void => {
    this.currentMode = mode;
  };

  /** Gets the TabManager instance. */
  getTabManager = (): TabManager => this.tabManager;

  /** Gets the FormManager instance. */
  getFormManager = (): FormManager => this.formManager;

  /** Gets the UrlHandler instance. */
  getUrlHandler = (): UrlHandler => this.urlHandler;

  /** Gets the StickyManager instance. */
  getStickyManager = (): StickyManager => this.stickyManager;

  /** Re-calculates the dimensions for the sticky manager. */
  reinitializeStickyDimensions = (): void =>
    this.stickyManager.reInitializeDimensions();

  /** Gets the state for the current tab from the StateService. */
  getTabState = (): TabState | undefined =>
    stateService.getState(this.currentMode);

  /** Gets the EventManager instance. */
  getEventManager = (): EventManager => this.eventManager;

  /** Gets the WalletManager instance. */
  getWalletManager = (): WalletManager => this.walletManager; // Add this method

  /**
   * Renders the tab and button states (visibility, active states) based on the current application state.
   * @param state The current TabState object.
   */
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

  /**
   * The main rendering function. Updates the entire UI to match the provided state.
   * @param state The TabState object to render.
   */
  renderUIFromState = (state: TabState): void => {
    this.setFormControlValues(state);
    this.renderTabsAndButtons(state);

    // Use the shared utility to generate and display the link
    const whatsAppLink = generateWhatsAppLink(state.whatsapp);
    if (whatsAppLink) {
      dom.whatsappLink.textContent = `WhatsApp Link: ${whatsAppLink}`;
      dom.whatsappLink.classList.remove('hidden');
    } else {
      dom.whatsappLink.classList.add('hidden');
    }

    dom.advancedControls.container.classList.toggle(
      'hidden',
      !state.isAdvancedControlsVisible
    );
    dom.toggleAdvancedText.textContent = state.isAdvancedControlsVisible
      ? 'Hide Advanced Controls'
      : 'Show Advanced Controls';

    /*
     * ADD THIS LINE:
     * This toggles our new class on the main grid container, ensuring
     * the grid layout adapts when the controls are hidden.
     */
    dom.mainGrid.classList.toggle(
      'advanced-hidden',
      !state.isAdvancedControlsVisible
    );

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

  /**
   * Updates the width and height dimensions in the state and triggers a re-render.
   * @param width The new width value.
   * @param height The new height value.
   */
  updateDimensions = (width: number, height: number): void => {
    const state = this.getTabState();
    if (state) {
      state.width = width;
      state.height = height;
      stateService.updateState(this.currentMode, state);
    }
  };
}
