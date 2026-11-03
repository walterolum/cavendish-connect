export type ReportTargetType = 'LISTING' | 'SERVICE' | 'ACCOMMODATION' | 'USER' | 'REVIEW';

export type ReportReason =
  | 'SCAM'
  | 'FRAUD'
  | 'FAKE_PRODUCT'
  | 'FAKE_ACCOMMODATION'
  | 'INAPPROPRIATE_CONTENT'
  | 'HARASSMENT'
  | 'DUPLICATE_LISTING'
  | 'WRONG_INFORMATION'
  | 'OTHER';

export type ReportStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export interface Report {
  id: number;
  reporterId: number;
  targetType: ReportTargetType;
  targetId: number;
  reason: ReportReason;
  description?: string | null;
  status: ReportStatus;
  reviewedBy?: number | null;
  reviewedAt?: string | null;
  resolution?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type VerificationType = 'STUDENT' | 'SERVICE_PROVIDER' | 'LANDLORD' | 'BUSINESS';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

export interface VerificationRequest {
  id: number;
  userId: number;
  type: VerificationType;
  status: VerificationStatus;
  documentUrl?: string | null;
  notes?: string | null;
  reviewedBy?: number | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}