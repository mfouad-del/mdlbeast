"use strict";
/**
 * ArchivX Professional ID Engine - 2025
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportToCSV = exports.generateBusinessBarcode = exports.generateUUIDv7 = void 0;
/**
 * توليد UUID v7 مرتب زمنياً لضمان كفاءة الفهرسة (Indexing)
 */
const generateUUIDv7 = () => {
    // Ensure this works in both browser and Node (fallbacks included)
    // Use a robust timestamp source and ensure it is never zero
    let timestamp = Date.now() || (new Date()).getTime();
    if (!Number.isFinite(timestamp) || timestamp <= 0)
        timestamp = Math.floor(Date.now() / 1);
    let hexTimestamp = Math.floor(timestamp).toString(16).padStart(12, '0');
    // Fallback if hexTimestamp somehow all zeros or invalid
    if (!hexTimestamp || /^0+$/.test(hexTimestamp)) {
        hexTimestamp = Math.floor(Date.now() / 1000).toString(16).padStart(12, '0');
    }
    // Get 10 random bytes; prefer Web Crypto, fallback to Node crypto, fallback to Math.random
    const getRandomBytes = (n) => {
        if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
            return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(n)));
        }
        try {
            // Node.js environment
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const nodeCrypto = require('crypto');
            return Array.from(nodeCrypto.randomBytes(n));
        }
        catch (e) {
            // Last resort: Math.random — not cryptographically secure but acceptable fallback
            return Array.from({ length: n }, () => Math.floor(Math.random() * 256));
        }
    };
    const rand = getRandomBytes(10);
    const randomPart = rand.map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hexTimestamp.slice(0, 8)}-${hexTimestamp.slice(8, 12)}-7${randomPart.slice(0, 3)}-${(parseInt(randomPart.slice(3, 4), 16) & 0x3 | 0x8).toString(16)}${randomPart.slice(4, 7)}-${randomPart.slice(7, 19)}`;
};
exports.generateUUIDv7 = generateUUIDv7;
/**
 * توليد باركود أعمال فريد يجمع بين التاريخ، النوع، وجزء من UUID
 */
const generateBusinessBarcode = (type) => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    // نقتطع أول 8 أحرف من UUIDv7 لضمان التفرد مع الحفاظ على قصر الكود للطباعة
    const uniqueSegment = (0, exports.generateUUIDv7)().split('-')[0].toUpperCase();
    return `${type}${year}${month}${day}-${uniqueSegment}`;
};
exports.generateBusinessBarcode = generateBusinessBarcode;
/**
 * تحويل البيانات إلى CSV للتصدير الاحترافي
 */
const exportToCSV = (data, fileName) => {
    if (data.length === 0)
        return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(val => `"${val}"`).join(',')).join('\n');
    const csvContent = "\uFEFF" + headers + '\n' + rows; // UTF-8 BOM for Arabic support in Excel
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
exports.exportToCSV = exportToCSV;
