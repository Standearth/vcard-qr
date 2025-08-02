const defaultAdvancedOptions = {
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

const STAND_LOGO_RED = './Stand_Logo_Block-RGB_Red.svg';
const STAND_LOGO_25 = './Stand.earth_25th-red_logo-teal_accent-RGB.svg';
const STAND_LOGO_WIFI = './Stand_WiFi.svg';

const tabSpecificDefaults = {
  vcard: {
    qrErrorCorrectionLevel: 'Q',
    width: '376',
    height: '376',
    qrTypeNumber: '18',
    margin: '10',
  },
  link: {
    qrErrorCorrectionLevel: 'H',
  },
  wifi: {
    qrErrorCorrectionLevel: 'H',
    wifiEncryption: 'WPA',
  },
};

const defaultFormFields = {
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

const officePhoneAliases = {
  SF: '415-863-4563',
  BHAM: '360-734-2951',
  VAN: '604-331-6201',
};

document.addEventListener('DOMContentLoaded', () => {
  // --- 1. Get DOM Elements and URL parameters ---
  let currentMode = 'vcard'; // Default mode

  // Object to store advanced control states for each tab
  const tabStates = {
    vcard: {},
    link: {},
    wifi: {},
  };

  // --- Form and Tab Elements ---
  const tabLinks = {
    vcard: document.querySelector('.tab-link[data-tab="vcard"]'),
    link: document.querySelector('.tab-link[data-tab="link"]'),
    wifi: document.querySelector('.tab-link[data-tab="wifi"]'),
  };

  const formContainers = {
    vcard: document.getElementById('vcard-form'),
    link: document.getElementById('link-form'),
    wifi: document.getElementById('wifi-form'),
  };

  const formColumn = document.querySelector('.form-column');
  const qrPreviewColumn = document.getElementById('qr-preview-column');

  const formFields = {
    // vCard fields
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
    // WiFi fields
    wifiSsid: document.getElementById('wifi_ssid'),
    wifiPassword: document.getElementById('wifi_password'),
    wifiEncryption: document.getElementById('wifi_encryption'),
    wifiHidden: document.getElementById('wifi_hidden'),
    wifiPasswordContainer: document.getElementById('wifi-password-container'),
    // Link fields
    linkUrl: document.getElementById('link_url'),
  };

  const qrcodeTextContainer = document.querySelector('.qrcode-text-container');
  const contentWrapper = document.querySelector('.content-wrapper');
  const vcardTextOutput = document.getElementById('qrcode-text-output');
  const downloadVCardButton = document.getElementById('download-vcard');
  const downloadPngButton = document.getElementById('download-png');
  const downloadJpgButton = document.getElementById('download-jpg');
  const downloadSvgButton = document.getElementById('download-svg');
  const subHeading = document.querySelector('.sub-heading');

  // --- Advanced Control Elements ---
  const formControls = {
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
  };

  // --- 2. Initialize QR Code instance ---
  const qrCode = new QRCodeStyling({
    width: parseInt(formControls.width.value),
    height: parseInt(formControls.height.value),
    margin: parseInt(formControls.margin.value),
    image: STAND_LOGO_RED,
  });
  qrCode.append(document.getElementById('canvas'));

  // --- 3. Core Functions ---

  const getFormControlValues = () => {
    const values = {};
    for (const key in formControls) {
      const element = formControls[key];
      if (element) {
        if (element.type === 'checkbox') {
          values[key] = element.checked;
        } else if (element.type === 'file') {
          // File input values cannot be directly set/get this way
          // We'll handle image separately in updateQRCode
          continue;
        } else {
          values[key] = element.value;
        }
      }
    }
    return values;
  };

  const setFormControlValues = (values) => {
    for (const key in values) {
      const element = formControls[key];
      if (element) {
        if (element.type === 'checkbox') {
          element.checked = values[key];
        } else if (element.type === 'file') {
          // File input values cannot be directly set/get this way
          continue;
        } else {
          element.value = values[key];
        }
      }
    }
  };

  const getEffectiveDefaultValue = (key, type, mode) => {
    if (type === 'formField') {
      return defaultFormFields[key];
    } else if (type === 'advancedOption') {
      if (
        tabSpecificDefaults[mode] &&
        tabSpecificDefaults[mode][key] !== undefined
      ) {
        return tabSpecificDefaults[mode][key];
      }
      return defaultAdvancedOptions[key];
    }
    return undefined;
  };

  const getActiveFormFields = () => {
    const activeFields = {};
    if (currentMode === 'vcard') {
      for (const key in formFields) {
        if (formFields[key] && formFields[key].closest('#vcard-form')) {
          activeFields[key] = formFields[key];
        }
      }
    } else if (currentMode === 'link') {
      activeFields.linkUrl = formFields.linkUrl;
    } else if (currentMode === 'wifi') {
      activeFields.wifiSsid = formFields.wifiSsid;
      activeFields.wifiPassword = formFields.wifiPassword;
      activeFields.wifiEncryption = formFields.wifiEncryption;
      activeFields.wifiHidden = formFields.wifiHidden;
    }
    return activeFields;
  };

  // Initialize tabStates with default values
  for (const mode in tabStates) {
    tabStates[mode] = { ...defaultAdvancedOptions };
    if (tabSpecificDefaults[mode]) {
      Object.assign(tabStates[mode], tabSpecificDefaults[mode]);
    }
  }

  const switchTab = (newMode, isInitialLoad = false) => {
    // Save current tab's state before switching
    if (!isInitialLoad) {
      tabStates[currentMode] = getFormControlValues();
    }

    currentMode = newMode;

    // Update tab links
    for (const key in tabLinks) {
      tabLinks[key].classList.toggle('active', key === newMode);
    }

    // Update form visibility
    for (const key in formContainers) {
      formContainers[key].classList.toggle('active', key === newMode);
      formContainers[key].classList.toggle('hidden', key !== newMode);
    }

    // Update UI elements based on mode
    downloadVCardButton.style.display = newMode === 'vcard' ? 'block' : 'none';
    const anniversaryLogoContainer = document.getElementById(
      'anniversary-logo-checkbox-container'
    );

    if (newMode === 'vcard') {
      subHeading.textContent =
        "Enter or edit your details below to generate your QR Code. Delete any fields you don't want to include.";
      anniversaryLogoContainer.style.display = 'flex';
    } else if (newMode === 'link') {
      subHeading.textContent = 'Enter a URL to generate a QR code.';
      anniversaryLogoContainer.style.display = 'flex';
    } else if (newMode === 'wifi') {
      subHeading.textContent =
        'Enter your WiFi details to generate a QR code for network access.';
      anniversaryLogoContainer.style.display = 'none';
    }

    // Load new tab's state
    setFormControlValues(tabStates[newMode]);

    if (!isInitialLoad) {
      updateQRCode();
      updateUrlParameters();
    }
    handleQrTextContainerPlacement();
  };

  const isTwoColumnLayoutActive = () => {
    return window.innerWidth >= 768; // Corresponds to 48rem
  };

  const handleQrTextContainerPlacement = () => {
    if (
      (currentMode === 'link' || currentMode === 'wifi') &&
      isTwoColumnLayoutActive()
    ) {
      formColumn.appendChild(qrcodeTextContainer);
    } else {
      // Ensure it's in its original place if not link/wifi or not two-column
      contentWrapper.appendChild(qrcodeTextContainer);
    }
  };

  const getQRCodeData = () => {
    const formatPhoneNumberForVCard = (phoneNumber) => {
      if (!phoneNumber) return '';
      // Remove all characters other than 0-9, comma ',' and the plus sign '+'
      let cleanedNumber = phoneNumber.replace(/[^0-9,+]/g, '');

      // If the resulting number is only 10 digits and nothing else, add '+1' to the start
      if (/^\d{10}$/.test(cleanedNumber)) {
        cleanedNumber = '+1' + cleanedNumber;
      }
      return cleanedNumber;
    };

    if (currentMode === 'vcard') {
      const vcardLines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:${formFields.lastName.value || ''};${
          formFields.firstName.value || ''
        }`,
        `FN:${
          (formFields.firstName.value || '') +
          ' ' +
          (formFields.lastName.value || '')
        }`.trim(),
        formFields.org.value ? `ORG:${formFields.org.value}` : '',
        formFields.title.value ? `TITLE:${formFields.title.value}` : '',
        formFields.email.value ? `EMAIL:${formFields.email.value}` : '',
        formFields.officePhone.value
          ? `TEL;TYPE=WORK,VOICE:${formFields.officePhone.value}${
              formFields.extension.value
                ? ';x=' + formFields.extension.value
                : ''
            }`
          : '',
        formFields.workPhone.value
          ? `TEL;TYPE=WORK,VOICE,MSG,PREF:${formatPhoneNumberForVCard(
              formFields.workPhone.value
            )}`
          : '',
        formFields.cellPhone.value
          ? `TEL;TYPE=CELL:${formatPhoneNumberForVCard(
              formFields.cellPhone.value
            )}`
          : '',
        formFields.website.value ? `URL:${formFields.website.value}` : '',
        formFields.linkedin.value ? `URL:${formFields.linkedin.value}` : '',
        'END:VCARD',
      ];
      return vcardLines.filter((line) => line).join('\n');
    } else if (currentMode === 'link') {
      return formFields.linkUrl.value || 'https://stand.earth';
    } else if (currentMode === 'wifi') {
      const ssid = formFields.wifiSsid.value || '';
      const password = formFields.wifiPassword.value || '';
      const encryption = formFields.wifiEncryption.value || 'WPA';
      const hidden = formFields.wifiHidden.checked ? 'true' : 'false';

      // Format for WIFI QR code (ZXing standard)
      // WIFI:S:<SSID>;T:<ENCRYPTION>;P:<PASSWORD>;H:<HIDDEN>;;
      return `WIFI:S:${ssid};T:${encryption};P:${password};H:${hidden};;`;
    }
    return '';
  };

  const updateQRCode = async () => {
    const data = getQRCodeData();

    const newQrConfig = {
      data: data,
      width: parseInt(tabStates[currentMode].width),
      height: parseInt(tabStates[currentMode].height),
      margin: parseInt(tabStates[currentMode].margin),
      qrOptions: {
        typeNumber: parseInt(tabStates[currentMode].qrTypeNumber),
        mode: 'Byte',
        errorCorrectionLevel: tabStates[currentMode].qrErrorCorrectionLevel,
      },
      imageOptions: {
        hideBackgroundDots: tabStates[currentMode].hideBackgroundDots,
        imageSize: parseFloat(tabStates[currentMode].imageSize),
        margin: parseInt(tabStates[currentMode].imageMargin),
        saveAsBlob: tabStates[currentMode].saveAsBlob,
      },
      dotsOptions: {
        type: tabStates[currentMode].dotsType,
        color: tabStates[currentMode].dotsColor,
        roundSize: tabStates[currentMode].roundSize, // Ensure this is read
      },
      backgroundOptions: {
        color: tabStates[currentMode].backgroundColor,
      },
      cornersSquareOptions: {
        type: tabStates[currentMode].cornersSquareType,
        color: tabStates[currentMode].cornersSquareColor,
      },
      cornersDotOptions: {
        type: tabStates[currentMode].cornersDotType,
        color: tabStates[currentMode].cornersDotColor,
      },
    };

    try {
      if (formControls.imageFile.files.length > 0) {
        const reader = new FileReader();
        reader.onload = (event) => {
          newQrConfig.image = event.target.result;
          qrCode.update(newQrConfig);
        };
        reader.readAsDataURL(formControls.imageFile.files[0]);
      } else {
        if (currentMode === 'wifi') {
          newQrConfig.image = STAND_LOGO_WIFI;
        } else {
          newQrConfig.image = tabStates[currentMode].anniversaryLogo
            ? STAND_LOGO_25
            : STAND_LOGO_RED;
        }
        qrCode.update(newQrConfig);
      }
      vcardTextOutput.textContent = data;
      vcardTextOutput.style.color = ''; // Reset color on success
      setDownloadButtonVisibility(true);
    } catch (error) {
      console.error('QR Code generation error:', error);
      // Attempt to clear the QR code by updating with empty data
      qrCode.update({ ...newQrConfig, data: '' });
      vcardTextOutput.textContent = 'Invalid settings combination.';
      vcardTextOutput.style.color = 'red'; // Style the error message
      setDownloadButtonVisibility(false);
    }
    updateUrlParameters();
  };

  const setDownloadButtonVisibility = (visible) => {
    downloadPngButton.style.display = visible ? 'inline-block' : 'none';
    downloadJpgButton.style.display = visible ? 'inline-block' : 'none';
    downloadSvgButton.style.display = visible ? 'inline-block' : 'none';
    // vCard button visibility is handled by switchTab, but we can hide it here too if needed
    if (currentMode === 'vcard') {
      downloadVCardButton.style.display = visible ? 'block' : 'none';
    }
  };

  const updateUrlParameters = () => {
    const newUrlParams = new URLSearchParams();

    // Handle form fields parameters (QR code data)
    const activeFormFields = getActiveFormFields();
    for (const key in activeFormFields) {
      const element = activeFormFields[key];
      let value = element.value;
      if (element.type === 'checkbox') {
        value = element.checked;
      }

      const paramKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      const defaultValue = getEffectiveDefaultValue(
        key,
        'formField',
        currentMode
      );

      // Perform type-aware comparison for form fields
      let valuesMatch = false;
      if (element.type === 'checkbox') {
        valuesMatch = value === defaultValue; // Direct comparison of booleans
      } else if (typeof defaultValue === 'number') {
        valuesMatch = parseFloat(value) === defaultValue;
      } else {
        valuesMatch = value === defaultValue;
      }

      // Only include if different from default
      if (!valuesMatch) {
        newUrlParams.set(paramKey, String(value));
      } else {
        newUrlParams.delete(paramKey);
      }
    }

    // Handle advanced control parameters
    const currentTabState = tabStates[currentMode];
    for (const key in formControls) {
      const element = formControls[key];
      if (element && element.type !== 'file') {
        // Skip file input, handled separately
        let value = currentTabState[key]; // Get value from tabStates, which is already type-correct

        const paramKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        const defaultValue = getEffectiveDefaultValue(
          key,
          'advancedOption',
          currentMode
        );

        // Perform type-aware comparison
        let valuesMatch = false;
        if (typeof defaultValue === 'number') {
          valuesMatch = parseFloat(value) === defaultValue;
        } else if (typeof defaultValue === 'boolean') {
          valuesMatch = value === defaultValue; // Direct comparison of booleans
        } else {
          valuesMatch = value === defaultValue;
        }

        // Only include if different from default
        if (!valuesMatch) {
          newUrlParams.set(paramKey, String(value));
        } else {
          newUrlParams.delete(paramKey);
        }
      }
    }

    const newUrl = `${
      window.location.pathname
    }#/${currentMode}/?${newUrlParams.toString()}`;
    history.replaceState(null, '', newUrl);
  };

  const handleRouteChange = () => {
    const hash = window.location.hash;
    let mode = 'vcard';
    if (hash.includes('#/link')) {
      mode = 'link';
    } else if (hash.includes('#/wifi')) {
      mode = 'wifi';
    }
    switchTab(mode, true); // Pass true for initial load
    populateFormFromUrl();
    // Trigger change event for wifiEncryption to correctly set password field visibility
    if (currentMode === 'wifi') {
      formFields.wifiEncryption.dispatchEvent(new Event('change'));
    }
    updateQRCode(); // Update QR code after populating form
  };

  const populateFormFromUrl = () => {
    const params = new URLSearchParams(
      window.location.hash.split('?')[1] || ''
    );

    // Populate form fields based on current mode
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
          officePhoneAliases[paramValue.toUpperCase()]
        ) {
          element.value = officePhoneAliases[paramValue.toUpperCase()];
        } else {
          element.value = paramValue;
        }
      } else {
        // If parameter not in URL, set to its effective default
        if (element.type === 'checkbox') {
          element.checked = defaultValue;
        } else {
          element.value = defaultValue;
        }
      }
    }

    // Special handling for officePhone and extension
    if (formFields.extension.value && !formFields.officePhone.value) {
      // If extension is present but officePhone is not selected, default to the first option
      const firstOfficePhoneOption = formFields.officePhone.querySelector(
        'option:not([value=""])'
      );
      if (firstOfficePhoneOption) {
        formFields.officePhone.value = firstOfficePhoneOption.value;
      }
    }

    // Populate advanced control parameters from URL into tabStates
    const currentTabState = tabStates[currentMode];
    for (const key in formControls) {
      const element = formControls[key];
      if (element && element.type !== 'file') {
        // Skip file input, handled separately
        const paramKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        const paramValue = params.get(paramKey);
        const camelCaseKey = key;

        if (paramValue !== null) {
          if (element.type === 'checkbox') {
            currentTabState[camelCaseKey] = paramValue === 'true';
          } else {
            let parsedValue = paramValue;
            const defaultValue = getEffectiveDefaultValue(
              camelCaseKey,
              'advancedOption',
              currentMode
            );
            if (typeof defaultValue === 'number') {
              parsedValue = parseFloat(paramValue);
              if (isNaN(parsedValue)) {
                parsedValue = defaultValue; // Fallback to default if parsing fails
              }
            }
            currentTabState[camelCaseKey] = parsedValue;
          }
        } else {
          // If parameter is not in URL, set to default from tabSpecificDefaults or defaultAdvancedOptions
          const defaultValue = getEffectiveDefaultValue(
            camelCaseKey,
            'advancedOption',
            currentMode
          );
          currentTabState[camelCaseKey] = defaultValue;
        }
      }
    }
    // Apply the loaded state to the form controls
    setFormControlValues(currentTabState);
  };

  // --- 4. Event Listeners ---
  Object.values(tabLinks).forEach((tab) => {
    tab.addEventListener('click', () => {
      const mode = tab.getAttribute('data-tab');
      switchTab(mode);
    });
  });

  Object.values(formFields).forEach((field) => {
    if (field) {
      field.addEventListener('input', updateQRCode);
    }
  });

  // Add input filtering for the extension field
  if (formFields.extension) {
    formFields.extension.addEventListener('input', (event) => {
      event.target.value = event.target.value.replace(/[^0-9]/g, '');
      // If extension is present but officePhone is not selected, default to the first option
      if (event.target.value && !formFields.officePhone.value) {
        const firstOfficePhoneOption = formFields.officePhone.querySelector(
          'option:not([value=""])'
        );
        if (firstOfficePhoneOption) {
          formFields.officePhone.value = firstOfficePhoneOption.value;
        }
      }
      updateQRCode();
    });
  }

  formFields.wifiEncryption.addEventListener('change', () => {
    if (formFields.wifiEncryption.value === 'nopass') {
      formFields.wifiPassword.value = ''; // Clear password
      formFields.wifiPasswordContainer.style.display = 'none'; // Hide password field
    } else {
      formFields.wifiPasswordContainer.style.display = 'block'; // Show password field
    }
    updateQRCode();
  });

  // Clear extension if officePhone is blank
  if (formFields.officePhone) {
    formFields.officePhone.addEventListener('change', (event) => {
      if (event.target.value === '') {
        formFields.extension.value = '';
        updateQRCode();
      }
    });
  }

  window.addEventListener('hashchange', handleRouteChange);

  // Advanced controls listeners
  const advancedControlInputs = [
    formControls.width,
    formControls.height,
    formControls.margin,
    formControls.dotsType,
    formControls.dotsColor,
    formControls.roundSize,
    formControls.cornersSquareType,
    formControls.cornersSquareColor,
    formControls.cornersDotType,
    formControls.cornersDotColor,
    formControls.backgroundColor,
    formControls.imageFile,
    formControls.hideBackgroundDots,
    formControls.saveAsBlob,
    formControls.imageSize,
    formControls.imageMargin,
    formControls.qrTypeNumber,
    formControls.qrErrorCorrectionLevel,
    formControls.anniversaryLogo,
  ];
  advancedControlInputs.forEach((input) => {
    if (input) {
      input.addEventListener('input', (event) => {
        const key = event.target.id
          .replace('form-', '') // Remove 'form-' prefix
          .replace(/-([a-z])/g, (g) => g[1].toUpperCase()) // Convert kebab-case to camelCase
          .replace(/_([a-z])/g, (g) => g[1].toUpperCase()); // Convert snake_case to camelCase
        let newValue;
        if (event.target.type === 'checkbox') {
          newValue = event.target.checked;
        } else {
          newValue = event.target.value;
        }
        tabStates[currentMode][key] = newValue;
        updateQRCode();
      });
    }
  });

  document
    .getElementById('toggle-advanced-controls')
    .addEventListener('click', () => {
      const advancedControls = document.getElementById('advanced-controls');
      advancedControls.classList.toggle('hidden');
      const button = document.getElementById('toggle-advanced-controls');
      button.textContent = advancedControls.classList.contains('hidden')
        ? 'Show Advanced Controls'
        : 'Hide Advanced Controls';
    });

  document
    .getElementById('reset-styles-button')
    .addEventListener('click', () => {
      // Reset advanced options for the current tab to default
      tabStates[currentMode] = { ...defaultAdvancedOptions };
      if (tabSpecificDefaults[currentMode]) {
        Object.assign(tabStates[currentMode], tabSpecificDefaults[currentMode]);
      }
      setFormControlValues(tabStates[currentMode]);

      // Update QR code and URL after resetting
      updateQRCode();
      updateUrlParameters();
    });

  // Download buttons
  document
    .getElementById('download-png')
    .addEventListener('click', () =>
      qrCode.download({ name: 'qr-code', extension: 'png' })
    );
  document
    .getElementById('download-jpg')
    .addEventListener('click', () =>
      qrCode.download({ name: 'qr-code', extension: 'jpeg' })
    );
  document
    .getElementById('download-svg')
    .addEventListener('click', () =>
      qrCode.download({ name: 'qr-code', extension: 'svg' })
    );
  downloadVCardButton.addEventListener('click', () => {
    const vcardContent = getQRCodeData();
    const blob = new Blob([vcardContent], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vcard.vcf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // --- 5. Initial Load ---
  handleRouteChange();

  // --- Sticky QR Code ---
  let qrCodeOriginalTop = qrPreviewColumn.offsetTop; // Initial top position of the QR code column

  const handleScroll = () => {
    const scrollY = window.scrollY;
    const rootFontSize = parseFloat(
      getComputedStyle(document.documentElement).fontSize
    );
    const stickyOffset = rootFontSize; // 1rem

    // Calculate the point where the sticky element would normally stop sticking
    // This is when the bottom of its parent container scrolls past the top of the viewport
    const parentElement = qrPreviewColumn.parentElement; // This should be .main-grid column
    const parentBottom = parentElement.offsetTop + parentElement.offsetHeight;

    // The QR code column will stick at `stickyOffset` from the top of its parent.
    // It will stop sticking when the bottom of its parent container
    // minus the height of the QR code column (plus its sticky offset)
    // is less than the current scroll position.
    const stickyEndThreshold =
      parentBottom - qrPreviewColumn.offsetHeight - stickyOffset;

    if (scrollY >= stickyEndThreshold) {
      qrPreviewColumn.classList.add('sticky');
    } else {
      qrPreviewColumn.classList.remove('sticky');
    }
  };

  window.addEventListener('scroll', handleScroll);
  window.addEventListener('resize', () => {
    // Recalculate original top position on resize, as layout might change
    qrCodeOriginalTop = qrPreviewColumn.offsetTop;
    handleScroll(); // Re-evaluate sticky state on resize
  });

  // Initial call to set sticky state if page loads scrolled
  handleScroll();
});
