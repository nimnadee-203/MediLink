import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, minlength: 6 },
    clerkUserId: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ['admin'], default: 'admin' },
    phone: { type: String, trim: true },
    age: { type: Number },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    address: { type: String, trim: true },
    reports: [reportSchema]
  },
  { timestamps: true }
);

const adminDb = mongoose.connection.useDb(process.env.ADMIN_DB_NAME || 'admin_1', { useCache: true });
const adminCollectionName = process.env.ADMIN_COLLECTION_NAME || 'admin';

const Admin = adminDb.models.Admin || adminDb.model('Admin', adminSchema, adminCollectionName);

export default Admin;
