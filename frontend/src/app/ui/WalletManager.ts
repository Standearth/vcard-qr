// src/app/ui/WalletManager.ts

import { dom } from '../../config/dom';
import { UIManager } from '../UIManager';
import { stateService } from '../StateService';
import { generateFilename } from '../../utils/helpers.js';

export class WalletManager {
  private uiManager: UIManager;
  private tooltipTimeout?: number;

  constructor(uiManager: UIManager) {
    this.uiManager = uiManager;
    this.setupEventListeners();
    this.checkWalletVisibility();
  }

  private checkWalletVisibility(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get('appleWallet') === 'true') {
      dom.buttons.addToWallet.parentElement?.classList.remove('hidden');
    }
  }

  public validatePassFields = (): void => {
    const state = stateService.getState(this.uiManager.getCurrentMode());
    const firstName = state?.firstName?.trim();
    const lastName = state?.lastName?.trim();
    const isDisabled = !firstName && !lastName;

    dom.buttons.addToWallet.disabled = isDisabled;
    dom.buttons.addToGoogleWallet.disabled = isDisabled;
  };

  private showTooltip(): void {
    const tooltip = dom.walletTooltip;
    tooltip.classList.remove('hidden');
    // Clear any existing timer
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }
    // Hide the tooltip after 3 seconds
    this.tooltipTimeout = window.setTimeout(() => {
      tooltip.classList.add('hidden');
    }, 3000);
  }

  private setupEventListeners(): void {
    const walletButtonWrapper = dom.buttons.addToWallet.parentElement;

    if (walletButtonWrapper) {
      walletButtonWrapper.addEventListener('click', () => {
        if (dom.buttons.addToWallet.disabled) {
          this.showTooltip();
          return;
        }
        this.createApplePass();
      });
    }

    if (dom.buttons.addToGoogleWallet) {
      dom.buttons.addToGoogleWallet.addEventListener('click', () => {
        if (dom.buttons.addToGoogleWallet.disabled) {
          this.showTooltip();
          return;
        }
        this.createGooglePass();
      });
    }

    // Re-validate whenever the state changes
    stateService.subscribe(this.validatePassFields);
  }

  private getPassDataFromState() {
    const currentMode = this.uiManager.getCurrentMode();
    const state = stateService.getState(currentMode);

    if (!state) {
      console.error('No state available to generate pass.');
      return null;
    }

    return {
      firstName: state.firstName || '',
      lastName: state.lastName || '',
      organization: state.org || '',
      title: state.title || '',
      email: state.email || '',
      officePhone: state.officePhone || '',
      extension: state.extension || '',
      workPhone: state.workPhone || '',
      cellPhone: state.cellPhone || '',
      website: state.website || '',
      whatsapp: state.whatsapp || '',
      linkedin: state.linkedin || '',
      notes: state.notes || '',
      // This property is used on the backend pass.json model
      anniversaryLogo: state.anniversaryLogo || false,
    };
  }

  private async createApplePass(): Promise<void> {
    const passData = this.getPassDataFromState();
    if (!passData) return;

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/v1/passes/vcard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(passData),
      });

      if (!response.ok) {
        throw new Error('Failed to create Apple Wallet pass');
      }

      const pass = await response.blob();
      const url = window.URL.createObjectURL(pass);
      const a = document.createElement('a');
      a.href = url;

      // Reuse the centralized filename generation function
      a.download = `${generateFilename(
        this.uiManager.getCurrentMode()
      )}.pkpass`;

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Error creating Apple Wallet pass:', error);
    }
  }

  private async createGooglePass(): Promise<void> {
    const passData = this.getPassDataFromState();
    if (!passData) return;

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/v1/passes/vcard/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(passData),
      });

      if (!response.ok) {
        throw new Error('Failed to create Google Wallet pass');
      }

      const { jwt } = await response.json();
      const saveUrl = `https://pay.google.com/gp/v/save/${jwt}`;

      // Open the save URL in a new tab
      window.open(saveUrl, '_blank');
    } catch (error) {
      console.error('Error creating Google Wallet pass:', error);
    }
  }
}
