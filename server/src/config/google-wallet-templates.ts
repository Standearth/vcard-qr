// src/config/google-wallet-templates.ts

export const googleWalletPassClass = {
  id: `${process.env.GOOGLE_ISSUER_ID}.vCard`,
  classTemplateInfo: {
    cardTemplateOverride: {
      cardRowTemplateInfos: [
        {
          twoItems: {
            startItem: {
              field: 'name',
            },
            endItem: {
              field: 'title',
            },
          },
        },
      ],
    },
  },
};
