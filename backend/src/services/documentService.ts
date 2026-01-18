// Document Service to handle document related logic
import { query } from "../config/database"
import type { User } from '../types'

export class DocumentService {
  async count(filters: any) {
     let baseWhere = ` WHERE 1=1`
     const queryParams: any[] = []
     let paramCount = 1

     if (filters.status) {
       baseWhere += ` AND status = $${paramCount}`
       queryParams.push(filters.status)
       paramCount++
     }

     if (filters.type) {
       baseWhere += ` AND type = $${paramCount}`
       queryParams.push(filters.type)
       paramCount++
     }

     if (filters.search) {
      baseWhere += ` AND (d.barcode ILIKE $${paramCount} OR d.subject ILIKE $${paramCount} OR d.sender ILIKE $${paramCount} OR d.receiver ILIKE $${paramCount})`
      queryParams.push(`%${filters.search}%`)
      paramCount++
    }
    
    // Scoping logic
    if (filters.user) {
        const user = filters.user
        if (user.role !== 'admin' && user.role !== 'manager' && user.role !== 'supervisor') {
           baseWhere += ` AND d.user_id = $${paramCount}`
           queryParams.push(user.id)
           paramCount++
        }
    }
    
    // Logic note: we join users to support potential future filters, though count in simple cases doesn't strictly need it.
    const countQuery = `SELECT COUNT(*) as total FROM documents d LEFT JOIN users u ON d.user_id = u.id ${baseWhere}`
    const result = await query(countQuery, queryParams)
    return parseInt(result.rows[0]?.total || '0', 10)
  }

  async create(data: any, user: any) {
    let {
      barcode,
      type,
      sender,
      receiver,
      recipient,
      date,
      documentDate,
      title,
      subject,
      priority,
      status,
      classification,
      notes,
      attachments = [],
      attachmentCount,
    } = data

    // Logic: aliases
    const finalReceiver = receiver || recipient || ''
    const finalSubject = subject || title || ''
    
    let finalDate: string
    if (date) {
      finalDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? `${date}T${new Date().toISOString().split('T')[1]}`
        : date
    } else if (documentDate) {
      finalDate = typeof documentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(documentDate)
        ? `${documentDate}T${new Date().toISOString().split('T')[1]}`
        : documentDate
    } else {
      finalDate = new Date().toISOString()
    }

    let direction: 'INCOMING' | 'OUTGOING' | null = null
    if (typeof type === 'string') {
      const t = String(type).toUpperCase().trim()
      if (t === 'INCOMING' || t.startsWith('IN')) direction = 'INCOMING'
      else if (t === 'OUTGOING' || t.startsWith('OUT')) direction = 'OUTGOING'
    }
    if (!direction && barcode && typeof barcode === 'string') {
      if (barcode.toUpperCase().startsWith('IN')) direction = 'INCOMING'
      else if (barcode.toUpperCase().startsWith('OUT')) direction = 'OUTGOING'
    }

    const finalStatus = status || (direction === 'INCOMING' ? 'وارد' : (direction === 'OUTGOING' ? 'صادر' : 'محفوظ'))

    // Generate barcode if missing
    if (!barcode) {
      if (!direction) throw new Error('Direction (type) is required to generate barcode')
      
      const prefix = direction === 'INCOMING' ? '1' : '2'
      let n: number
      
      // SECURITY: Use explicit queries instead of string interpolation to prevent SQL injection
      try {
        const seqRes = direction === 'INCOMING'
          ? await query("SELECT nextval('doc_in_seq') as n")
          : await query("SELECT nextval('doc_out_seq') as n")
        n = seqRes.rows[0].n
      } catch (seqErr: any) {
         // Create sequence if missing - using explicit safe queries
         if (direction === 'INCOMING') {
           await query("CREATE SEQUENCE IF NOT EXISTS doc_in_seq START 1")
           const seqRes2 = await query("SELECT nextval('doc_in_seq') as n")
           n = seqRes2.rows[0].n
         } else {
           await query("CREATE SEQUENCE IF NOT EXISTS doc_out_seq START 1")
           const seqRes2 = await query("SELECT nextval('doc_out_seq') as n")
           n = seqRes2.rows[0].n
         }
      }
      const padded = String(n).padStart(8, '0')
      barcode = `${prefix}-${padded}`
    }

    // For hidden owner (-999), set creator as NULL to avoid FK constraint failure
    // as the hidden owner does not exist in the users table
    const creatorId = (user.id === -999) ? null : user.id

    // Check existing
    const existing = await query("SELECT id FROM documents WHERE barcode = $1", [barcode])
    if (existing.rows.length > 0) {
      throw new Error("Barcode already exists")
    }

    const dbType = (typeof type === 'string' && type) ? type : (direction || 'UNKNOWN')
    const result = await query(
      `INSERT INTO documents (barcode, type, sender, receiver, date, subject, priority, status, classification, notes, attachments, user_id, attachment_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        barcode,
        dbType,
        sender,
        finalReceiver,
        finalDate,
        finalSubject,
        priority || 'عادي',
        finalStatus,
        classification,
        notes,
        JSON.stringify(attachments || []),
        creatorId,
        attachmentCount || '0',
      ],
    )

    // Ensure barcodes table entry
    try {
      const bc = await query("SELECT id FROM barcodes WHERE barcode = $1 LIMIT 1", [barcode])
      if (bc.rows.length === 0) {
        await query(
          `INSERT INTO barcodes (barcode, type, status, priority, subject, attachments, user_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [barcode, dbType, finalStatus || null, priority || null, finalSubject || null, JSON.stringify(attachments || []), user.id],
        )
      }
    } catch (e) {
      console.warn('Failed to ensure barcode entry in service:', e)
    }

