export interface FormState {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  personId?: number;
  companyId?: number;
}

export const initialFormState: FormState = {
  success: false,
  message: "",
};

export interface ImportSummary {
  imported: number;
  skipped: number;
  companiesCreated: number;
  errors: string[];
}

export interface HrContactImportSummary {
  added: number;
  skipped: number;
  addedEmails: string[];
  skippedEmails: string[];
  companyId: number | null;
}

export interface CsvImportRow {
  fullName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  companyName: string;
  linkedinUrl?: string;
  location?: string;
  purpose?: string;
  notes?: string;
}
