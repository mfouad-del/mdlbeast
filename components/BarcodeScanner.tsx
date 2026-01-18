"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Scan, Search, FileText, X, AlertCircle, Edit3, Trash2, 
  Calendar, User, Building2, Tag, Clock, ChevronDown, ChevronUp,
  Paperclip, History, Eye, Copy, Loader2, CheckCircle2, XCircle
} from 'lucide-react'
import { apiClient } from '../lib/api-client'
import AsyncButton from './ui/async-button'
import { useI18n } from '../lib/i18n-context'

interface DocumentData {
  id?: number
  barcode: string
  type: 'INCOMING' | 'OUTGOING'
  status?: string
  priority?: string
  subject?: string
  title?: string
  sender?: string
  receiver?: string
  recipient?: string
  date?: string
  created_at?: string
  notes?: string
  description?: string
  classification?: string
  attachments?: any[]
  attachment_count?: number
  user_id?: number
  pdfFile?: any
}

interface TimelineEntry {
  id?: number
  created_at?: string
  date?: string
  ts?: string
  action?: string
  message?: string
  note?: string
  actor_name?: string
  meta?: any
}

const BarcodeScanner: React.FC = () => {
  const { t } = useI18n()
  
  // Core states
  const [isScanning, setIsScanning] = useState(false)
  const [manualId, setManualId] = useState('')
  const [foundDoc, setFoundDoc] = useState<DocumentData | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [isLoadingBarcode, setIsLoadingBarcode] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [currentUserPermissions, setCurrentUserPermissions] = useState<any>(null)
  
  // Edit mode
  const [editing, setEditing] = useState(false)
  const [editPending, setEditPending] = useState(false)
  const [editForm, setEditForm] = useState<Partial<DocumentData>>({})
  
  // UI states
  const [showAllDetails, setShowAllDetails] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'attachments'>('details')
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const detectorRef = useRef<any | null>(null)
  const rafRef = useRef<number | null>(null)

  // Initialize
  useEffect(() => {
    apiClient.getCurrentUser()
      .then(u => { 
        if (u) {
          setCurrentUserRole(String(u.role || '').toLowerCase())
          setCurrentUserPermissions(u.permissions || null)
        }
      })
      .catch(() => {})
    return () => { stopScanner() }
  }, [])

  // Show status message with auto-dismiss
  const showStatus = useCallback((key: string, type: 'success' | 'error' | 'info' = 'info') => {
    setStatusMessage({ text: t(key, key), type })
    setTimeout(() => setStatusMessage(null), 3000)
  }, [t])

  // Fetch document by barcode
  const fetchByBarcode = useCallback(async (rawBarcode: string) => {
    const barcode = String(rawBarcode || '').trim().toUpperCase()
    if (!barcode) {
      showStatus('scanner.empty_barcode', 'error')
      return
    }
    
    setIsLoadingBarcode(true)
    setStatusMessage(null)
    
    try {
      const res = await apiClient.getBarcode(barcode)
      if (res) {
        setFoundDoc(res)
        setEditForm(res)
        const tl = await apiClient.getBarcodeTimeline(barcode).catch(() => [])
        setTimeline(tl || [])
        showStatus('scanner.found', 'success')
        setActiveTab('details')
        return
      }
      
      // Fallback: search endpoint
      const search = await apiClient.searchBarcodes(barcode).catch(() => [])
      if (Array.isArray(search) && search.length === 1) {
        const b = search[0]
        setFoundDoc(b)
        setEditForm(b)
        const tl = await apiClient.getBarcodeTimeline(b.barcode).catch(() => [])
        setTimeline(tl || [])
        showStatus('scanner.found', 'success')
        return
      }
      
      setFoundDoc(null)
      setTimeline([])
      showStatus('scanner.not_found', 'error')
    } catch (err: any) {
      console.error('API error', err)
      if (err && String(err).toLowerCase().includes('not found')) {
        showStatus('scanner.not_found', 'error')
      } else {
        showStatus('scanner.fetch_error', 'error')
      }
    } finally {
      setIsLoadingBarcode(false)
    }
  }, [showStatus])

  // Camera scanner decode loop
  const decodeLoop = useCallback(async () => {
    if (!videoRef.current || !detectorRef.current) return
    try {
      const detections = await detectorRef.current.detect(videoRef.current)
      if (detections && detections.length) {
        const code = detections[0].rawValue || detections[0].rawData
        if (code) {
          stopScanner()
          fetchByBarcode(code)
          return
        }
      }
    } catch (err) {
      console.debug('Detection error', err)
    }
    rafRef.current = requestAnimationFrame(decodeLoop)
  }, [fetchByBarcode])

  const startScanner = async () => {
    setIsScanning(true)
    setFoundDoc(null)
    setTimeline([])
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      if ((window as any).BarcodeDetector) {
        detectorRef.current = new (window as any).BarcodeDetector({ 
          formats: ['qr_code', 'ean_13', 'code_128', 'code_39', 'code_93'] 
        })
        rafRef.current = requestAnimationFrame(decodeLoop)
      } else {
        showStatus('scanner.detection_unavailable', 'error')
      }
    } catch (err) {
      console.error("Error accessing camera:", err)
      showStatus('scanner.camera_error', 'error')
      setIsScanning(false)
    }
  }

  const stopScanner = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    detectorRef.current = null
    setIsScanning(false)
  }

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualId || manualId.trim().length < 2) return
    await fetchByBarcode(manualId.trim().toUpperCase())
  }

  // Copy barcode to clipboard
  const copyBarcode = async () => {
    if (foundDoc?.barcode) {
      await navigator.clipboard.writeText(foundDoc.barcode)
      showStatus('scanner.copied', 'success')
    }
  }

  // Format date helper
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  // Format datetime helper
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  // Priority badge component
  const getPriorityBadge = (priority?: string) => {
    if (!priority) return null
    const isUrgent = priority.includes(t('new.key.6c24cm'))
    return (
      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
        isUrgent 
          ? 'bg-red-100 text-red-700 border border-red-200' 
          : 'bg-slate-100 text-slate-600 border border-slate-200'
      }`}>
        {priority}
      </span>
    )
  }

  // Save edits handler
  const handleSaveEdits = async () => {
    if (!foundDoc) return
    try {
      setEditPending(true)
      await apiClient.updateDocument(foundDoc.barcode, {
        type: editForm.type,
        sender: editForm.sender,
        recipient: editForm.receiver || editForm.recipient,
        subject: editForm.subject || editForm.title,
        priority: editForm.priority,
        notes: editForm.notes || editForm.description,
        status: editForm.status || t('new.key.tdl4iu')
      })
      
      const updated = await apiClient.getBarcode(foundDoc.barcode)
      if (updated) {
        setFoundDoc(updated)
        setEditForm(updated)
      }
      
      showStatus('scanner.save_success', 'success')
      setEditing(false)
    } catch (e) {
      console.error('Failed to save edits', e)
      showStatus('scanner.save_error', 'error')
    } finally {
      setEditPending(false)
    }
  }

  // Add timeline entry handler
  const handleAddTimelineEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const input = form.elements.namedItem('note') as HTMLInputElement
    const val = input.value.trim()
    if (!val || !foundDoc) return
    
    try {
      showStatus('scanner.timeline_adding', 'info')
      await apiClient.addBarcodeTimeline(foundDoc.barcode, { action: val })
      setTimeline(prev => [{ 
        created_at: new Date().toISOString(), 
        message: val, 
        action: val 
      }, ...prev])
      input.value = ''
      showStatus('scanner.timeline_added', 'success')
    } catch (err) {
      console.error(err)
      showStatus('scanner.timeline_error', 'error')
    }
  }

  // Delete document handler
  const handleDelete = async () => {
    if (!foundDoc || !confirm(t('scanner.delete_confirm'))) return
    
    try {
      await apiClient.deleteDocument(foundDoc.barcode)
      setFoundDoc(null)
      setTimeline([])
      setManualId('')
      showStatus('scanner.delete_success', 'success')
    } catch (e) {
      showStatus('scanner.delete_error', 'error')
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-2xl shadow-lg mb-4">
          <Scan size={28} />
          <h2 className="text-2xl font-black">{t('scanner.title')}</h2>
        </div>
        <p className="text-slate-500 max-w-md mx-auto">
          {t('scanner.subtitle')}
        </p>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className={`flex items-center gap-3 p-4 rounded-xl animate-in slide-in-from-top duration-300 ${
          statusMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
          statusMessage.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
          'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {statusMessage.type === 'success' && <CheckCircle2 size={20} />}
          {statusMessage.type === 'error' && <XCircle size={20} />}
          {statusMessage.type === 'info' && <AlertCircle size={20} />}
          <span className="font-bold">{statusMessage.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Scanner Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Camera Scanner */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Scan size={18} className="text-blue-600" />
              {t('scanner.camera_scan')}
            </h3>
            
            <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden relative border-2 border-slate-700">
              {isScanning ? (
                <>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                    aria-label={t('new.key.wca6cc')}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-3/4 h-1/2 border-2 border-blue-400 border-dashed rounded-lg"></div>
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_10px_red] animate-scan"></div>
                  </div>
                  <button 
                    onClick={stopScanner}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition-all"
                    aria-label={t('scanner.stop_camera')}
                  >
                    <X size={16} /> {t('scanner.stop_camera')}
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-3 p-6">
                  <Scan size={48} className="opacity-30" />
                  <button 
                    onClick={startScanner}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg"
                    aria-label={t('scanner.start_camera')}
                  >
                    {t('scanner.start_camera')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Manual Search */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Search size={18} className="text-blue-600" />
              {t('scanner.manual_search')}
            </h3>
            
            <form onSubmit={handleManualSearch} className="space-y-3">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder={t('scanner.barcode_placeholder')}
                  className="w-full p-3.5 pr-12 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-mono text-sm uppercase transition-all"
                  value={manualId}
                  onChange={e => setManualId(e.target.value)}
                  aria-label={t('scanner.barcode_placeholder')}
                />
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              </div>
              
              <button 
                type="submit"
                disabled={isLoadingBarcode || !manualId.trim()}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                aria-label={t('scanner.search')}
              >
                {isLoadingBarcode ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {t('scanner.searching')}
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    {t('scanner.search')}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-3">
          {foundDoc ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-left duration-500">
              {/* Document Header */}
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-6 border-b border-slate-200">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                        foundDoc.type === 'INCOMING' 
                          ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                          : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                      }`}>
                        {foundDoc.type === 'INCOMING' ? `📥 ${t('scanner.incoming')}` : `📤 ${t('scanner.outgoing')}`}
                      </span>
                      {getPriorityBadge(foundDoc.priority)}
                      {foundDoc.classification && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                          {foundDoc.classification}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-black text-slate-900 leading-tight">
                      {foundDoc.title || foundDoc.subject || t('common.no') + ' ' + t('scanner.subject')}
                    </h3>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="font-mono text-xs font-bold bg-white px-3 py-2 rounded-lg border border-slate-200 flex items-center gap-2">
                      <span className="text-slate-600">{foundDoc.barcode}</span>
                      <button 
                        onClick={copyBarcode}
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                        title={t('scanner.copy_barcode')}
                        aria-label={t('scanner.copy_barcode')}
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200">
                {[
                  { id: 'details', label: t('scanner.tab_details'), icon: FileText },
                  { id: 'timeline', label: t('scanner.tab_timeline'), icon: History },
                  { id: 'attachments', label: t('scanner.tab_attachments'), icon: Paperclip, count: foundDoc.attachments?.length || 0 }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-3 px-4 font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                      activeTab === tab.id 
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                    aria-selected={activeTab === tab.id}
                  >
                    <tab.icon size={16} />
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {/* Details Tab */}
                {activeTab === 'details' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-2">
                          <Building2 size={14} />
                          {t('scanner.sender')}
                        </div>
                        <p className="font-bold text-slate-900">{foundDoc.sender || '—'}</p>
                      </div>
                      
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-2">
                          <User size={14} />
                          {t('scanner.recipient')}
                        </div>
                        <p className="font-bold text-slate-900">{foundDoc.recipient || foundDoc.receiver || '—'}</p>
                      </div>
                      
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-2">
                          <Calendar size={14} />
                          {t('scanner.registration_date')}
                        </div>
                        <p className="font-bold text-slate-900">{formatDate(foundDoc.date || foundDoc.created_at)}</p>
                      </div>
                      
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-2">
                          <Tag size={14} />
                          {t('scanner.status')}
                        </div>
                        <p className="font-bold text-slate-900">{foundDoc.status || '—'}</p>
                      </div>
                    </div>

                    {(foundDoc.description || foundDoc.notes) && (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-2">
                          <FileText size={14} />
                          {t('scanner.description')}
                        </div>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {foundDoc.description || foundDoc.notes}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => setShowAllDetails(!showAllDetails)}
                      className="w-full py-2 text-sm font-bold text-slate-500 hover:text-slate-700 flex items-center justify-center gap-2 transition-colors"
                    >
                      {showAllDetails ? (
                        <>
                          <ChevronUp size={16} />
                          {t('scanner.hide_details')}
                        </>
                      ) : (
                        <>
                          <ChevronDown size={16} />
                          {t('scanner.show_more')}
                        </>
                      )}
                    </button>

                    {showAllDetails && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 animate-in slide-in-from-top duration-300">
                        {foundDoc.id && (
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase block">ID</span>
                            <span className="text-sm font-bold text-slate-700">{foundDoc.id}</span>
                          </div>
                        )}
                        {foundDoc.created_at && (
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase block">{t('scanner.creation_date')}</span>
                            <span className="text-sm font-bold text-slate-700">{formatDateTime(foundDoc.created_at)}</span>
                          </div>
                        )}
                        {foundDoc.attachment_count !== undefined && (
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase block">{t('scanner.attachments_count')}</span>
                            <span className="text-sm font-bold text-slate-700">{foundDoc.attachment_count}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Timeline Tab */}
                {activeTab === 'timeline' && (
                  <div className="space-y-4">
                    <form onSubmit={handleAddTimelineEntry} className="flex gap-2">
                      <input 
                        name="note" 
                        placeholder={t('scanner.timeline_placeholder')}
                        className="flex-1 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all"
                        aria-label={t('scanner.timeline_placeholder')}
                      />
                      <button 
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all"
                        aria-label={t('scanner.timeline_add')}
                      >
                        {t('scanner.timeline_add')}
                      </button>
                    </form>

                    <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                      {timeline.length > 0 ? (
                        timeline.map((entry, i) => (
                          <div 
                            key={i} 
                            className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors"
                          >
                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0"></div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-800 text-sm">
                                {entry.message || entry.action || entry.note || JSON.stringify(entry)}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Clock size={12} />
                                  {formatDateTime(entry.created_at || entry.date || entry.ts)}
                                </span>
                                {entry.actor_name && (
                                  <span className="flex items-center gap-1">
                                    <User size={12} />
                                    {entry.actor_name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-slate-400">
                          <History size={32} className="mx-auto mb-2 opacity-30" />
                          <p className="font-bold">{t('scanner.timeline_empty')}</p>
                          <p className="text-sm">{t('scanner.timeline_start')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Attachments Tab */}
                {activeTab === 'attachments' && (
                  <div className="space-y-4">
                    {foundDoc.attachments && foundDoc.attachments.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {foundDoc.attachments.map((att: any, idx: number) => (
                          <div 
                            key={idx}
                            className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-200 transition-colors group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                                <FileText size={20} className="text-blue-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-800 text-sm truncate">
                                  {att.name || `مرفق ${idx + 1}`}
                                </p>
                                <p className="text-xs text-slate-500">{att.type || 'PDF'}</p>
                              </div>
                            </div>
                            
                            <AsyncButton
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title={t('scanner.preview')}
                              aria-label={`${t('scanner.preview')} ${idx + 1}`}
                              onClickAsync={async () => {
                                try {
                                  const url = await apiClient.getPreviewUrl(foundDoc.barcode, idx)
                                  if (url) window.open(url, '_blank')
                                  else showStatus('scanner.no_preview', 'error')
                                } catch {
                                  showStatus('scanner.attachment_error', 'error')
                                }
                              }}
                            >
                              <Eye size={18} />
                            </AsyncButton>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-400">
                        <Paperclip size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="font-bold">{t('scanner.no_attachments')}</p>
                        <p className="text-sm">{t('scanner.no_attachments_desc')}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-6 bg-slate-50 border-t border-slate-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <AsyncButton 
                    className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all col-span-2"
                    aria-label={t('scanner.preview_file')}
                    onClickAsync={async () => {
                      try {
                        const previewUrl = await apiClient.getPreviewUrl(foundDoc.barcode)
                        if (!previewUrl) {
                          showStatus('scanner.preview_error', 'error')
                          return
                        }
                        window.open(previewUrl, '_blank')
                      } catch (e) {
                        console.error('Failed to open preview', e)
                        showStatus('scanner.open_error', 'error')
                      }
                    }}
                  >
                    <Eye size={18} />
                    {t('scanner.preview_file')}
                  </AsyncButton>

                  {currentUserPermissions?.archive?.edit === true && (
                    <button 
                      onClick={() => {
                        setEditForm(foundDoc)
                        setEditing(true)
                      }}
                      className="bg-amber-100 hover:bg-amber-200 text-amber-700 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                      aria-label={t('scanner.edit')}
                    >
                      <Edit3 size={18} />
                      {t('scanner.edit')}
                    </button>
                  )}

                  {currentUserPermissions?.archive?.delete === true && (
                    <button 
                      onClick={handleDelete}
                      className="bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                      aria-label={t('scanner.delete')}
                    >
                      <Trash2 size={18} />
                      {t('scanner.delete')}
                    </button>
                  )}
                </div>
              </div>

              {/* Edit Modal */}
              {editing && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
                    <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                      <h4 className="text-lg font-black text-slate-900">{t('scanner.edit_modal_title')}</h4>
                      <button 
                        onClick={() => setEditing(false)}
                        className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-all"
                        aria-label={t('common.close')}
                      >
                        <X size={20} />
                      </button>
                    </div>
                    
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{t('scanner.doc_type')}</label>
                        <select 
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-all"
                          value={editForm.type || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value as any }))}
                        >
                          <option value="INCOMING">{t('scanner.incoming')}</option>
                          <option value="OUTGOING">{t('scanner.outgoing')}</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{t('scanner.subject')}</label>
                        <input 
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-all"
                          value={editForm.subject || editForm.title || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, subject: e.target.value, title: e.target.value }))}
                          placeholder={t('scanner.subject_placeholder')}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{t('scanner.from')}</label>
                          <input 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-all"
                            value={editForm.sender || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, sender: e.target.value }))}
                            placeholder={t('scanner.from_placeholder')}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{t('scanner.to')}</label>
                          <input 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-all"
                            value={editForm.recipient || editForm.receiver || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, recipient: e.target.value, receiver: e.target.value }))}
                            placeholder={t('scanner.to_placeholder')}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{t('scanner.priority')}</label>
                        <select 
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-all"
                          value={editForm.priority || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, priority: e.target.value }))}
                        >
                          <option value={t('new.key.fafis5')}>{t('scanner.priority_normal')}</option>
                          <option value={t('new.key.6c24cm')}>{t('scanner.priority_urgent')}</option>
                          <option value={t('new.key.iewttb')}>{t('scanner.priority_very_urgent')}</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{t('scanner.notes')}</label>
                        <textarea 
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-all resize-none"
                          rows={3}
                          value={editForm.notes || editForm.description || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value, description: e.target.value }))}
                          placeholder={t('scanner.notes_placeholder')}
                        />
                      </div>
                    </div>
                    
                    <div className="p-6 border-t border-slate-200 flex gap-3">
                      <button 
                        onClick={() => setEditing(false)}
                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all"
                      >
                        {t('scanner.cancel')}
                      </button>
                      <button 
                        onClick={handleSaveEdits}
                        disabled={editPending}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                      >
                        {editPending ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            {t('scanner.saving')}
                          </>
                        ) : (
                          t('scanner.save')
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Empty State */
            <div className="h-full min-h-[400px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Scan size={40} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-black text-slate-600 mb-2">{t('scanner.waiting')}</h3>
              <p className="text-slate-400 max-w-sm">
                {t('scanner.waiting_desc')}
              </p>
              
              {isLoadingBarcode && (
                <div className="mt-6 flex items-center gap-2 text-blue-600">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="font-bold">{t('scanner.searching')}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes scan {
          0% { top: 15%; }
          100% { top: 85%; }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite alternate;
        }
      `}</style>
    </div>
  )
}

export default BarcodeScanner

