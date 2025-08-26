// src/types/index.ts
export interface PassData {
  firstName: string;
  lastName: string;
  organization: string;
  title: string;
  email?: string;
  workPhone?: string;
  cellPhone?: string;
  officePhone?: string;
  extension?: string;
  website?: string;
  linkedin?: string;
  whatsapp?: string;
  notes?: string;
}

export interface Certs {
  wwdr: Buffer;
  signerCert: Buffer;
  signerKey: Buffer;
}
