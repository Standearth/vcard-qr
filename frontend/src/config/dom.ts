// src/config/dom.ts

// Define a type for the DOM elements object
export type DomElements = ReturnType<typeof initializeDomElements>;

// Wrap all selectors in an initialization function
export function initializeDomElements() {
  return {
    contentWrapper: document.querySelector(
      '.content-wrapper'
    ) as HTMLDivElement,
    mainGrid: document.querySelector('.main-grid') as HTMLDivElement,
    formColumn: document.querySelector('.form-column') as HTMLDivElement,
    qrPreviewColumn: document.getElementById(
      'qr-preview-column'
    ) as HTMLDivElement,
    qrcodeTextContainer: document.querySelector(
      '.qrcode-text-container'
    ) as HTMLDivElement,
    vcardTextOutput: document.getElementById(
      'qrcode-text-output'
    ) as HTMLPreElement,
    anniversaryLogoContainer: document.getElementById(
      'anniversary-logo-checkbox-container'
    ) as HTMLDivElement,
    canvasContainer: document.getElementById('canvas') as HTMLDivElement,
    tabs: document.querySelector('.tabs') as HTMLDivElement,
    qrStickyContainer: document.querySelector(
      '.qr-sticky-container'
    ) as HTMLDivElement,
    qrCanvasPlaceholder: document.getElementById(
      'qr-canvas-placeholder'
    ) as HTMLDivElement,
    qrPreviewColumnFooter: document.getElementById(
      'qr-preview-column-footer'
    ) as HTMLDivElement,
    bottomContentContainer: document.getElementById(
      'bottom-content-container'
    ) as HTMLDivElement,
    tabLinks: {
      vcard: document.querySelector(
        '.tab-link[data-tab="vcard"]'
      ) as HTMLButtonElement,
      link: document.querySelector(
        '.tab-link[data-tab="link"]'
      ) as HTMLButtonElement,
      wifi: document.querySelector(
        '.tab-link[data-tab="wifi"]'
      ) as HTMLButtonElement,
    },
    formContainers: {
      vcard: document.getElementById('vcard-form') as HTMLFormElement,
      link: document.getElementById('link-form') as HTMLFormElement,
      wifi: document.getElementById('wifi-form') as HTMLFormElement,
    },
    formFields: {
      firstName: document.getElementById('first_name') as HTMLInputElement,
      lastName: document.getElementById('last_name') as HTMLInputElement,
      org: document.getElementById('org') as HTMLInputElement,
      title: document.getElementById('title') as HTMLInputElement,
      email: document.getElementById('email') as HTMLInputElement,
      officePhone: document.getElementById('office_phone') as HTMLSelectElement,
      extension: document.getElementById('extension') as HTMLInputElement,
      workPhone: document.getElementById('work_phone') as HTMLInputElement,
      cellPhone: document.getElementById('cell_phone') as HTMLInputElement,
      website: document.getElementById('website') as HTMLInputElement,
      linkedin: document.getElementById('linkedin') as HTMLInputElement,
      whatsapp: document.getElementById('whatsapp') as HTMLInputElement,
      notes: document.getElementById('notes') as HTMLTextAreaElement,
      wifiSsid: document.getElementById('wifi_ssid') as HTMLInputElement,
      wifiPassword: document.getElementById(
        'wifi_password'
      ) as HTMLInputElement,
      wifiEncryption: document.getElementById(
        'wifi_encryption'
      ) as HTMLSelectElement,
      wifiHidden: document.getElementById('wifi_hidden') as HTMLInputElement,
      wifiPasswordContainer: document.getElementById(
        'wifi-password-container'
      ) as HTMLDivElement,
      linkUrl: document.getElementById('link_url') as HTMLInputElement,
    },
    whatsappLink: document.getElementById(
      'whatsapp-link'
    ) as HTMLParagraphElement,
    subHeadings: {
      vcard: document.querySelector(
        '.sub-heading[data-mode="vcard"]'
      ) as HTMLParagraphElement,
      link: document.querySelector(
        '.sub-heading[data-mode="link"]'
      ) as HTMLParagraphElement,
      wifi: document.querySelector(
        '.sub-heading[data-mode="wifi"]'
      ) as HTMLParagraphElement,
    },
    toggleAdvancedText: document.getElementById(
      'toggle-advanced-text'
    ) as HTMLSpanElement,
    buttons: {
      downloadVCard: document.getElementById(
        'download-vcard'
      ) as HTMLButtonElement,
      downloadPng: document.getElementById('download-png') as HTMLButtonElement,
      downloadJpg: document.getElementById('download-jpg') as HTMLButtonElement,
      downloadSvg: document.getElementById('download-svg') as HTMLButtonElement,
      sendToPhone: document.getElementById(
        'send-to-phone-button'
      ) as HTMLButtonElement,
      toggleAdvanced: document.getElementById(
        'toggle-advanced-controls'
      ) as HTMLButtonElement,
      resetStyles: document.getElementById(
        'reset-styles-button'
      ) as HTMLButtonElement,
      addToWallet: document.getElementById(
        'add-to-wallet'
      ) as HTMLButtonElement,
    },
    walletTooltip: document.getElementById('wallet-tooltip') as HTMLDivElement,
    modal: {
      overlay: document.getElementById('send-to-phone-modal') as HTMLDivElement,
      closeButton: document.getElementById(
        'modal-close-button'
      ) as HTMLButtonElement,
      qrCodeContainer: document.getElementById(
        'modal-qr-code'
      ) as HTMLDivElement,
    },
    advancedControls: {
      width: document.getElementById('form-width') as HTMLInputElement,
      height: document.getElementById('form-height') as HTMLInputElement,
      margin: document.getElementById('form-margin') as HTMLInputElement,
      optimizeSize: document.getElementById(
        'form-optimize-size'
      ) as HTMLInputElement,
      dotsType: document.getElementById('form-dots-type') as HTMLSelectElement,
      dotsColor: document.getElementById('form-dots-color') as HTMLInputElement,
      roundSize: document.getElementById('form-round-size') as HTMLInputElement,
      cornersSquareType: document.getElementById(
        'form-corners-square-type'
      ) as HTMLSelectElement,
      cornersSquareColor: document.getElementById(
        'form-corners-square-color'
      ) as HTMLInputElement,
      cornersDotType: document.getElementById(
        'form-corners-dot-type'
      ) as HTMLSelectElement,
      cornersDotColor: document.getElementById(
        'form-corners-dot-color'
      ) as HTMLInputElement,
      backgroundColor: document.getElementById(
        'form-background-color'
      ) as HTMLInputElement,
      logoUrl: document.getElementById('form-logo-url') as HTMLInputElement,
      imageFile: document.getElementById('form-image-file') as HTMLInputElement,
      hideBackgroundDots: document.getElementById(
        'form-hide-background-dots'
      ) as HTMLSelectElement,
      saveAsBlob: document.getElementById(
        'form-save-as-blob'
      ) as HTMLInputElement,
      imageSize: document.getElementById('form-image-size') as HTMLInputElement,
      imageMargin: document.getElementById(
        'form-image-margin'
      ) as HTMLInputElement,
      qrTypeNumber: document.getElementById(
        'form-qr-type-number'
      ) as HTMLInputElement,
      qrErrorCorrectionLevel: document.getElementById(
        'form-qr-error-correction-level'
      ) as HTMLSelectElement,
      showImage: document.getElementById('form-show-image') as HTMLInputElement,
      anniversaryLogo: document.getElementById(
        'anniversary_logo'
      ) as HTMLInputElement,
      container: document.getElementById('advanced-controls') as HTMLDivElement,
    },
  };
}

// Export a single, uninitialized variable
export let dom: DomElements;

// Export a function to be called once the DOM is ready
export function setupDom() {
  dom = initializeDomElements();
}
