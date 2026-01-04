const { processArabicText } = require('./src/lib/arabic-utils');

const text = "نوعية المرفقات: 1 اسطوانة";
console.log(`Original: ${text}`);
const processed = processArabicText(text);
console.log(`Processed: ${processed}`);

const text2 = "زوايا البناء للإستشارات الهندسيه";
console.log(`Original: ${text2}`);
const processed2 = processArabicText(text2);
console.log(`Processed: ${processed2}`);
