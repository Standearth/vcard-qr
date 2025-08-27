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
  switchTab = (newMode: Mode, isInitialLoad = false): void => {
    this.tabManager.switchTab(newMode, isInitialLoad);
  };

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
  getWalletManager = (): WalletManager => this.walletManager;

  /**
   * Renders the tab and button states (visibility, active states) based on the current application state.
   * @param state The current TabState object.
   */
  private renderTabsAndButtons(state: TabState): void {
    const currentMode = this.getCurrentMode();

    Object.keys(dom.tabLinks).forEach((key) => {
      const modeKey = key as Mode;
      const isActive = modeKey === currentMode;
      if (dom.tabLinks[modeKey]) {
        dom.tabLinks[modeKey].classList.toggle('active', isActive);
      }
      if (dom.formContainers[modeKey]) {
        dom.formContainers[modeKey].classList.toggle('active', isActive);
        dom.formContainers[modeKey].classList.toggle('hidden', !isActive);
      }
      if (dom.subHeadings[modeKey]) {
        dom.subHeadings[modeKey].classList.toggle('hidden', !isActive);
      }
    });

    const isVCard = currentMode === MODES.VCARD;
    const areButtonsVisible = state.isQrCodeValid ?? true;
    const buttonDisplay = areButtonsVisible ? 'inline-flex' : 'none';

    if (dom.buttons.downloadPng)
      dom.buttons.downloadPng.style.display = buttonDisplay;
    if (dom.buttons.downloadJpg)
      dom.buttons.downloadJpg.style.display = buttonDisplay;
    if (dom.buttons.downloadSvg)
      dom.buttons.downloadSvg.style.display = buttonDisplay;
    if (dom.buttons.downloadVCard)
      dom.buttons.downloadVCard.style.display =
        isVCard && areButtonsVisible ? 'inline-flex' : 'none';
    if (dom.walletButtonContainer) {
      dom.walletButtonContainer.style.display =
        isVCard && areButtonsVisible ? 'inline-flex' : 'none';
    }

    // Handle office phone field visibility
    if (state.officePhoneFieldType === 'text') {
      dom.officePhoneSelectWrapper?.classList.add('hidden');
      dom.officePhoneInputWrapper?.classList.remove('hidden');
    } else {
      dom.officePhoneSelectWrapper?.classList.remove('hidden');
      dom.officePhoneInputWrapper?.classList.add('hidden');
    }
  }

  public renderLogoThumbnails(logoUrls: string[]): void {
    const container = dom.logoSelectionContainer;
    container.innerHTML = '';
    logoUrls.forEach((url) => {
      const button = document.createElement('button');
      button.className = 'logo-thumbnail';
      button.setAttribute('data-logo-url', url);
      const img = document.createElement('img');
      img.src = url;
      button.appendChild(img);
      container.appendChild(button);
    });
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
    if (dom.whatsappLink) {
      if (whatsAppLink) {
        dom.whatsappLink.textContent = `WhatsApp Link: ${whatsAppLink}`;
        dom.whatsappLink.classList.remove('hidden');
      } else {
        dom.whatsappLink.classList.add('hidden');
      }
    }

    const signalLinkContainer = dom.signalLinkContainer;
    if (state.signal && state.signal.startsWith('https://signal.me/#p/')) {
      signalLinkContainer.textContent = state.signal;
      signalLinkContainer.style.display = 'block';
    } else {
      signalLinkContainer.style.display = 'none';
    }

    if (dom.advancedControls.container) {
      dom.advancedControls.container.classList.toggle(
        'hidden',
        !state.isAdvancedControlsVisible
      );
    }
    if (dom.toggleAdvancedText) {
      dom.toggleAdvancedText.textContent = state.isAdvancedControlsVisible
        ? 'Hide Advanced Controls'
        : 'Show Advanced Controls';
    }

    if (dom.mainGrid) {
      dom.mainGrid.classList.toggle(
        'advanced-hidden',
        !state.isAdvancedControlsVisible
      );
    }

    if (dom.modal.overlay) {
      dom.modal.overlay.classList.toggle('hidden', !state.isModalVisible);
    }

    if (dom.vcardTextOutput) {
      dom.vcardTextOutput.innerHTML = (state.qrCodeContent || '').replace(
        /\n/g,
        '<br>'
      );
      dom.vcardTextOutput.style.color =
        state.isQrCodeValid === false ? 'red' : '';
    }

    // Disable the "shape" hiding option if the dot type doesn't support it.
    const dotsType = state.dotsOptions?.type;
    const hideDotsSelect = dom.advancedControls.hideBackgroundDots;
    if (hideDotsSelect) {
      const shapeOption = hideDotsSelect.querySelector('option[value="shape"]');

      if (shapeOption) {
        const isShapeHidingSupported =
          dotsType === 'dots' || dotsType === 'square';
        (shapeOption as HTMLOptionElement).disabled = !isShapeHidingSupported;

        // If shape hiding is not supported and is currently selected,
        // visually change the dropdown. The state will sync on the next input event.
        if (!isShapeHidingSupported && hideDotsSelect.value === 'shape') {
          hideDotsSelect.value = 'box';
        }
      }
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
