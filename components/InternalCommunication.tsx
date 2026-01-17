import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    CheckCircle2,
    FileText,
    Lock,
    MessageSquare,
    Paperclip,
    Pin,
    Search,
    Send,
    Shield,
    Star,
    Trash2,
    Pencil,
    Users,
    X,
    Image as ImageIcon,
} from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { User } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { useI18n } from '../lib/i18n-context'; // Updated Import

interface Message {
  id: number;
  sender_id: number;
  sender_name: string;
  sender_full_name?: string;
  sender_avatar?: string;
  sender_role?: string;
    content?: string | null;
    attachments?: any[];
  mentions: number[];
  is_locked: boolean; // Computed by backend
    is_deleted?: boolean;
    deleted_at?: string | null;
    edited_at?: string | null;
    is_pinned?: boolean;
    pinned_at?: string | null;
    pinned_by?: number | null;
    is_starred?: boolean;
    reaction_counts?: Record<string, number>;
    my_reactions?: string[];
  created_at: string;
}

interface InternalCommunicationProps {
  currentUser: User;
  users?: User[];
}

export default function InternalCommunication({ currentUser, users: propUsers }: InternalCommunicationProps) {
    const { t, locale, dir } = useI18n(); // Updated Hook
    const canStartChat = Boolean((currentUser as any)?.permissions?.communication?.access_chat);

    const [messages, setMessages] = useState<Message[]>([]);
    const [users, setUsers] = useState<User[]>(propUsers || []);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [sending, setSending] = useState(false);
    const [inputText, setInputText] = useState('');
    const [selectedMentions, setSelectedMentions] = useState<number[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [queryText, setQueryText] = useState('');
    const [hasAttachmentsOnly, setHasAttachmentsOnly] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingText, setEditingText] = useState('');
    const [preview, setPreview] = useState<{ url: string; name?: string; type?: string } | null>(null);
    const [lastEventId, setLastEventId] = useState(0);
    const [typingUsers, setTypingUsers] = useState<Record<number, { name: string; ts: number }>>({});

    const PAGE_SIZE = 30;
    const MAX_ATTACHMENTS = 5;
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const allowedTypes = useMemo(() => new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp']), []);

    const listRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimerRef = useRef<number | null>(null);
    const isTypingRef = useRef(false);

    const resolveFileUrl = (url: string) => {
        if (!url) return url;
        return url.includes('r2.cloudflarestorage.com')
            ? `${process.env.NEXT_PUBLIC_API_URL || 'https://zaco-backend.onrender.com/api'}/uploads/proxy?url=${encodeURIComponent(url)}`
            : url;
    };

    const fetchUsers = useCallback(async () => {
        if (propUsers && propUsers.length > 0) {
            setUsers(propUsers);
            return;
        }
        try {
            // Use internal-comm/users endpoint instead of general users endpoint
            const u: any = await (apiClient as any).request('/internal-comm/users', { method: 'GET' });
            setUsers(Array.isArray(u) ? u : []);
        } catch (e) {
            console.error('Failed to load users', e);
            // Fallback to basic users if specific endpoint fails
            try {
                const u = await apiClient.getUsers();
                setUsers(u);
            } catch (e2) {
                console.warn('Fallback users fetch failed', e2);
            }
        }
    }, [propUsers]);

    const fetchPage = useCallback(
        async ({ offset, replace }: { offset: number; replace: boolean }) => {
            const params = new URLSearchParams();
            params.set('limit', String(PAGE_SIZE));
            params.set('offset', String(offset));
            if (queryText.trim()) params.set('q', queryText.trim());
            if (hasAttachmentsOnly) params.set('has_attachments', 'true');

            const url = `/internal-comm?${params.toString()}`;
            const res: any = await (apiClient as any).request(url, { method: 'GET' });
            const page: Message[] = Array.isArray(res) ? res : [];

            // Backend returns DESC; reverse for chat-style bottom-newest.
            const asc = page.slice().reverse();

            setHasMore(page.length === PAGE_SIZE);
            setMessages((prev) => {
                if (replace) return asc;
                const existingIds = new Set(prev.map((m) => m.id));
                const prepend = asc.filter((m) => !existingIds.has(m.id));
                return [...prepend, ...prev];
            });
        },
        [PAGE_SIZE, hasAttachmentsOnly, queryText]
    );

    const refetchLoaded = useCallback(async () => {
        const count = Math.max(PAGE_SIZE, messages.length);
        const params = new URLSearchParams();
        params.set('limit', String(count));
        params.set('offset', '0');
        if (queryText.trim()) params.set('q', queryText.trim());
        if (hasAttachmentsOnly) params.set('has_attachments', 'true');

        const url = `/internal-comm?${params.toString()}`;
        const res: any = await (apiClient as any).request(url, { method: 'GET' });
        const page: Message[] = Array.isArray(res) ? res : [];
        setHasMore(page.length === count);
        setMessages(page.slice().reverse());
    }, [PAGE_SIZE, hasAttachmentsOnly, messages.length, queryText]);

    const loadInitial = useCallback(async () => {
        setLoading(true);
        try {
            await Promise.all([fetchUsers(), fetchPage({ offset: 0, replace: true })]);
        } finally {
            setLoading(false);
        }
    }, [fetchPage, fetchUsers]);

    useEffect(() => {
        loadInitial();
    }, []);

    // Search / filter refresh
    useEffect(() => {
        const t = window.setTimeout(() => {
            fetchPage({ offset: 0, replace: true }).catch((e) => console.error('Failed to fetch messages', e));
        }, 350);
        return () => window.clearTimeout(t);
    }, [queryText, hasAttachmentsOnly]);

    // Scroll to bottom on first load / new message send
    useEffect(() => {
        if (!loading) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [loading]);

    const handleScroll = useCallback(() => {
        const el = listRef.current;
        if (!el || loadingMore || !hasMore) return;
        if (el.scrollTop <= 10) {
            const prevHeight = el.scrollHeight;
            setLoadingMore(true);
            fetchPage({ offset: messages.length, replace: false })
                .then(() => {
                    // Keep scroll position stable after prepending
                    window.setTimeout(() => {
                        const nextHeight = el.scrollHeight;
                        el.scrollTop = nextHeight - prevHeight;
                    }, 0);
                })
                .catch((e) => console.error('Failed to load more', e))
                .finally(() => setLoadingMore(false));
        }
    }, [fetchPage, hasMore, loadingMore, messages.length]);

    // Long-poll updates (reduces polling load)
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            while (!cancelled) {
                try {
                    const params = new URLSearchParams();
                    params.set('sinceId', String(lastEventId));
                    params.set('timeoutMs', '25000');
                    const resp: any = await (apiClient as any).request(`/internal-comm/updates?${params.toString()}`, { method: 'GET' });
                    if (cancelled) return;
                    const events = resp?.events;
                    if (Array.isArray(events) && events.length > 0) {
                        const maxId = Math.max(...events.map((e: any) => Number(e.id) || 0));
                        setLastEventId((prev) => Math.max(prev, maxId));

                        // Handle typing events without refetch
                        const typing = events.filter((e: any) => e?.type === 'typing');
                        if (typing.length > 0) {
                            setTypingUsers((prev) => {
                                const next = { ...prev };
                                for (const ev of typing) {
                                    const p = ev.payload || {};
                                    const senderId = Number(p.sender_id);
                                    if (!senderId || senderId === Number(currentUser.id)) continue;
                                    if (!p.is_typing) {
                                        delete next[senderId];
                                        continue;
                                    }
                                    next[senderId] = {
                                        name: p.sender_full_name || p.sender_name || 'مستخدم',
                                        ts: Date.now()
                                    };
                                }
                                return next;
                            });
                        }

                        // Any message-related events: refresh loaded window
                        const hasMessageEvent = events.some((e: any) => String(e?.type || '').startsWith('message.'));
                        if (hasMessageEvent) {
                            await refetchLoaded();
                        }
                    }
                } catch (_e) {
                    // Backoff a bit
                    await new Promise((r) => setTimeout(r, 1500));
                }
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [currentUser.id, lastEventId, refetchLoaded]);

    // Clean typing indicators automatically
    useEffect(() => {
        const id = window.setInterval(() => {
            setTypingUsers((prev) => {
                const now = Date.now();
                const next: typeof prev = {};
                for (const [k, v] of Object.entries(prev)) {
                    if (now - v.ts < 3500) next[Number(k)] = v;
                }
                return next;
            });
        }, 1000);
        return () => window.clearInterval(id);
    }, []);

    const emitTyping = useCallback(
        (isTyping: boolean) => {
            if (!selectedMentions.length) return;
            (apiClient as any)
                .request('/internal-comm/typing', {
                    method: 'POST',
                    body: JSON.stringify({ mentions: selectedMentions, isTyping })
                })
                .catch(() => undefined);
        },
        [selectedMentions]
    );

    const scheduleTyping = useCallback(
        () => {
            if (!canStartChat) return;
            if (!isTypingRef.current) {
                isTypingRef.current = true;
                emitTyping(true);
            }
            if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
            typingTimerRef.current = window.setTimeout(() => {
                isTypingRef.current = false;
                emitTyping(false);
            }, 1200);
        },
        [canStartChat, emitTyping]
    );

    const addFiles = useCallback(
        (incoming: File[]) => {
            const valid = incoming
                .filter((f) => allowedTypes.has(String(f.type).toLowerCase()))
                .filter((f) => f.size <= MAX_FILE_SIZE);
            setFiles((prev) => {
                const merged = [...prev, ...valid];
                return merged.slice(0, MAX_ATTACHMENTS);
            });
        },
        [MAX_ATTACHMENTS, MAX_FILE_SIZE, allowedTypes]
    );

    const handleSend = async () => {
        if (!canStartChat) return;
        if ((!inputText.trim() && files.length === 0) || selectedMentions.length === 0) return;

        setSending(true);
        try {
            const attachments: any[] = [];
            if (files.length > 0) {
                const uploads = await Promise.all(
                    files.map(async (f) => {
                        const uploadRes = await apiClient.uploadFile(f, 3, 'internal_comm');
                        return {
                            name: f.name,
                            url: uploadRes.url || uploadRes.file?.url,
                            type: f.type,
                            size: f.size
                        };
                    })
                );
                for (const u of uploads) attachments.push(u);
            }

            await (apiClient as any).request('/internal-comm', {
                method: 'POST',
                body: JSON.stringify({
                    content: inputText,
                    attachments,
                    mentions: selectedMentions
                })
            });

            setInputText('');
            setFiles([]);
            setSelectedMentions([]);
            // Refresh what we currently show
            await refetchLoaded();
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        } catch (e) {
            alert(t('internal.send_error'));
        } finally {
            setSending(false);
        }
    };

  const toggleMention = (userId: number) => {
    if (selectedMentions.includes(userId)) {
        setSelectedMentions(prev => prev.filter(id => id !== userId));
    } else {
        setSelectedMentions(prev => [...prev, userId]);
    }
  };

    const canModerate = useMemo(() => {
        const r = String((currentUser as any).role || '').toLowerCase();
        return r === 'admin' || r === 'manager';
    }, [currentUser]);

    const doStar = async (id: number) => {
        try {
            await (apiClient as any).request(`/internal-comm/${id}/star`, { method: 'POST' });
            await refetchLoaded();
        } catch {
            // ignore
        }
    };

    const doPin = async (id: number, pinned: boolean) => {
        try {
            await (apiClient as any).request(`/internal-comm/${id}/pin`, {
                method: 'PATCH',
                body: JSON.stringify({ pinned })
            });
            await refetchLoaded();
        } catch {
            // ignore
        }
    };

    const doReact = async (id: number, emoji: string) => {
        try {
            await (apiClient as any).request(`/internal-comm/${id}/react`, {
                method: 'POST',
                body: JSON.stringify({ emoji })
            });
            await refetchLoaded();
        } catch {
            // ignore
        }
    };

    const startEdit = (msg: Message) => {
        setEditingId(msg.id);
        setEditingText(String(msg.content || ''));
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditingText('');
    };

    const saveEdit = async () => {
        if (!editingId) return;
        const text = editingText.trim();
        if (!text) return;
        try {
            await (apiClient as any).request(`/internal-comm/${editingId}`, {
                method: 'PATCH',
                body: JSON.stringify({ content: text })
            });
            cancelEdit();
            await refetchLoaded();
        } catch {
            alert(t('internal.edit_error'));
        }
    };

    const doDelete = async (id: number) => {
        if (!confirm(t('internal.delete_confirm'))) return;
        try {
            await (apiClient as any).request(`/internal-comm/${id}`, {
                method: 'DELETE',
                body: JSON.stringify({ reason: 'deleted_from_ui' })
            });
            await refetchLoaded();
        } catch {
            alert(t('internal.delete_error'));
        }
    };

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6">
      {/* Sidebar - Audience Selection */}
      <div className="w-80 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden hidden md:flex">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-black text-slate-800 flex items-center gap-2">
            <Users size={20} className="text-slate-400" />
            {t('internal.select_recipient_title')}
          </h3>
          <p className="text-xs text-slate-400 mt-1 font-bold">{t('internal.select_recipient_subtitle')}</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div 
                onClick={() => {
                   if (selectedMentions.length === users.length) setSelectedMentions([]);
                   else setSelectedMentions(users.map(u => Number(u.id)));
                }}
                className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all border-2 ${
                    selectedMentions.length === users.length && users.length > 0
                    ? 'bg-slate-900 border-slate-900 text-white' 
                    : 'bg-white border-slate-100 hover:border-slate-300 text-slate-700'
                }`}
            >
                <div className={`p-2 rounded-lg ${selectedMentions.length === users.length ? 'bg-slate-700' : 'bg-slate-100'}`}>
                    <Users size={18} />
                </div>
                <span className="font-bold text-sm">{t('internal.all')} ({users.length})</span>
            </div>

            {users.filter(u => Number(u.id) !== Number(currentUser.id)).map(user => {
                const isSelected = selectedMentions.includes(Number(user.id));
                return (
                    <div 
                        key={user.id}
                        onClick={() => toggleMention(Number(user.id))}
                        className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all border-2 ${
                            isSelected 
                            ? 'bg-indigo-50 border-indigo-500 shadow-indigo-100' 
                            : 'bg-white border-slate-100 hover:border-slate-300'
                        }`}
                    >
                        <div className="relative">
                            {user.profile_picture_url ? (
                                <img 
                                  src={user.profile_picture_url.includes('r2.cloudflarestorage.com') 
                                    ? `${process.env.NEXT_PUBLIC_API_URL || 'https://zaco-backend.onrender.com/api'}/uploads/proxy?url=${encodeURIComponent(user.profile_picture_url)}` 
                                    : user.profile_picture_url} 
                                  className="w-10 h-10 rounded-full object-cover" 
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-black text-slate-500">
                                    {(user.full_name || user.username).substring(0, 2)}
                                </div>
                            )}
                            {isSelected && (
                                <div className="absolute -bottom-1 -right-1 bg-indigo-500 text-white rounded-full p-0.5 border-2 border-white">
                                    <CheckCircle2 size={12} />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <h4 className={`font-bold text-sm truncate ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                                {user.full_name || user.username}
                            </h4>
                            {/* Role hidden as requested */}
                        </div>
                    </div>
                );
            })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                 {/* Header / Search */}
                 <div className="p-4 border-b border-slate-100 bg-white">
                     <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                         <div className="flex items-center gap-2">
                             <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                                 <Search size={18} />
                             </div>
                             <input
                                 value={queryText}
                                 onChange={(e) => setQueryText(e.target.value)}
                                 placeholder={t('internal.search_placeholder')}
                                 className="w-full md:w-80 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-200"
                             />
                         </div>
                         <label className="flex items-center gap-2 text-xs font-black text-slate-600 select-none">
                             <input
                                 type="checkbox"
                                 checked={hasAttachmentsOnly}
                                 onChange={(e) => setHasAttachmentsOnly(e.target.checked)}
                                 className="w-4 h-4"
                             />
                             {t('internal.attachments_only')}
                         </label>
                     </div>
                 </div>

         {/* Feed */}
                 <div
                     ref={listRef}
                     onScroll={handleScroll}
                     className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30"
                     onDragOver={(e) => {
                         if (!canStartChat) return;
                         e.preventDefault();
                     }}
                     onDrop={(e) => {
                         if (!canStartChat) return;
                         e.preventDefault();
                         const dropped = Array.from(e.dataTransfer.files || []);
                         addFiles(dropped);
                     }}
                 >
                        {loadingMore && (
                            <div className="text-center text-xs font-bold text-slate-400">{t('common.loading')}</div>
                        )}
            {messages.length === 0 && !loading && (
                <div className="text-center py-20 opacity-50">
                    <MessageSquare size={48} className="mx-auto mb-4" />
                    <p className="font-bold">{t('internal.start_new')}</p>
                </div>
            )}

                        {Object.keys(typingUsers).length > 0 && (
                            <div className="text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2 inline-flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                {Object.values(typingUsers)
                                    .slice(0, 2)
                                    .map((t) => t.name)
                                    .join(locale === 'ar' ? '، ' : ', ')}
                                {Object.keys(typingUsers).length > 2 ? ' ...' : ''}
                                {t('internal.typing')}
                            </div>
                        )}
            
            {messages.map((msg, idx) => {
                if (msg.is_locked) {
                    // Locked Message View
                    return (
                        <div key={msg.id} className="flex justify-center my-4">
                            <div className="bg-slate-50 border border-slate-100 rounded-3xl px-6 py-3 flex items-center gap-4 text-slate-500 shadow-sm max-w-lg w-full">
                                <Lock size={20} className="text-slate-400" />
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-slate-700 mb-1">
                                        {t('internal.private_msg')} {msg.sender_full_name || msg.sender_name}
                                    </p>
                                    <div className="flex items-center gap-1 text-[10px]">
                                        <span>{t('internal.to')}</span>
                                        <div className="flex -space-x-2 space-x-reverse">
                                            {Array.isArray(msg.mentions) && msg.mentions.slice(0, 5).map(uid => (
                                                <div key={uid} className="w-5 h-5 rounded-full bg-slate-300 border border-white flex items-center justify-center text-[8px] font-bold">
                                                    {uid}
                                                </div>
                                            ))}
                                            {Array.isArray(msg.mentions) && msg.mentions.length > 5 && (
                                                <div className="w-5 h-5 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[8px] font-bold">
                                                    +{msg.mentions.length - 5}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <span className="text-[10px] font-mono">{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: locale === 'ar' ? arSA : enUS })}</span>
                            </div>
                        </div>
                    );
                }

                // Visible Message View
                const isMe = msg.sender_id === Number(currentUser.id);
                const isOwner = isMe;
                const canEdit = isOwner || String((currentUser as any).role || '').toLowerCase() === 'admin';
                const canDelete = isOwner || String((currentUser as any).role || '').toLowerCase() === 'admin';
                const isEditing = editingId === msg.id;
                return (
                    <div key={msg.id} className={`flex gap-4 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                             {msg.sender_avatar ? (
                                <img 
                                  src={msg.sender_avatar.includes('r2.cloudflarestorage.com') 
                                    ? `${process.env.NEXT_PUBLIC_API_URL || 'https://zaco-backend.onrender.com/api'}/uploads/proxy?url=${encodeURIComponent(msg.sender_avatar)}` 
                                    : msg.sender_avatar} 
                                  className="w-10 h-10 rounded-full object-cover shadow-sm ring-2 ring-white" 
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black shadow-sm ring-2 ring-white">
                                    {(msg.sender_full_name || msg.sender_name || 'U').substring(0, 2)}
                                </div>
                            )}
                        </div>

                        {/* Bubble */}
                        <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-2 mb-1 px-1">
                                <span className="text-xs font-bold text-slate-700">{msg.sender_full_name || msg.sender_name}</span>
                                <span className="text-[10px] text-slate-400">{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: locale === 'ar' ? arSA : enUS })}</span>
                                                                {msg.is_pinned && (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                                                                        <Pin size={10} /> {t('internal.pinned')}
                                                                    </span>
                                                                )}
                                                                {msg.edited_at && !msg.is_deleted && (
                                                                    <span className="text-[10px] text-slate-400 font-medium">{t('internal.edited')}</span>
                                                                )}
                            </div>
                            
                                                        <div className={`px-5 py-3 rounded-3xl text-sm font-medium leading-relaxed shadow-sm transition-all ${
                                                            isMe 
                                                                ? 'bg-blue-600 text-white' 
                                                                : 'bg-white border border-slate-100 text-slate-800'
                                                        }`}>
                                                            {msg.is_deleted ? (
                                                                <span className={isMe ? 'text-blue-200' : 'text-slate-400 italic'}>{t('internal.msg_deleted')}</span>
                                                            ) : isEditing ? (
                                                                <div className="space-y-2 w-full min-w-[200px]">
                                                                    <textarea
                                                                        value={editingText}
                                                                        onChange={(e) => setEditingText(e.target.value)}
                                                                        className={`w-full resize-none rounded-xl p-3 text-sm outline-none shadow-inner ${isMe ? 'text-slate-900' : 'text-slate-900'} bg-white`}
                                                                        rows={3}
                                                                    />
                                                                    <div className="flex items-center gap-2 justify-end">
                                                                        <button onClick={cancelEdit} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-current transition-colors">{t('common.cancel')}</button>
                                                                        <button onClick={saveEdit} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 transition-colors">{t('common.save')}</button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                msg.content
                                                            )}
                                                        </div>

                                                        {/* Actions Row */}
                                                        {!msg.is_deleted && (
                                                            <div className={`mt-2 flex items-center gap-2 ${isMe ? 'justify-end' : 'justify-start'} flex-wrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:opacity-100`}>
                                                                <button
                                                                    onClick={() => doReact(msg.id, '👍')}
                                                                    className={`text-xs font-bold px-2 py-1 rounded-full border transition-all ${
                                                                        msg.my_reactions?.includes('👍')
                                                                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                                                                            : 'bg-white border-transparent hover:border-slate-200 text-slate-500'
                                                                    }`}
                                                                >
                                                                    👍 {msg.reaction_counts?.['👍'] || 0}
                                                                </button>
                                                                <button
                                                                    onClick={() => doReact(msg.id, '✅')}
                                                                    className={`text-xs font-bold px-2 py-1 rounded-full border transition-all ${
                                                                        msg.my_reactions?.includes('✅')
                                                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                                            : 'bg-white border-transparent hover:border-slate-200 text-slate-500'
                                                                    }`}
                                                                >
                                                                    ✅ {msg.reaction_counts?.['✅'] || 0}
                                                                </button>
                                                                <button
                                                                    onClick={() => doReact(msg.id, '❗')}
                                                                    className={`text-xs font-bold px-2 py-1 rounded-full border transition-all ${
                                                                        msg.my_reactions?.includes('❗')
                                                                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                                                                            : 'bg-white border-transparent hover:border-slate-200 text-slate-500'
                                                                    }`}
                                                                >
                                                                    ❗ {msg.reaction_counts?.['❗'] || 0}
                                                                </button>

                                                                <button
                                                                    onClick={() => doStar(msg.id)}
                                                                    className={`text-[10px] font-bold px-2 py-1 rounded-full border inline-flex items-center gap-1 transition-all ${
                                                                        msg.is_starred
                                                                            ? 'bg-amber-50 border-amber-200 text-amber-600'
                                                                            : 'bg-white border-transparent hover:border-slate-200 text-slate-400'
                                                                    }`}
                                                                    title={t('internal.star')}
                                                                >
                                                                    <Star size={12} className={msg.is_starred ? "fill-amber-500 text-amber-500" : ""} />
                                                                </button>

                                                                {canModerate && (
                                                                    <button
                                                                        onClick={() => doPin(msg.id, !msg.is_pinned)}
                                                                        className="text-[10px] font-bold px-2 py-1 rounded-full border bg-white border-transparent hover:border-slate-200 text-slate-400 inline-flex items-center gap-1 transition-all"
                                                                        title={t('internal.pin')}
                                                                    >
                                                                        <Pin size={12} />
                                                                    </button>
                                                                )}

                                                                {canEdit && !isEditing && (
                                                                    <button
                                                                        onClick={() => startEdit(msg)}
                                                                        className="text-[10px] font-bold px-2 py-1 rounded-full border bg-white border-transparent hover:border-slate-200 text-slate-400 inline-flex items-center gap-1 transition-all"
                                                                        title={t('common.edit')}
                                                                    >
                                                                        <Pencil size={12} />
                                                                    </button>
                                                                )}

                                                                {canDelete && (
                                                                    <button
                                                                        onClick={() => doDelete(msg.id)}
                                                                        className="text-[10px] font-bold px-2 py-1 rounded-full border bg-white border-transparent hover:border-slate-200 text-red-500 inline-flex items-center gap-1 transition-all"
                                                                        title={t('common.delete')}
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}

                            {/* Attachments */}
                            {msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                                <div className="mt-2 space-y-2 w-full">
                                    {msg.attachments.map((att: any, i: number) => {
                                                                                const fileUrl = resolveFileUrl(att.url);
                                                                                const isImage = String(att.type || '').startsWith('image/');
                                                                                const isPdf = String(att.type || '').toLowerCase() === 'application/pdf' || String(att.name || '').toLowerCase().endsWith('.pdf');
                                        
                                        return (
                                                                                    <div key={i} className={`p-3 rounded-2xl border flex items-center gap-3 transition-colors ${
                                                                                        isMe ? 'bg-blue-700 border-blue-600 text-white' : 'bg-white border-slate-100 hover:border-slate-200'
                                                                                    }`}>
                                                                                        <div className={`p-2 rounded-xl ${isMe ? 'bg-blue-600' : 'bg-slate-100'}`}>
                                                                                            {isImage ? (
                                                                                                <ImageIcon size={16} className={isMe ? 'text-blue-200' : 'text-slate-600'} />
                                                                                            ) : isPdf ? (
                                                                                                <FileText size={16} className={isMe ? 'text-blue-200' : 'text-slate-600'} />
                                                                                            ) : (
                                                                                                <Paperclip size={16} className={isMe ? 'text-blue-200' : 'text-slate-600'} />
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="flex-1 min-w-0 text-right">
                                                                                            <div className={`text-xs font-bold truncate ${isMe ? 'text-white' : 'text-slate-900'}`}>{att.name || t('internal.attachment_default')}</div>
                                                                                            <div className={`text-[10px] ${isMe ? 'text-blue-200' : 'text-slate-500'}`}>{isImage ? t('internal.preview') : isPdf ? t('internal.type_pdf') : t('internal.open')}</div>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-2">
                                                                                            {(isImage || isPdf) && (
                                                                                                <button
                                                                                                    onClick={() => setPreview({ url: fileUrl, name: att.name, type: att.type })}
                                                                                                    className={`text-[10px] font-bold px-2 py-1 rounded-lg ${isMe ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                                                                                                >
                                                                                                    {t('internal.preview')}
                                                                                                </button>
                                                                                            )}
                                                                                            <a
                                                                                                href={fileUrl}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className={`text-[10px] font-bold px-2 py-1 rounded-lg ${isMe ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                                                                                            >
                                                                                                {t('common.download')}
                                                                                            </a>
                                                                                        </div>
                                                                                    </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Mentions Footer */}
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 px-1 opacity-70">
                                <Shield size={10} />
                                <span>{t('internal.private_to')} </span>
                                {Array.isArray(msg.mentions) && msg.mentions.length > 0 ? (
                                    <span>
                                        {msg.mentions.length === users.length ? t('internal.all') : 
                                         msg.mentions.map(id => {
                                             const u = users.find(user => Number(user.id) === Number(id));
                                             return u?.full_name || u?.username || id;
                                         }).join(locale === 'ar' ? '، ' : ', ')}
                                    </span>
                                ) : (
                                    <span>{t('internal.only_me')} {msg.sender_name}</span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
         </div>

         {/* Input Area */}
         <div className="p-4 bg-white border-t border-slate-100">
                         {!canStartChat && (
                             <div className="mb-2 flex items-center gap-2 text-red-600 text-xs font-bold bg-red-50 p-2 rounded-lg">
                                 <AlertCircle size={14} />
                                 {t('internal.no_permission')}
                             </div>
                         )}

                         {selectedMentions.length === 0 && canStartChat && (
                 <div className="mb-2 flex items-center gap-2 text-amber-600 text-xs font-bold bg-amber-50 p-2 rounded-lg animate-pulse">
                     <AlertCircle size={14} />
                     {t('internal.select_recipient')}
                 </div>
             )}
             
             <div className="flex items-end gap-3">
                 <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-200 focus-within:ring-2 focus-within:ring-slate-200 focus-within:border-slate-300 transition-all p-2">
                     <textarea
                        value={inputText}
                                                onChange={(e) => {
                                                    setInputText(e.target.value);
                                                    scheduleTyping();
                                                }}
                        placeholder={t('internal.type_message')}
                        className="w-full bg-transparent border-none outline-none resize-none text-sm font-bold min-h-[40px] max-h-32 p-2"
                        rows={1}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                                                disabled={!canStartChat}
                     />
                     <div className="flex items-center justify-between px-2 pt-2 border-t border-slate-100 mt-2">
                                                <label className={`p-2 rounded-full cursor-pointer hover:bg-slate-200 transition-colors ${files.length > 0 ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'} ${!canStartChat ? 'opacity-50 pointer-events-none' : ''}`}>
                            <Paperclip size={18} />
                            <input 
                                                                type="file" 
                                                                multiple
                                                                accept="image/*,application/pdf"
                                className="hidden" 
                                                                onChange={(e) => {
                                                                    const picked = Array.from(e.target.files || []);
                                                                    addFiles(picked);
                                                                    e.currentTarget.value = '';
                                                                }} 
                            />
                        </label>
                                                {files.length > 0 && (
                                                    <div className="flex items-center gap-2 flex-wrap justify-end">
                                                        {files.map((f, i) => (
                                                            <span key={i} className="inline-flex items-center gap-2 text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-full max-w-[200px]">
                                                                <span className="truncate max-w-[140px]">{f.name}</span>
                                                                <button
                                                                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                                                                    className="text-indigo-700 hover:text-indigo-900"
                                                                    title={t('internal.remove')}
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                     </div>
                 </div>
                 
                 <button
                    onClick={handleSend}
                                        disabled={!canStartChat || sending || selectedMentions.length === 0 || (!inputText.trim() && files.length === 0)}
                    className="p-4 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-slate-200"
                 >
                     {sending ? (
                         <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                     ) : (
                         <div className="flex flex-col items-center gap-1">
                            <Send size={20} className={document.dir === 'rtl' ? 'rotate-180' : ''} />
                         </div>
                     )}
                 </button>
             </div>
         </div>
      </div>

            {/* Preview Modal */}
            {preview && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                            <div className="text-sm font-black text-slate-800 truncate">{preview.name || t('internal.preview')}</div>
                            <button className="p-2 rounded-xl hover:bg-slate-100" onClick={() => setPreview(null)}>
                                <X size={18} className="text-slate-600" />
                            </button>
                        </div>
                        <div className="w-full h-full bg-slate-50">
                            {String(preview.type || '').startsWith('image/') ? (
                                <img src={preview.url} className="w-full h-full object-contain" />
                            ) : (
                                <iframe src={preview.url} className="w-full h-full" />
                            )}
                        </div>
                    </div>
                </div>
            )}
    </div>
  );
}
