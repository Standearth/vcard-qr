// src/config/google-wallet-templates.ts

interface GoogleWalletTemplate {
  id: string;
  class: any;
  logo: any;
  hexBackgroundColor: string;
  heroImage?: any;
}

const templates: {
  default: GoogleWalletTemplate;
  [key: string]: GoogleWalletTemplate;
} = {
  default: {
    id: `${process.env.GOOGLE_ISSUER_ID}.vCard`,
    logo: {
      sourceUri: {
        uri: 'https://qr.stand.earth/Stand-Logo-google-wallet-logo.png',
      },
      contentDescription: {
        defaultValue: {
          language: 'en-US',
          value: 'Stand.earth Logo',
        },
      },
    },
    hexBackgroundColor: '#f5f1ea',
    heroImage: {
      sourceUri: {
        uri: 'https://qr.stand.earth/Stand-Logo-google-wallet-hero.png',
      },
    },
    class: {
      id: `${process.env.GOOGLE_ISSUER_ID}.vCard`,
      classTemplateInfo: {
        cardTemplateOverride: {
          cardRowTemplateInfos: [
            {
              twoItems: {
                startItem: {
                  firstValue: {
                    fields: [
                      { fieldPath: "object.textModulesData['direct_line']" },
                    ],
                  },
                },
                endItem: {
                  firstValue: {
                    fields: [
                      { fieldPath: "object.textModulesData['office_phone']" },
                    ],
                  },
                },
              },
            },
            {
              twoItems: {
                startItem: {
                  firstValue: {
                    fields: [{ fieldPath: "object.textModulesData['email']" }],
                  },
                },
                endItem: {
                  firstValue: {
                    fields: [
                      { fieldPath: "object.textModulesData['cell_phone']" },
                    ],
                  },
                },
              },
            },
            {
              oneItem: {
                item: {
                  firstValue: {
                    fields: [{ fieldPath: "object.textModulesData['notes']" }],
                  },
                },
              },
            },
          ],
        },
      },
    },
  },
  'fossilfueltreaty.org': {
    id: `${process.env.GOOGLE_ISSUER_ID}.FFT-vCard`,
    logo: {
      sourceUri: {
        uri: 'https://qr.stand.earth/FFT-google-wallet-logo.png',
      },
      contentDescription: {
        defaultValue: {
          language: 'en-US',
          value: 'Fossil Fuel Treaty Logo',
        },
      },
    },
    hexBackgroundColor: '#002346', // Dark blue
    class: {
      id: `${process.env.GOOGLE_ISSUER_ID}.FFT-vCard`,
      // The class template can be the same as default or customized
      classTemplateInfo: {
        cardTemplateOverride: {
          cardRowTemplateInfos: [
            {
              twoItems: {
                startItem: {
                  firstValue: {
                    fields: [
                      { fieldPath: "object.textModulesData['direct_line']" },
                    ],
                  },
                },
                endItem: {
                  firstValue: {
                    fields: [
                      { fieldPath: "object.textModulesData['office_phone']" },
                    ],
                  },
                },
              },
            },
            {
              twoItems: {
                startItem: {
                  firstValue: {
                    fields: [{ fieldPath: "object.textModulesData['email']" }],
                  },
                },
                endItem: {
                  firstValue: {
                    fields: [
                      { fieldPath: "object.textModulesData['cell_phone']" },
                    ],
                  },
                },
              },
            },
            {
              oneItem: {
                item: {
                  firstValue: {
                    fields: [{ fieldPath: "object.textModulesData['notes']" }],
                  },
                },
              },
            },
          ],
        },
      },
    },
  },
  'stand.earth': {
    id: `${process.env.GOOGLE_ISSUER_ID}.vCard`,
    logo: {
      sourceUri: {
        uri: 'https://qr.stand.earth/Stand-Logo-google-wallet-logo.png',
      },
      contentDescription: {
        defaultValue: {
          language: 'en-US',
          value: 'Stand.earth Logo',
        },
      },
    },
    hexBackgroundColor: '#f5f1ea',
    // heroImage: {
    //   sourceUri: {
    //     uri: 'https://qr.stand.earth/Stand-Logo-google-wallet-hero.png',
    //   },
    // },
    class: {
      id: `${process.env.GOOGLE_ISSUER_ID}.vCard`,
      classTemplateInfo: {
        cardTemplateOverride: {
          cardRowTemplateInfos: [
            {
              twoItems: {
                startItem: {
                  firstValue: {
                    fields: [
                      { fieldPath: "object.textModulesData['direct_line']" },
                    ],
                  },
                },
                endItem: {
                  firstValue: {
                    fields: [
                      { fieldPath: "object.textModulesData['office_phone']" },
                    ],
                  },
                },
              },
            },
            {
              twoItems: {
                startItem: {
                  firstValue: {
                    fields: [{ fieldPath: "object.textModulesData['email']" }],
                  },
                },
                endItem: {
                  firstValue: {
                    fields: [
                      { fieldPath: "object.textModulesData['cell_phone']" },
                    ],
                  },
                },
              },
            },
            {
              oneItem: {
                item: {
                  firstValue: {
                    fields: [{ fieldPath: "object.textModulesData['notes']" }],
                  },
                },
              },
            },
          ],
        },
      },
    },
  },
};

export function getTemplateForEmail(
  email: string | undefined
): GoogleWalletTemplate {
  if (email) {
    const domain = email.split('@')[1];
    if (domain && templates[domain]) {
      return templates[domain];
    }
  }
  return templates.default;
}
