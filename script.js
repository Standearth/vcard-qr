document.addEventListener("DOMContentLoaded", () => {
  // --- 1. Get DOM Elements and URL parameters ---
  const urlParams = new URLSearchParams(window.location.search);
  const getParam = (p) => urlParams.get(p);

  const formFields = {
    firstName: document.getElementById("first_name"),
    lastName: document.getElementById("last_name"),
    org: document.getElementById("org"),
    title: document.getElementById("title"),
    email: document.getElementById("email"),
    workPhone: document.getElementById("work_phone"),
    cellPhone: document.getElementById("cell_phone"),
    website: document.getElementById("website"),
    anniversaryLogo: document.getElementById("anniversary_logo"),
  };

  const vcardTextOutput = document.getElementById("qrcode-text-output");

  // --- Advanced Control Elements ---
  const formWidth = document.getElementById("form-width");
  const formHeight = document.getElementById("form-height");
  const formMargin = document.getElementById("form-margin");

  const formDotsType = document.getElementById("form-dots-type");
  const formDotsColor = document.getElementById("form-dots-color");
  const formRoundSize = document.getElementById("form-round-size");

  const formCornersSquareType = document.getElementById(
    "form-corners-square-type"
  );
  const formCornersSquareColor = document.getElementById(
    "form-corners-square-color"
  );

  const formCornersDotType = document.getElementById("form-corners-dot-type");
  const formCornersDotColor = document.getElementById("form-corners-dot-color");

  const formBackgroundColor = document.getElementById("form-background-color");

  const formImageFile = document.getElementById("form-image-file");
  const formHideBackgroundDots = document.getElementById(
    "form-hide-background-dots"
  );
  const formSaveAsBlob = document.getElementById("form-save-as-blob");
  const formImageSize = document.getElementById("form-image-size");
  const formImageMargin = document.getElementById("form-image-margin");

  const formQrTypeNumber = document.getElementById("form-qr-type-number");
  const formQrErrorCorrectionLevel = document.getElementById(
    "form-qr-error-correction-level"
  );

  // --- Default Advanced Options ---
  const defaultAdvancedOptions = {
    width: 500,
    height: 500,
    margin: 5,
    dotsType: "rounded",
    dotsColor: "#000000",
    roundSize: true,
    cornersSquareType: "",
    cornersSquareColor: "#000000",
    cornersDotType: "",
    cornersDotColor: "#e50b12",
    backgroundColor: "#ffffff",
    hideBackgroundDots: true,
    saveAsBlob: true,
    imageSize: 0.4,
    imageMargin: 5,
    qrTypeNumber: 0,
    qrErrorCorrectionLevel: "Q",
  };

  // --- 2. Define QR Code Styling from your JSON template ---
  const qrConfig = {
    width: parseInt(formWidth.value),
    height: parseInt(formHeight.value),
    margin: parseInt(formMargin.value),
    qrOptions: {
      typeNumber: parseInt(formQrTypeNumber.value),
      mode: "Byte",
      errorCorrectionLevel: formQrErrorCorrectionLevel.value,
    },
    image: "./Stand_Logo_Block-RGB_Red.svg", // Default image
    imageOptions: {
      hideBackgroundDots: formHideBackgroundDots.checked,
      imageSize: parseFloat(formImageSize.value),
      margin: parseInt(formImageMargin.value),
      saveAsBlob: formSaveAsBlob.checked,
    },
    dotsOptions: {
      type: formDotsType.value,
      color: formDotsColor.value,
      roundSize: formRoundSize.checked,
    },
    backgroundOptions: {
      color: formBackgroundColor.value,
    },
    cornersSquareOptions: {
      type: formCornersSquareType.value,
      color: formCornersSquareColor.value,
    },
    cornersDotOptions: {
      type: formCornersDotType.value,
      color: formCornersDotColor.value,
    },
  };

  // --- 3. Initialize QR Code instance ---
  const qrCode = new QRCodeStyling(qrConfig);
  qrCode.append(document.getElementById("canvas"));

  // Helper to read file as Data URL
  const readFileAsDataURL = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        resolve(event.target.result);
      };
      reader.readAsDataURL(file);
    });
  };

  // --- 4. Core Update Functions ---
  const updateQRCode = async () => {
    const vcardLines = [
      `BEGIN:VCARD`,
      `VERSION:3.0`,
      `N:${formFields.lastName.value || ""};${
        formFields.firstName.value || ""
      }`,
      `FN:${
        (formFields.firstName.value || "") +
        " " +
        (formFields.lastName.value || "")
      }`.trim(),
      formFields.org.value ? `ORG:${formFields.org.value}` : "",
      formFields.title.value ? `TITLE:${formFields.title.value}` : "",
      formFields.email.value ? `EMAIL:${formFields.email.value}` : "",
      formFields.workPhone.value
        ? `TEL;TYPE=WORK:${formFields.workPhone.value}`
        : "",
      formFields.cellPhone.value
        ? `TEL;TYPE=CELL:${formFields.cellPhone.value}`
        : "",
      formFields.website.value ? `URL:${formFields.website.value}` : "",
      `END:VCARD`,
    ];

    // Filter out empty lines that are not BEGIN/VERSION/END
    const vcard = vcardLines
      .filter((line) => {
        const trimmedLine = line.trim();
        return (
          trimmedLine.length > 0 ||
          trimmedLine.startsWith("BEGIN:") ||
          trimmedLine.startsWith("VERSION:") ||
          trimmedLine.startsWith("END:")
        );
      })
      .join("\n");

    const newQrConfig = {
      data: vcard,
      width: parseInt(formWidth.value),
      height: parseInt(formHeight.value),
      margin: parseInt(formMargin.value),
      qrOptions: {
        typeNumber: parseInt(formQrTypeNumber.value),
        mode: "Byte",
        errorCorrectionLevel: formQrErrorCorrectionLevel.value,
      },
      imageOptions: {
        hideBackgroundDots: formHideBackgroundDots.checked,
        imageSize: parseFloat(formImageSize.value),
        margin: parseInt(formImageMargin.value),
        saveAsBlob: formSaveAsBlob.checked,
      },
      dotsOptions: {
        type: formDotsType.value,
        roundSize: formRoundSize.checked,
      },
      backgroundOptions: {
        color: formBackgroundColor.value,
      },
      cornersSquareOptions: {
        type: formCornersSquareType.value,
        color: formCornersSquareColor.value,
      },
      cornersDotOptions: {
        type: formCornersDotType.value,
        color: formCornersDotColor.value,
      },
    };

    // Handle image upload
    if (formImageFile.files.length > 0) {
      newQrConfig.image = await readFileAsDataURL(formImageFile.files[0]);
    } else {
      newQrConfig.image = formFields.anniversaryLogo.checked
        ? "./Stand.earth_25th-red_logo-teal_accent-RGB.svg"
        : "./Stand_Logo_Block-RGB_Red.svg";
    }

    qrCode.update(newQrConfig);
    vcardTextOutput.textContent = vcard; // Update the vCard text display
    console.log("Generated vCard:\n", vcard);
    updateUrlParameters();
  };

  const updateUrlParameters = () => {
    const newUrlParams = new URLSearchParams(window.location.search);

    // Basic form fields
    for (const key in formFields) {
      const paramKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      let value = formFields[key].value;

      if (formFields[key].type === "checkbox") {
        value = formFields[key].checked ? "true" : "false";
      }

      if (value) {
        newUrlParams.set(paramKey, value);
      } else {
        newUrlParams.delete(paramKey);
      }
    }

    // Advanced form fields
    const advancedControlInputs = {
      width: formWidth,
      height: formHeight,
      margin: formMargin,
      dots_type: formDotsType,
      dots_color: formDotsColor,
      round_size: formRoundSize,
      corners_square_type: formCornersSquareType,
      corners_square_color: formCornersSquareColor,
      corners_dot_type: formCornersDotType,
      corners_dot_color: formCornersDotColor,
      background_color: formBackgroundColor,
      hide_background_dots: formHideBackgroundDots,
      save_as_blob: formSaveAsBlob,
      image_size: formImageSize,
      image_margin: formImageMargin,
      qr_type_number: formQrTypeNumber,
      qr_error_correction_level: formQrErrorCorrectionLevel,
    };

    for (const key in advancedControlInputs) {
      const input = advancedControlInputs[key];
      let value = input.type === "checkbox" ? input.checked : input.value;
      const camelCaseKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      const defaultValue = defaultAdvancedOptions[camelCaseKey];

      // For checkboxes, convert boolean to string
      if (input.type === "checkbox") {
        value = value.toString();
      }

      if (value !== defaultValue.toString()) {
        newUrlParams.set(key, value);
      } else {
        newUrlParams.delete(key);
      }
    }

    const newUrl = `${window.location.pathname}?${newUrlParams.toString()}`;
    history.replaceState(null, "", newUrl);
  };

  // --- 5. Populate form from URL and add listeners ---
  const defaultValues = {
    org: "Stand.earth",
    website: "https://stand.earth",
    workPhone: "",
    anniversaryLogo: true, // Default for checkbox
  };

  // Function to apply default advanced options
  const applyDefaultAdvancedOptions = () => {
    formWidth.value = defaultAdvancedOptions.width;
    formHeight.value = defaultAdvancedOptions.height;
    formMargin.value = defaultAdvancedOptions.margin;
    formDotsType.value = defaultAdvancedOptions.dotsType;
    formDotsColor.value = defaultAdvancedOptions.dotsColor;
    formRoundSize.checked = defaultAdvancedOptions.roundSize;
    formCornersSquareType.value = defaultAdvancedOptions.cornersSquareType;
    formCornersSquareColor.value = defaultAdvancedOptions.cornersSquareColor;
    formCornersDotType.value = defaultAdvancedOptions.cornersDotType;
    formCornersDotColor.value = defaultAdvancedOptions.cornersDotColor;
    formBackgroundColor.value = defaultAdvancedOptions.backgroundColor;
    formHideBackgroundDots.checked = defaultAdvancedOptions.hideBackgroundDots;
    formSaveAsBlob.checked = defaultAdvancedOptions.saveAsBlob;
    formImageSize.value = defaultAdvancedOptions.imageSize;
    formImageMargin.value = defaultAdvancedOptions.imageMargin;
    formQrTypeNumber.value = defaultAdvancedOptions.qrTypeNumber;
    formQrErrorCorrectionLevel.value = defaultAdvancedOptions.qrErrorCorrectionLevel;
    // Manually dispatch events to trigger QR code update
    formWidth.dispatchEvent(new Event('input'));
    formHeight.dispatchEvent(new Event('input'));
    formMargin.dispatchEvent(new Event('input'));
    formDotsType.dispatchEvent(new Event('change'));
    formDotsColor.dispatchEvent(new Event('input'));
    formRoundSize.dispatchEvent(new Event('change'));
    formCornersSquareType.dispatchEvent(new Event('change'));
    formCornersSquareColor.dispatchEvent(new Event('input'));
    formCornersDotType.dispatchEvent(new Event('change'));
    formCornersDotColor.dispatchEvent(new Event('input'));
    formBackgroundColor.dispatchEvent(new Event('input'));
    formHideBackgroundDots.dispatchEvent(new Event('change'));
    formSaveAsBlob.dispatchEvent(new Event('change'));
    formImageSize.dispatchEvent(new Event('input'));
    formImageMargin.dispatchEvent(new Event('input'));
    formQrTypeNumber.dispatchEvent(new Event('input'));
    formQrErrorCorrectionLevel.dispatchEvent(new Event('change'));
    updateQRCode();
  };

  for (const key in formFields) {
    const paramKey = key.replace(/([A-Z])/g, "_$1").toLowerCase(); // camelCase to snake_case
    const paramValue = getParam(paramKey);

    if (formFields[key]) {
      // Check if the element exists before trying to set its value or add listener
      if (formFields[key].type === "checkbox") {
        formFields[key].checked =
          paramValue === "true" || (paramValue === null && defaultValues[key]);
      } else if (paramValue) {
        formFields[key].value = paramValue;
      } else if (defaultValues[key]) {
        formFields[key].value = defaultValues[key];
      }
      // Add event listener to update QR code and URL on any input change
      formFields[key].addEventListener("input", updateQRCode);
    }
  }

  // --- 6. Initial Generation ---
  applyDefaultAdvancedOptions(); // Apply default advanced options on initial load
  updateQRCode();

  // --- 7. Advanced Controls Toggle ---
  const toggleAdvancedControlsButton = document.getElementById(
    "toggle-advanced-controls"
  );
  const advancedControlsContainer =
    document.getElementById("advanced-controls");
  const resetStylesButton = document.getElementById("reset-styles-button");

  toggleAdvancedControlsButton.addEventListener("click", () => {
    console.log("Toggle button clicked!");
    advancedControlsContainer.classList.toggle("hidden");
    if (advancedControlsContainer.classList.contains("hidden")) {
      toggleAdvancedControlsButton.textContent = "Show Advanced Controls";
    } else {
      toggleAdvancedControlsButton.textContent = "Hide Advanced Controls";
    }
  });

  resetStylesButton.addEventListener("click", () => {
    applyDefaultAdvancedOptions();
    const newUrlParams = new URLSearchParams(window.location.search);
    for (const key in defaultAdvancedOptions) {
      const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      newUrlParams.delete(snakeKey);
    }
    const newUrl = `${window.location.pathname}?${newUrlParams.toString()}`;
    history.replaceState(null, "", newUrl);
  });

  // --- 8. Advanced Controls Event Listeners ---
  const advancedControlInputs = [
    formWidth,
    formHeight,
    formMargin,
    formDotsType,
    formDotsColor,
    formRoundSize,
    formCornersSquareType,
    formCornersSquareColor,
    formCornersDotType,
    formCornersDotColor,
    formBackgroundColor,
    formImageFile,
    formHideBackgroundDots,
    formSaveAsBlob,
    formImageSize,
    formImageMargin,
    formQrTypeNumber,
    formQrErrorCorrectionLevel,
  ];

  advancedControlInputs.forEach((input) => {
    if (input) {
      input.addEventListener("input", updateQRCode);
      input.addEventListener("change", updateQRCode); // For select, checkbox, file inputs
    }
  });

  // Specific validation for form-qr-type-number
  formQrTypeNumber.addEventListener("input", () => {
    let value = parseInt(formQrTypeNumber.value);
    if (isNaN(value)) {
      value = 0; // Default to 0 if input is not a number
    }
    formQrTypeNumber.value = Math.max(0, Math.min(40, value));
  });

  // --- 9. Setup Download Buttons ---
  document.getElementById("download-svg").addEventListener("click", () => {
    console.log("Attempting to download SVG...");
    setTimeout(() => {
      qrCode.download({ name: "vcard", extension: "svg" });
    }, 100);
  });

  document.getElementById("download-png").addEventListener("click", () => {
    console.log("Attempting to download PNG...");
    setTimeout(() => {
      qrCode.download({ name: "vcard", extension: "png" });
    }, 100);
  });

  document.getElementById("download-jpg").addEventListener("click", () => {
    console.log("Attempting to download JPG...");
    setTimeout(() => {
      qrCode.download({ name: "vcard", extension: "jpeg" });
    }, 100);
  });

  document.getElementById("download-vcard").addEventListener("click", () => {
    console.log("Attempting to download vCard...");
    const vcardContent = vcardTextOutput.textContent;
    const blob = new Blob([vcardContent], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vcard.vcf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});