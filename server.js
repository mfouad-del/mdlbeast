const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(bodyParser.json());

/**
 * محاكاة قاعدة البيانات المؤسسية
 */
let db = {
  companies: [
    { id: 'c1', nameAr: 'شركة زوايا البناء للإستشارات الهندسية', nameEn: 'ZAWAYA ALBINA ENGINEERING', logoUrl: 'https://i.ibb.co/Xf7Y4wQ/zawaya-logo.png' }
  ],
  users: [
    { id: 'u1', name: 'المدير العام', email: 'admin@zaco.sa', password: 'admin123', role: 'ADMIN', createdAt: new Date().toISOString() }
  ],
  correspondence: [],
  auditLogs: []
};

// --- نظام تتبع النشاط (Audit Log) ---
const logAction = (action, user) => {
  db.auditLogs.unshift({
    id: uuidv4(),
    action,
    user: user || 'النظام',
    timestamp: new Date().toISOString()
  });
};

// --- مسارات الشركات (Companies CRUD) ---
app.get('/api/companies', (req, res) => res.json(db.companies));
app.post('/api/companies', (req, res) => {
  const company = { id: uuidv4(), ...req.body };
  db.companies.push(company);
  logAction(`إضافة شركة جديدة: ${company.nameAr}`, 'المدير');
  res.status(201).json(company);
});
app.put('/api/companies/:id', (req, res) => {
  const index = db.companies.findIndex(c => c.id === req.params.id);
  if (index !== -1) {
    db.companies[index] = { ...db.companies[index], ...req.body };
    res.json(db.companies[index]);
  } else res.status(404).send();
});
app.delete('/api/companies/:id', (req, res) => {
  db.companies = db.companies.filter(c => c.id !== req.params.id);
  logAction(`حذف شركة رقم: ${req.params.id}`, 'المدير');
  res.sendStatus(204);
});

// --- مسارات المستخدمين (Users CRUD) ---
app.get('/api/users', (req, res) => res.json(db.users));
app.post('/api/users', (req, res) => {
  const user = { id: uuidv4(), createdAt: new Date().toISOString(), ...req.body };
  db.users.push(user);
  logAction(`إضافة مستخدم: ${user.name}`, 'المدير');
  res.status(201).json(user);
});
app.delete('/api/users/:id', (req, res) => {
  db.users = db.users.filter(u => u.id !== req.params.id);
  res.sendStatus(204);
});

// --- مسارات المراسلات (Correspondence) ---
app.get('/api/correspondence', (req, res) => {
  const { companyId } = req.query;
  const filtered = db.correspondence.filter(d => d.companyId === companyId);
  res.json(filtered);
});

app.post('/api/correspondence', (req, res) => {
  const entry = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...req.body
  };
  db.correspondence.unshift(entry);
  logAction(`تسجيل معاملة: ${entry.barcodeId}`, entry.createdBy);
  res.status(201).json(entry);
});

// --- تشغيل السيرفر ---
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`🚀 ArchivX Enterprise Backend Running`);
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`========================================`);
});
