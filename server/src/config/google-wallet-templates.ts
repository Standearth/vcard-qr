// src/config/google-wallet-templates.ts

export const googleWalletPassClass = {
  // We keep '.vCard' because this is the ID of the class you already created
  id: `${process.env.GOOGLE_ISSUER_ID}.vCard`,
  classTemplateInfo: {
    cardTemplateOverride: {
      cardRowTemplateInfos: [
        {
          twoItems: {
            startItem: {
              firstValue: {
                fields: [
                  {
                    fieldPath: "object.textModulesData['direct_line']",
                  },
                ],
              },
            },
            endItem: {
              firstValue: {
                fields: [
                  {
                    fieldPath: "object.textModulesData['office_phone']",
                  },
                ],
              },
            },
          },
        },
        {
          twoItems: {
            startItem: {
              firstValue: {
                fields: [
                  {
                    fieldPath: "object.textModulesData['email']",
                  },
                ],
              },
            },
            endItem: {
              firstValue: {
                fields: [
                  {
                    fieldPath: "object.textModulesData['cell_phone']",
                  },
                ],
              },
            },
          },
        },
      ],
    },
  },
};
