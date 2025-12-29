export const generateBusinessBarcode = (prefix: string): string => {
  const year = new Date().getFullYear().toString().slice(-2)
  const month = String(new Date().getMonth() + 1).padStart(2, "0")
  const day = String(new Date().getDate()).padStart(2, "0")
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${prefix}-${year}${month}${day}-${random}`
}

export const exportToCSV = (documents: any[], filename: string) => {
  const headers = ["الباركود", "النوع", "المرسل", "المستقبل", "التاريخ", "الموضوع", "الأولوية", "الحالة"]
  const rows = documents.map((doc) => [
    doc.barcode,
    doc.type === "INCOMING" ? "وارد" : "صادر",
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
