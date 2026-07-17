export function uniqueId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export const TEST_CONTACT = {
  first_name: "Test",
  last_name: "Contact",
  email: `test.contact_${Date.now()}@example.com`,
  phone: "+56912345678",
  position: "Engineer",
};

export const TEST_COMPANY = {
  name: `Test Corp ${Date.now()}`,
  industry: "Technology",
  website: "https://testcorp.example.com",
  city: "Santiago",
  country: "Chile",
};

export const TEST_DEAL = {
  title: `Test Deal ${Date.now()}`,
  value: 50000,
  currency: "USD",
  stage: "lead",
  notes: "Test deal notes",
};

export const TEST_LEAD = {
  first_name: "Test",
  last_name: "Lead",
  email: `test.lead_${Date.now()}@example.com`,
  phone: "+56987654321",
  company_name: "Lead Corp",
  lead_source: "website",
};
