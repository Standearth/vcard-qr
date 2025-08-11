// src/app/ui/EventManager.ts

import { dom } from '../../config/dom';
import { App } from '../App';
import { UIManager } from '../UIManager';
import {
  generateFilename,
  calculateAndApplyOptimalQrCodeSize,
  generateQRCodeData,
} from '../../utils/helpers';
import { stateService } from '../StateService';
import {
  Mode,
  MODES,
  DEFAULT_ADVANCED_OPTIONS,
  TAB_SPECIFIC_DEFAULTS,
  TabState,
} from '../../config/constants';

export class EventManager {
  private app: App;
  private uiManager: UIManager;
  private isOptimizing = false;
  private previousWidth = 0;

  constructor(app: App, uiManager: UIManager) {
    this.app = app;
    this.uiManager = uiManager;
    this.setupEventListeners();
  }

  private handleStateUpdate = async (): Promise<void> => {
    const currentMode = this.uiManager.getCurrentMode();
    // 1. Get the latest values from all form controls
    const newValues = this.uiManager.getFormControlValues();

    // 2. Update the state with these new values so they can be read by other functions
    stateService.updateState(currentMode, newValues);

    // 3. Generate the new QR code content string from the updated state
    const newQrCodeContent = generateQRCodeData(
      stateService.getState(currentMode)!,
      currentMode
    );

    // 4. Update the visual QR code image and get its validity
    const isQrCodeValid = await this.app.updateQRCode();

    // 5. Update the state a final time with the content and validity to trigger a single, correct render
    stateService.updateState(currentMode, {
      qrCodeContent: newQrCodeContent,
      isQrCodeValid,
    });

    this.uiManager
      .getUrlHandler()
      .updateUrlFromState(stateService.getState(currentMode)!);
  };

  private setupEventListeners(): void {
    this.previousWidth = parseInt(dom.advancedControls.width.value);
    window.addEventListener('hashchange', this.app.handleRouteChange);

    Object.values(dom.formContainers).forEach((form) => {
      form.addEventListener('submit', (event) => event.preventDefault());
    });

    Object.values(dom.tabLinks).forEach((tab) => {
      tab.addEventListener('click', () =>
        this.uiManager.getTabManager().switchTab(tab.dataset.tab as Mode)
      );
    });

    // Main form fields now correctly use the handler
    Object.values(dom.formFields).forEach((field) => {
      if (field instanceof HTMLElement) {
        field.addEventListener('input', this.handleStateUpdate);
      }
    });

    this.setupAdvancedControlsListeners();
    this.setupButtonEventListeners();
  }

  private setupButtonEventListeners(): void {
    // ... (download button listeners are unchanged)

    dom.buttons.toggleAdvanced.addEventListener('click', () => {
      const currentState = this.uiManager.getTabState();
      if (currentState) {
        const newVisibility = !currentState.isAdvancedControlsVisible;
        // This is a UI-only change, so it doesn't need the full handleStateUpdate
        Object.values(MODES).forEach((mode) => {
          stateService.updateState(mode, {
            isAdvancedControlsVisible: newVisibility,
          });
        });
        this.uiManager.renderUIFromState(
          stateService.getState(this.uiManager.getCurrentMode())!
        );
        setTimeout(() => {
          this.uiManager.getStickyManager().handleStickyBehavior();
        }, 0);
      }
    });

    dom.buttons.resetStyles.addEventListener('click', () => {
      const currentMode = this.uiManager.getCurrentMode();
      const currentState = this.uiManager.getTabState();
      if (currentState) {
        const newTabState: TabState = {
          ...currentState,
          ...DEFAULT_ADVANCED_OPTIONS,
          ...(TAB_SPECIFIC_DEFAULTS[currentMode] || {}),
          isAdvancedControlsVisible: currentState.isAdvancedControlsVisible,
          isModalVisible: false,
        };
        // Set the new state, then call the master update handler
        this.uiManager.getFormManager().setFormControlValues(newTabState);
        this.handleStateUpdate();
      }
    });

    // ... (modal button listeners are unchanged)
  }

  private setupAdvancedControlsListeners(): void {
    const { advancedControls } = dom;

    // This now correctly attaches the main handler to all advanced controls
    Object.values(advancedControls).forEach((field) => {
      if (field instanceof HTMLElement) {
        let eventType = 'input';
        if (
          field instanceof HTMLInputElement &&
          (field.type === 'checkbox' || field.type === 'radio')
        ) {
          eventType = 'change';
        } else if (field instanceof HTMLSelectElement) {
          eventType = 'change';
        }
        field.addEventListener(eventType, this.handleStateUpdate);
      }
    });
  }
}
