document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // 1. CONFIGURATION & CONSTANTS
  // ==========================================================================

  const MODES = {
    VCARD: 'vcard',
    LINK: 'link',
    WIFI: 'wifi',
  };

  const DESKTOP_BREAKPOINT_PX = 768; // Corresponds to 48rem

  const LOGO_URLS = {
    RED: './Stand_Logo_Block-RGB_Red.svg',
    ANNIVERSARY: './Stand.earth_25th-red_logo-teal_accent-RGB.svg',
    WIFI: './Stand_WiFi.svg',
  };

  const OFFICE_PHONE_ALIASES = {
    SF: '+14158634563',
    BHAM: '+13607342951',
    VAN: '+16043316201',
  };

  const DEFAULT_ADVANCED_OPTIONS = {
    width: 500,
    height: 500,
    margin: 5,
    dotsType: 'rounded',
    dotsColor: '#000000',
    roundSize: true,
    cornersSquareType: '',
    cornersSquareColor: '#000000',
    cornersDotType: '',
    cornersDotColor: '#e50b12',
    backgroundColor: '#ffffff',
    hideBackgroundDots: true,
    saveAsBlob: true,
    imageSize: 0.4,
    imageMargin: 5,
    qrTypeNumber: 0,
    qrErrorCorrectionLevel: 'Q',
    anniversaryLogo: true,
  };

  const TAB_SPECIFIC_DEFAULTS = {
    [MODES.VCARD]: {
      qrErrorCorrectionLevel: 'Q',
      width: '376',
      height: '376',
      qrTypeNumber: '18',
      margin: '10',
    },
    [MODES.LINK]: {
      qrErrorCorrectionLevel: 'H',
    },
    [MODES.WIFI]: {
      qrErrorCorrectionLevel: 'H',
      wifiEncryption: 'WPA',
    },
  };

  const DEFAULT_FORM_FIELDS = {
    firstName: '',
    lastName: '',
    org: 'Stand.earth',
    title: '',
    email: '',
    officePhone: '',
    extension: '',
    workPhone: '',
    cellPhone: '',
    website: 'https://stand.earth',
    linkedin: '',
    linkUrl: 'https://stand.earth',
    wifiSsid: '',
    wifiPassword: '',
    wifiEncryption: 'WPA',
    wifiHidden: false,
  };

  // ==========================================================================
  // 2. DOM ELEMENT SELECTION
  // ==========================================================================

  const dom = {
    contentWrapper: document.querySelector('.content-wrapper'),
    formColumn: document.querySelector('.form-column'),
    qrPreviewColumn: document.getElementById('qr-preview-column'),
    qrcodeTextContainer: document.querySelector('.qrcode-text-container'),
    vcardTextOutput: document.getElementById('qrcode-text-output'),
    anniversaryLogoContainer: document.getElementById(
      'anniversary-logo-checkbox-container'
    ),
    tabLinks: {
      vcard: document.querySelector('.tab-link[data-tab="vcard"]'),
      link: document.querySelector('.tab-link[data-tab="link"]'),
      wifi: document.querySelector('.tab-link[data-tab="wifi"]'),
    },
    formContainers: {
      vcard: document.getElementById('vcard-form'),
      link: document.getElementById('link-form'),
      wifi: document.getElementById('wifi-form'),
    },
    formFields: {
      firstName: document.getElementById('first_name'),
      lastName: document.getElementById('last_name'),
      org: document.getElementById('org'),
      title: document.getElementById('title'),
      email: document.getElementById('email'),
      officePhone: document.getElementById('office_phone'),
      extension: document.getElementById('extension'),
      workPhone: document.getElementById('work_phone'),
      cellPhone: document.getElementById('cell_phone'),
      website: document.getElementById('website'),
      linkedin: document.getElementById('linkedin'),
      wifiSsid: document.getElementById('wifi_ssid'),
      wifiPassword: document.getElementById('wifi_password'),
      wifiEncryption: document.getElementById('wifi_encryption'),
      wifiHidden: document.getElementById('wifi_hidden'),
      wifiPasswordContainer: document.getElementById('wifi-password-container'),
      linkUrl: document.getElementById('link_url'),
    },
    subHeadings: {
      vcard: document.querySelector('.sub-heading[data-mode="vcard"]'),
      link: document.querySelector('.sub-heading[data-mode="link"]'),
      wifi: document.querySelector('.sub-heading[data-mode="wifi"]'),
    },
    buttons: {
      downloadVCard: document.getElementById('download-vcard'),
      downloadPng: document.getElementById('download-png'),
      downloadJpg: document.getElementById('download-jpg'),
      downloadSvg: document.getElementById('download-svg'),
      sendToPhone: document.getElementById('send-to-phone-button'),
      toggleAdvanced: document.getElementById('toggle-advanced-controls'),
      resetStyles: document.getElementById('reset-styles-button'),
    },
    modal: {
      overlay: document.getElementById('send-to-phone-modal'),
      closeButton: document.getElementById('modal-close-button'),
      qrCodeContainer: document.getElementById('modal-qr-code'),
    },
    advancedControls: {
      width: document.getElementById('form-width'),
      height: document.getElementById('form-height'),
      margin: document.getElementById('form-margin'),
      dotsType: document.getElementById('form-dots-type'),
      dotsColor: document.getElementById('form-dots-color'),
      roundSize: document.getElementById('form-round-size'),
      cornersSquareType: document.getElementById('form-corners-square-type'),
      cornersSquareColor: document.getElementById('form-corners-square-color'),
      cornersDotType: document.getElementById('form-corners-dot-type'),
      cornersDotColor: document.getElementById('form-corners-dot-color'),
      backgroundColor: document.getElementById('form-background-color'),
      imageFile: document.getElementById('form-image-file'),
      hideBackgroundDots: document.getElementById('form-hide-background-dots'),
      saveAsBlob: document.getElementById('form-save-as-blob'),
      imageSize: document.getElementById('form-image-size'),
      imageMargin: document.getElementById('form-image-margin'),
      qrTypeNumber: document.getElementById('form-qr-type-number'),
      qrErrorCorrectionLevel: document.getElementById(
        'form-qr-error-correction-level'
      ),
      anniversaryLogo: document.getElementById('anniversary_logo'),
      container: document.getElementById('advanced-controls'),
    },
  };

  // ==========================================================================
  // 3. STATE MANAGEMENT
  // ==========================================================================

  let currentMode = MODES.VCARD;
  const tabStates = {};

  // Initialize state for each tab by merging defaults
  for (const mode in MODES) {
    const key = MODES[mode];
    tabStates[key] = {
      ...DEFAULT_ADVANCED_OPTIONS,
      ...(TAB_SPECIFIC_DEFAULTS[key] || {}),
    };
  }

  // ==========================================================================
  // 4. CORE FUNCTIONS
  // ==========================================================================

  /**
   * Builds the data string for the QR code based on the current mode.
   */
  const getQRCodeData = () => {
    const formatPhoneNumberForVCard = (phoneNumber) => {
      if (!phoneNumber) return '';
      let cleanedNumber = phoneNumber.replace(/[^0-9,+]/g, '');
      if (/^\d{10}$/.test(cleanedNumber)) {
        cleanedNumber = `+1${cleanedNumber}`;
      }
      return cleanedNumber;
    };

    const generators = {
      [MODES.VCARD]: () => {
        const {
          firstName,
          lastName,
          org,
          title,
          email,
          officePhone,
          extension,
          workPhone,
          cellPhone,
          website,
          linkedin,
        } = dom.formFields;
        const vcardLines = [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `N:${lastName.value || ''};${firstName.value || ''}`,
          `FN:${`${firstName.value || ''} ${lastName.value || ''}`.trim()}`,
          org.value ? `ORG:${org.value}` : '',
          title.value ? `TITLE:${title.value}` : '',
          email.value ? `EMAIL:${email.value}` : '',
          officePhone.value
            ? `TEL;TYPE=WORK,VOICE:${officePhone.value}${
                extension.value ? `;x=${extension.value}` : ''
              }`
            : '',
          workPhone.value
            ? `TEL;TYPE=WORK,VOICE,MSG,PREF:${formatPhoneNumberForVCard(
                workPhone.value
              )}`
            : '',
          cellPhone.value
            ? `TEL;TYPE=CELL:${formatPhoneNumberForVCard(cellPhone.value)}`
            : '',
          website.value ? `URL:${website.value}` : '',
          linkedin.value ? `URL:${linkedin.value}` : '',
          'END:VCARD',
        ];
        return vcardLines.filter(Boolean).join('\n');
      },
      [MODES.LINK]: () => dom.formFields.linkUrl.value || 'https://stand.earth',
      [MODES.WIFI]: () => {
        const { wifiSsid, wifiPassword, wifiEncryption, wifiHidden } =
          dom.formFields;
        return `WIFI:S:${wifiSsid.value || ''};T:${
          wifiEncryption.value || 'WPA'
        };P:${wifiPassword.value || ''};H:${
          wifiHidden.checked ? 'true' : 'false'
        };;`;
      },
    };

    return generators[currentMode] ? generators[currentMode]() : '';
  };

  /**
   * Prepares the configuration object for the QRCodeStyling library.
   */
  const buildQrConfig = (data) => {
    const state = tabStates[currentMode];
    return {
      data,
      width: parseInt(state.width),
      height: parseInt(state.height),
      margin: parseInt(state.margin),
      qrOptions: {
        typeNumber: parseInt(state.qrTypeNumber),
        mode: 'Byte',
        errorCorrectionLevel: state.qrErrorCorrectionLevel,
      },
      imageOptions: {
        hideBackgroundDots: state.hideBackgroundDots,
        imageSize: parseFloat(state.imageSize),
        margin: parseInt(state.imageMargin),
        saveAsBlob: state.saveAsBlob,
      },
      dotsOptions: {
        type: state.dotsType,
        color: state.dotsColor,
      },
      backgroundOptions: {
        color: state.backgroundColor,
      },
      cornersSquareOptions: {
        type: state.cornersSquareType,
        color: state.cornersSquareColor,
      },
      cornersDotOptions: {
        type: state.cornersDotType,
        color: state.cornersDotColor,
      },
    };
  };

  /**
   * Loads the appropriate logo/image for the QR code asynchronously.
   */
  const loadImageAsync = () => {
    return new Promise((resolve, reject) => {
      if (dom.advancedControls.imageFile.files.length > 0) {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(dom.advancedControls.imageFile.files[0]);
      } else {
        let imageUrl;
        if (currentMode === MODES.WIFI) {
          imageUrl = LOGO_URLS.WIFI;
        } else {
          imageUrl = tabStates[currentMode].anniversaryLogo
            ? LOGO_URLS.ANNIVERSARY
            : LOGO_URLS.RED;
        }
        fetch(imageUrl)
          .then((response) => {
            if (!response.ok)
              throw new Error('Logo network response was not ok');
            return response.blob();
          })
          .then((blob) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
          .catch(reject);
      }
    });
  };

  /**
   * Main function to generate and render the QR code.
   */
  const updateQRCode = async () => {
    const data = getQRCodeData();
    const config = buildQrConfig(data);

    try {
      const imageSrc = await loadImageAsync();
      config.image = imageSrc;
      qrCode.update(config);
      dom.vcardTextOutput.textContent = data;
      dom.vcardTextOutput.style.color = '';
      setDownloadButtonVisibility(true);
    } catch (error) {
      console.error('QR Code generation error:', error);
      qrCode.update({ ...config, data: '' });
      dom.vcardTextOutput.textContent =
        'Invalid settings combination. Could not generate QR Code.';
      dom.vcardTextOutput.style.color = 'red';
      setDownloadButtonVisibility(false);
    }
    updateUrlParameters();
  };

  /**
   * Switches the active tab and form.
   */
  const switchTab = (newMode, isInitialLoad = false) => {
    if (!isInitialLoad) {
      tabStates[currentMode] = getFormControlValues();
    }
    currentMode = newMode;

    Object.keys(dom.tabLinks).forEach((key) => {
      dom.tabLinks[key].classList.toggle('active', key === newMode);
      dom.formContainers[key].classList.toggle('active', key === newMode);
      dom.formContainers[key].classList.toggle('hidden', key !== newMode);
      dom.subHeadings[key].classList.toggle('hidden', key !== newMode);
    });

    dom.buttons.downloadVCard.style.display =
      newMode === MODES.VCARD ? 'block' : 'none';
    dom.anniversaryLogoContainer.style.display =
      newMode === MODES.WIFI ? 'none' : 'flex';

    setFormControlValues(tabStates[newMode]);

    if (!isInitialLoad) {
      updateQRCode();
    }
    handleQrTextContainerPlacement();
  };

  /**
   * Updates the URL hash with the current form parameters.
   */
  const updateUrlParameters = () => {
    const newUrlParams = new URLSearchParams();

    // Handle form fields
    const activeFormFields = getActiveFormFields();
    for (const key in activeFormFields) {
      const element = activeFormFields[key];
      const value =
        element.type === 'checkbox' ? element.checked : element.value;
      const defaultValue = getEffectiveDefaultValue(
        key,
        'formField',
        currentMode
      );

      if (String(value) !== String(defaultValue)) {
        const paramKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        newUrlParams.set(paramKey, String(value));
      }
    }

    // Handle advanced controls
    const currentTabState = tabStates[currentMode];
    for (const key in dom.advancedControls) {
      if (
        dom.advancedControls[key]?.type === 'file' ||
        !dom.advancedControls.hasOwnProperty(key)
      )
        continue;
      const value = currentTabState[key];
      const defaultValue = getEffectiveDefaultValue(
        key,
        'advancedOption',
        currentMode
      );
      if (String(value) !== String(defaultValue)) {
        const paramKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        newUrlParams.set(paramKey, String(value));
      }
    }

    const newUrl = `${
      window.location.pathname
    }#/${currentMode}/?${newUrlParams.toString()}`;
    history.replaceState(null, '', newUrl);
  };

  /**
   * Reads parameters from the URL hash and populates the form.
   */
  const populateFormFromUrl = () => {
    const params = new URLSearchParams(
      window.location.hash.split('?')[1] || ''
    );

    // Populate form fields
    const activeFormFields = getActiveFormFields();
    for (const key in activeFormFields) {
      const element = activeFormFields[key];
      const paramKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      const paramValue = params.get(paramKey);
      const defaultValue = getEffectiveDefaultValue(
        key,
        'formField',
        currentMode
      );

      if (paramValue !== null) {
        if (element.type === 'checkbox') {
          element.checked = paramValue === 'true';
        } else if (
          key === 'officePhone' &&
          OFFICE_PHONE_ALIASES[paramValue.toUpperCase()]
        ) {
          element.value = OFFICE_PHONE_ALIASES[paramValue.toUpperCase()];
        } else {
          element.value = paramValue;
        }
      } else {
        if (element.type === 'checkbox') {
          element.checked = defaultValue;
        } else {
          element.value = defaultValue;
        }
      }
    }

    // Populate advanced controls state
    const currentTabState = tabStates[currentMode];
    for (const key in dom.advancedControls) {
      const element = dom.advancedControls[key];
      if (
        element &&
        element.type !== 'file' &&
        dom.advancedControls.hasOwnProperty(key)
      ) {
        const paramKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        const paramValue = params.get(paramKey);
        const defaultValue = getEffectiveDefaultValue(
          key,
          'advancedOption',
          currentMode
        );

        if (paramValue !== null) {
          if (typeof defaultValue === 'boolean') {
            currentTabState[key] = paramValue === 'true';
          } else if (typeof defaultValue === 'number') {
            currentTabState[key] = parseFloat(paramValue) || defaultValue;
          } else {
            currentTabState[key] = paramValue;
          }
        } else {
          currentTabState[key] = defaultValue;
        }
      }
    }
    setFormControlValues(currentTabState);
  };

  /**
   * Handles the initial page load and subsequent hash changes.
   */
  const handleRouteChange = async () => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const downloadType = params.get('download');

    let newMode = MODES.VCARD;
    if (hash.includes(`#/${MODES.LINK}`)) newMode = MODES.LINK;
    if (hash.includes(`#/${MODES.WIFI}`)) newMode = MODES.WIFI;

    switchTab(newMode, true);
    populateFormFromUrl();

    if (currentMode === MODES.WIFI) {
      dom.formFields.wifiEncryption.dispatchEvent(new Event('change'));
    }

    // Workaround for a library bug on some mobile browsers
    await updateQRCode();
    setTimeout(() => updateQRCode(), 0);

    handleDownloadFromUrl(downloadType);
  };

  // --- Helper & Utility Functions ---

  const getFormControlValues = () => {
    const values = {};
    for (const key in dom.advancedControls) {
      const element = dom.advancedControls[key];
      if (element && dom.advancedControls.hasOwnProperty(key)) {
        if (element.type === 'checkbox') values[key] = element.checked;
        else if (element.type !== 'file') values[key] = element.value;
      }
    }
    return values;
  };

  const setFormControlValues = (values) => {
    for (const key in values) {
      const element = dom.advancedControls[key];
      if (element && dom.advancedControls.hasOwnProperty(key)) {
        if (element.type === 'checkbox') element.checked = values[key];
        else if (element.type !== 'file') element.value = values[key];
      }
    }
  };

  const getEffectiveDefaultValue = (key, type, mode) => {
    if (type === 'formField') {
      return DEFAULT_FORM_FIELDS[key];
    } else if (type === 'advancedOption') {
      return (
        TAB_SPECIFIC_DEFAULTS[mode]?.[key] ?? DEFAULT_ADVANCED_OPTIONS[key]
      );
    }
  };

  /**
   * CORRECTED: Returns an object containing only the DOM elements for the currently active tab.
   * This prevents state leakage between tabs.
   */
  const getActiveFormFields = () => {
    const { formFields } = dom;
    if (currentMode === MODES.LINK) {
      return { linkUrl: formFields.linkUrl };
    }
    if (currentMode === MODES.WIFI) {
      return {
        wifiSsid: formFields.wifiSsid,
        wifiPassword: formFields.wifiPassword,
        wifiEncryption: formFields.wifiEncryption,
        wifiHidden: formFields.wifiHidden,
      };
    }
    if (currentMode === MODES.VCARD) {
      return {
        firstName: formFields.firstName,
        lastName: formFields.lastName,
        org: formFields.org,
        title: formFields.title,
        email: formFields.email,
        officePhone: formFields.officePhone,
        extension: formFields.extension,
        workPhone: formFields.workPhone,
        cellPhone: formFields.cellPhone,
        website: formFields.website,
        linkedin: formFields.linkedin,
      };
    }
    return {};
  };

  const isTwoColumnLayoutActive = () =>
    window.innerWidth >= DESKTOP_BREAKPOINT_PX;

  const handleQrTextContainerPlacement = () => {
    const shouldMove =
      (currentMode === MODES.LINK || currentMode === MODES.WIFI) &&
      isTwoColumnLayoutActive();
    if (shouldMove) {
      dom.formColumn.appendChild(dom.qrcodeTextContainer);
    } else {
      dom.contentWrapper.appendChild(dom.qrcodeTextContainer);
    }
  };

  const sanitizeFilename = (name) => {
    if (!name) return '';
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_.-]/g, '')
      .replace(/__+/g, '_');
  };

  const generateFilename = () => {
    if (currentMode === MODES.VCARD) {
      const namePart = [
        dom.formFields.firstName.value,
        dom.formFields.lastName.value,
      ]
        .map(sanitizeFilename)
        .filter(Boolean)
        .join('-');
      return `Stand-QR-vCard${namePart ? `-${namePart}` : ''}`;
    }
    if (currentMode === MODES.WIFI) {
      const ssid = sanitizeFilename(dom.formFields.wifiSsid.value);
      return `Stand-QR-WiFi-${ssid || 'network'}`;
    }
    if (currentMode === MODES.LINK) {
      try {
        let urlString = dom.formFields.linkUrl.value;
        if (!/^(https?|ftp):\/\//i.test(urlString))
          urlString = `https://${urlString}`;
        const fqdn = new URL(urlString).hostname;
        return `Stand-QR-URL-${sanitizeFilename(fqdn) || 'link'}`;
      } catch (e) {
        return 'Stand-QR-URL-invalid_link';
      }
    }
    return 'qr-code';
  };

  const setDownloadButtonVisibility = (visible) => {
    const display = visible ? 'inline-block' : 'none';
    dom.buttons.downloadPng.style.display = display;
    dom.buttons.downloadJpg.style.display = display;
    dom.buttons.downloadSvg.style.display = display;
    if (currentMode === MODES.VCARD) {
      dom.buttons.downloadVCard.style.display = visible ? 'block' : 'none';
    }
  };

  const handleDownloadFromUrl = (downloadType) => {
    if (!downloadType) return;
    setTimeout(() => {
      const type = downloadType.toLowerCase();
      if (type === 'png') dom.buttons.downloadPng.click();
      if (type === 'jpg') dom.buttons.downloadJpg.click();
      if (type === 'svg') dom.buttons.downloadSvg.click();
      if (type === 'vcf' && currentMode === MODES.VCARD)
        dom.buttons.downloadVCard.click();
    }, 250);
  };

  const closeModal = () => dom.modal.overlay.classList.add('hidden');

  // ==========================================================================
  // 5. QR CODE INSTANCES
  // ==========================================================================

  const qrCode = new QRCodeStyling({
    ...DEFAULT_ADVANCED_OPTIONS,
    image: LOGO_URLS.RED,
  });
  qrCode.append(document.getElementById('canvas'));

  const modalQrCode = new QRCodeStyling({
    width: 400,
    height: 400,
    margin: 10,
  });
  modalQrCode.append(dom.modal.qrCodeContainer);

  // ==========================================================================
  // 6. EVENT LISTENERS
  // ==========================================================================

  function setupEventListeners() {
    window.addEventListener('hashchange', handleRouteChange);

    // Tab switching
    Object.values(dom.tabLinks).forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Form inputs
    Object.values(dom.formFields).forEach((field) => {
      if (field) field.addEventListener('input', updateQRCode);
    });

    // Advanced controls
    Object.values(dom.advancedControls).forEach((input) => {
      if (input && input.id) {
        input.addEventListener('input', (event) => {
          // Correctly convert kebab-case and snake_case IDs to camelCase
          const key = event.target.id
            .replace('form-', '')
            .replace(/[-_]([a-z])/g, (g) => g[1].toUpperCase());

          if (key in tabStates[currentMode]) {
            tabStates[currentMode][key] =
              event.target.type === 'checkbox'
                ? event.target.checked
                : event.target.value;
            updateQRCode();
          }
        });
      }
    });

    // Specific field logic
    dom.formFields.extension.addEventListener('input', (event) => {
      event.target.value = event.target.value.replace(/[^0-9]/g, '');
    });

    dom.formFields.wifiEncryption.addEventListener('change', () => {
      const isPasswordless = dom.formFields.wifiEncryption.value === 'nopass';
      dom.formFields.wifiPasswordContainer.style.display = isPasswordless
        ? 'none'
        : 'block';
      if (isPasswordless) dom.formFields.wifiPassword.value = '';
      updateQRCode();
    });

    // Button actions
    dom.buttons.downloadPng.addEventListener('click', () =>
      qrCode.download({ name: generateFilename(), extension: 'png' })
    );
    dom.buttons.downloadJpg.addEventListener('click', () =>
      qrCode.download({ name: generateFilename(), extension: 'jpg' })
    );
    dom.buttons.downloadSvg.addEventListener('click', () =>
      qrCode.download({ name: generateFilename(), extension: 'svg' })
    );

    dom.buttons.downloadVCard.addEventListener('click', () => {
      const blob = new Blob([getQRCodeData()], { type: 'text/vcard' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generateFilename()}.vcf`;
      a.click();
      URL.revokeObjectURL(url);
    });

    dom.buttons.toggleAdvanced.addEventListener('click', () => {
      const isHidden =
        dom.advancedControls.container.classList.toggle('hidden');
      dom.buttons.toggleAdvanced.textContent = isHidden
        ? 'Show Advanced Controls'
        : 'Hide Advanced Controls';
    });

    dom.buttons.resetStyles.addEventListener('click', () => {
      tabStates[currentMode] = {
        ...DEFAULT_ADVANCED_OPTIONS,
        ...(TAB_SPECIFIC_DEFAULTS[currentMode] || {}),
      };
      setFormControlValues(tabStates[currentMode]);
      updateQRCode();
    });

    // Modal
    dom.buttons.sendToPhone.addEventListener('click', () => {
      let finalUrl = window.location.href;
      // To ensure the download parameter is added correctly to the hash URL
      if (finalUrl.includes('?')) {
        finalUrl += '&download=png';
      } else {
        // Handles case where there are no params in the hash yet
        finalUrl += '?download=png';
      }
      modalQrCode.update({ data: finalUrl });
      dom.modal.overlay.classList.remove('hidden');
    });

    dom.modal.closeButton.addEventListener('click', closeModal);
    dom.modal.overlay.addEventListener('click', (event) => {
      if (event.target === dom.modal.overlay) closeModal();
    });
  }

  // ==========================================================================
  // 7. INITIALIZATION
  // ==========================================================================

  setupEventListeners();
  handleRouteChange();
});
