export const generateBusinessBarcode = (prefix: string): string => {
  const year = new Date().getFullYear().toString().slice(-2)
  const month = String(new Date().getMonth() + 1).padStart(2, "0")
  const day = String(new Date().getDate()).padStart(2, "0")
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${prefix}-${year}${month}${day}-${random}`
}

export const exportToCSV = (t: (key: string) => string, documents: any[], filename: string) => {
  const headers = [t('new.key.kjtued'), t('new.key.86qtwg'), t('new.key.f9qhpu'), t('new.key.tuk67u'), t('new.key.euz7yf'), t('new.key.evow01'), t('new.key.3yn3iw'), t('new.key.hgd4pf')]
  const rows = documents.map((doc) => [
    doc.barcode,
    doc.type === "INCOMING" ? t('new.key.3mij8b') : t('new.key.5fsw78'),
    doc.sender,
    doc.receiver || doc.recipient,
    doc.date,
    doc.subject || doc.title,
    doc.priority,
    doc.status,
  ])

  const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n")
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`
  link.click()
}
