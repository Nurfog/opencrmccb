import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { Contact, Company, Deal, Activity } from "./api"

type PdfLocale = "es" | "en";

function pdfLocale(): PdfLocale {
  if (typeof window !== "undefined") {
    try {
      if (localStorage.getItem("opencrm-locale") === "es") return "es";
    } catch {
      // ignore
    }
  }
  return "en";
}

const STRINGS: Record<PdfLocale, Record<string, string>> = {
  en: {
    contactsReport: "Contacts Report",
    companiesReport: "Companies Report",
    dealsReport: "Deals Report",
    generated: "Generated",
    total: "Total",
    contacts: "contacts",
    companies: "companies",
    deals: "deals",
    totalValue: "Total Value",
    created: "Created",
    contactInfo: "Contact Information",
    activities: "Activities",
    name: "Name",
    email: "Email",
    phone: "Phone",
    position: "Position",
    industry: "Industry",
    website: "Website",
    city: "City",
    country: "Country",
    title: "Title",
    value: "Value",
    stage: "Stage",
    expectedClose: "Expected Close",
    subject: "Subject",
    type: "Type",
    date: "Date",
    notes: "Notes",
  },
  es: {
    contactsReport: "Reporte de Contactos",
    companiesReport: "Reporte de Empresas",
    dealsReport: "Reporte de Negocios",
    generated: "Generado",
    total: "Total",
    contacts: "contactos",
    companies: "empresas",
    deals: "negocios",
    totalValue: "Valor Total",
    created: "Creado",
    contactInfo: "Información de Contacto",
    activities: "Actividades",
    name: "Nombre",
    email: "Correo",
    phone: "Teléfono",
    position: "Cargo",
    industry: "Industria",
    website: "Sitio web",
    city: "Ciudad",
    country: "País",
    title: "Título",
    value: "Valor",
    stage: "Etapa",
    expectedClose: "Cierre esperado",
    subject: "Asunto",
    type: "Tipo",
    date: "Fecha",
    notes: "Notas",
  },
};

/** Sanitize a filename: no path separators, control chars or odd symbols. */
function safeFilename(name: string): string {
  return name.replace(/[^\w\-. ]+/g, "_").trim().slice(0, 80) || "export";
}

export function exportContactsToPdf(contacts: Contact[]) {
  const doc = new jsPDF()

  doc.setFontSize(18)
  const L = STRINGS[pdfLocale()];
  doc.text(L.contactsReport, 14, 22)
  doc.setFontSize(10)
  doc.text(`${L.generated}: ${new Date().toLocaleDateString()}`, 14, 30)
  doc.text(`${L.total}: ${contacts.length} ${L.contacts}`, 14, 36)

  autoTable(doc, {
    startY: 42,
    head: [[L.name, L.email, L.phone, L.position]],
    body: contacts.map((c) => [
      `${c.first_name} ${c.last_name}`,
      c.email || "-",
      c.phone || "-",
      c.position || "-",
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
  })

  doc.save("contacts.pdf")
}

export function exportCompaniesToPdf(companies: Company[]) {
  const doc = new jsPDF()

  doc.setFontSize(18)
  const L = STRINGS[pdfLocale()];
  doc.text(L.companiesReport, 14, 22)
  doc.setFontSize(10)
  doc.text(`${L.generated}: ${new Date().toLocaleDateString()}`, 14, 30)
  doc.text(`${L.total}: ${companies.length} ${L.companies}`, 14, 36)

  autoTable(doc, {
    startY: 42,
    head: [[L.name, L.industry, L.website, L.city, L.country]],
    body: companies.map((c) => [
      c.name,
      c.industry || "-",
      c.website || "-",
      c.city || "-",
      c.country || "-",
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [139, 92, 246] },
  })

  doc.save("companies.pdf")
}

export function exportDealsToPdf(deals: Deal[]) {
  const doc = new jsPDF()

  doc.setFontSize(18)
  const L = STRINGS[pdfLocale()];
  doc.text(L.dealsReport, 14, 22)
  doc.setFontSize(10)
  doc.text(`${L.generated}: ${new Date().toLocaleDateString()}`, 14, 30)
  doc.text(`${L.total}: ${deals.length} ${L.deals}`, 14, 36)

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0)
  doc.text(`${L.totalValue}: $${totalValue.toLocaleString()}`, 14, 42)

  autoTable(doc, {
    startY: 48,
    head: [[L.title, L.value, L.stage, L.expectedClose]],
    body: deals.map((d) => [
      d.title,
      `$${d.value.toLocaleString()} ${d.currency}`,
      d.stage,
      d.expected_close_date || "-",
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [34, 197, 94] },
  })

  doc.save("deals.pdf")
}

export function exportContactDetailToPdf(contact: Contact, deals: Deal[], activities: Activity[]) {
  const doc = new jsPDF()
  const L = STRINGS[pdfLocale()];

  // Header
  doc.setFontSize(20)
  doc.text(`${contact.first_name} ${contact.last_name}`, 14, 22)
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(contact.position || "", 14, 30)
  doc.text(`${L.created}: ${new Date(contact.created_at).toLocaleDateString()}`, 14, 36)

  // Contact Info
  doc.setFontSize(14)
  doc.setTextColor(0)
  doc.text(L.contactInfo, 14, 50)

  let y = 58
  if (contact.email) {
    doc.setFontSize(10)
    doc.text(`${L.email}: ${contact.email}`, 14, y)
    y += 6
  }
  if (contact.phone) {
    doc.text(`${L.phone}: ${contact.phone}`, 14, y)
    y += 6
  }
  if (contact.notes) {
    doc.text(`${L.notes}: ${contact.notes}`, 14, y)
    y += 6
  }

  // Deals
  if (deals.length > 0) {
    y += 8
    doc.setFontSize(14)
    doc.text(L.deals, 14, y)
    y += 8

    autoTable(doc, {
      startY: y,
      head: [[L.title, L.value, L.stage]],
      body: deals.map((d) => [
        d.title,
        `$${d.value.toLocaleString()}`,
        d.stage,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [34, 197, 94] },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // Activities (previously accepted but silently ignored)
  if (activities.length > 0) {
    doc.setFontSize(14)
    doc.text(L.activities, 14, y)
    y += 8

    autoTable(doc, {
      startY: y,
      head: [[L.subject, L.type, L.date]],
      body: activities.map((a) => [
        a.subject,
        a.activity_type,
        new Date(a.created_at).toLocaleDateString(),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [99, 102, 241] },
    })
  }

  doc.save(`${safeFilename(`${contact.first_name}_${contact.last_name}`)}.pdf`)
}
