import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    patientEmail: { type: String, lowercase: true, trim: true },
    patientName: { type: String, trim: true },
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
    legacyReportId: { type: String, trim: true }
  },
  { timestamps: true }
);

reportSchema.index({ patientId: 1, uploadedAt: -1 });
reportSchema.index(
  { patientId: 1, legacyReportId: 1 },
  {
    unique: true,
    partialFilterExpression: { legacyReportId: { $exists: true, $type: 'string' } }
  }
);

const reportDb = mongoose.connection.useDb(process.env.REPORT_DB_NAME || 'Reports', { useCache: true });
const reportCollectionName = process.env.REPORT_COLLECTION_NAME || 'reports';

const Report = reportDb.models.Report || reportDb.model('Report', reportSchema, reportCollectionName);

export default Report;