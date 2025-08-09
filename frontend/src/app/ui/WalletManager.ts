// src/app/ui/WalletManager.ts

import { dom } from '../../config/dom';
import { UIManager } from '../UIManager';
import { stateService } from '../StateService';
// Remove the old helper, we'll build the vCard on the backend now
// import { generateVCardForAppleWallet } from '../../utils/helpers';

export class WalletManager {
  private uiManager: UIManager;

  constructor(uiManager: UIManager) {
    this.uiManager = uiManager;
    this.setupEventListeners();
    this.checkWalletVisibility();
  }

  private checkWalletVisibility(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get('appleWallet') === 'true') {
      dom.buttons.addToWallet.classList.remove('hidden');
    }
  }

  private setupEventListeners(): void {
    dom.buttons.addToWallet.addEventListener('click', () => this.createPass());
  }

  private async createPass(): Promise<void> {
    const currentMode = this.uiManager.getCurrentMode();
    const state = stateService.getState(currentMode);

    if (!state) {
      console.error('No state available to generate pass.');
      return;
    }

    const passData = {
      firstName: state.firstName || '',
      lastName: state.lastName || '',
      organization: state.org || 'Stand.earth',
      title: state.title || '',
      email: state.email || '',
      officePhone: state.officePhone || '',
      extension: state.extension || '',
      workPhone: state.workPhone || '',
      cellPhone: state.cellPhone || '',
      website: state.website || '',
      linkedin: state.linkedin || '',
      notes: state.notes || '',
      // This property is used on the backend pass.json model
      anniversaryLogo: state.anniversaryLogo || false,
    };

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      // highlight-start
      // Use the new, versioned, and specific endpoint
      const response = await fetch(`${apiBaseUrl}/api/v1/passes/vcard`, {
        // highlight-end
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

      // Create a dynamic filename
      const filename = `${passData.firstName}-${passData.lastName}-vCard.pkpass`;
      a.download = filename.replace(/ /g, '-');

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Error creating Apple Wallet pass:', error);
    }
  }
}
