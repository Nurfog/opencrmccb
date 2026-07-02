import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { Contact, Company, Deal } from "./api"

export function exportContactsToPdf(contacts: Contact[]) {
  const doc = new jsPDF()

  doc.setFontSize(18)
  doc.text("Contacts Report", 14, 22)
  doc.setFontSize(10)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30)
  doc.text(`Total: ${contacts.length} contacts`, 14, 36)

  autoTable(doc, {
    startY: 42,
    head: [["Name", "Email", "Phone", "Position"]],
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
  doc.text("Companies Report", 14, 22)
  doc.setFontSize(10)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30)
  doc.text(`Total: ${companies.length} companies`, 14, 36)

  autoTable(doc, {
    startY: 42,
    head: [["Name", "Industry", "Website", "City", "Country"]],
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
  doc.text("Deals Report", 14, 22)
  doc.setFontSize(10)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30)
  doc.text(`Total: ${deals.length} deals`, 14, 36)

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0)
  doc.text(`Total Value: $${totalValue.toLocaleString()}`, 14, 42)

  autoTable(doc, {
    startY: 48,
    head: [["Title", "Value", "Stage", "Expected Close"]],
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

export function exportContactDetailToPdf(contact: Contact, deals: Deal[], activities: any[]) {
  const doc = new jsPDF()

  // Header
  doc.setFontSize(20)
  doc.text(`${contact.first_name} ${contact.last_name}`, 14, 22)
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(contact.position || "", 14, 30)
  doc.text(`Created: ${new Date(contact.created_at).toLocaleDateString()}`, 14, 36)

  // Contact Info
  doc.setFontSize(14)
  doc.setTextColor(0)
  doc.text("Contact Information", 14, 50)

  let y = 58
  if (contact.email) {
    doc.setFontSize(10)
    doc.text(`Email: ${contact.email}`, 14, y)
    y += 6
  }
  if (contact.phone) {
    doc.text(`Phone: ${contact.phone}`, 14, y)
    y += 6
  }
  if (contact.notes) {
    doc.text(`Notes: ${contact.notes}`, 14, y)
    y += 6
  }

  // Deals
  if (deals.length > 0) {
    y += 8
    doc.setFontSize(14)
    doc.text("Deals", 14, y)
    y += 8

    autoTable(doc, {
      startY: y,
      head: [["Title", "Value", "Stage"]],
      body: deals.map((d) => [
        d.title,
        `$${d.value.toLocaleString()}`,
        d.stage,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [34, 197, 94] },
    })
  }

  doc.save(`${contact.first_name}_${contact.last_name}.pdf`)
}
