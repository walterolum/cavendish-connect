import { api } from '../lib/api';
import { Report, ReportReason, ReportTargetType } from '../types/moderation';

export interface CreateReportInput {
  targetType: ReportTargetType;
  targetId: number;
  reason: ReportReason;
  description?: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SCAM: 'Scam / fraud',
  FRAUD: 'Fraud',
  FAKE_PRODUCT: 'Fake product',
  FAKE_ACCOMMODATION: 'Fake accommodation',
  INAPPROPRIATE_CONTENT: 'Inappropriate content',
  HARASSMENT: 'Harassment',
  DUPLICATE_LISTING: 'Duplicate listing',
  WRONG_INFORMATION: 'Wrong information',
  OTHER: 'Other',
};

class ReportsService {
  async submitReport(input: CreateReportInput): Promise<Report> {
    const res = await api.post<ApiEnvelope<Report>>('/reports', input);
    return res.data.data!;
  }

  async getMyReports(): Promise<Report[]> {
    const res = await api.get<ApiEnvelope<Report[]>>('/reports');
    return res.data.data!;
  }
}

export const reportsApi = new ReportsService();