    return result.rows[0]
  }

  async update(barcode: string, data: any, user: any) {
    const existing = await query("SELECT * FROM documents WHERE lower(barcode) = lower($1) LIMIT 1", [barcode])
    if (existing.rows.length === 0) throw new Error('Document not found') // 404 handled by caller usually, but specific error helpful
    const doc = existing.rows[0]

    const { canAccessDocument } = await import('../lib/rbac')
    if (!canAccessDocument(user, doc)) {
      throw new Error('Forbidden')
    }

    const { type, sender, receiver, date, subject, priority, status, classification, notes, attachments, attachmentCount } = data

    const newType = type !== undefined ? type : doc.type
    const newSender = sender !== undefined ? sender : doc.sender
    const newReceiver = receiver !== undefined ? receiver : doc.receiver
    const newDate = date !== undefined ? date : doc.date
    const newSubject = subject !== undefined ? subject : doc.subject
    const newPriority = priority !== undefined ? priority : doc.priority
    const newStatus = status !== undefined ? status : doc.status
    const newClassification = classification !== undefined ? classification : doc.classification
    const newNotes = notes !== undefined ? notes : doc.notes
    const newAttachmentCount = attachmentCount !== undefined ? attachmentCount : doc.attachment_count

    let currentAttachments = doc.attachments
    try {
        if (typeof currentAttachments === 'string') currentAttachments = JSON.parse(currentAttachments)
    } catch(e) { currentAttachments = [] }
    if (!Array.isArray(currentAttachments)) currentAttachments = []
    
    const newAttachments = attachments !== undefined ? attachments : currentAttachments

    const result = await query(
      `UPDATE documents 
       SET type = $1, sender = $2, receiver = $3, date = $4, subject = $5, 
           priority = $6, status = $7, classification = $8, notes = $9, attachments = $10, attachment_count = $11
       WHERE barcode = $12
       RETURNING *`,
      [
        newType,
        newSender,
        newReceiver,
        newDate,
        newSubject,
        newPriority,
        newStatus,
        newClassification,
        newNotes,
        JSON.stringify(newAttachments),
        newAttachmentCount,
        barcode,
      ],
    )
    return result.rows[0]
  }
}
