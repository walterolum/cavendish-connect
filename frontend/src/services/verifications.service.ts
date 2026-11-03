import { api } from '../lib/api';
import { VerificationRequest, VerificationType } from '../types/moderation';

export interface SubmitVerificationInput {
  type: VerificationType;
  notes?: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export const VERIFICATION_TYPE_LABELS: Record<VerificationType, string> = {
  STUDENT: 'Student',
  SERVICE_PROVIDER: 'Service provider',
  LANDLORD: 'Landlord',
  BUSINESS: 'Business',
};

class VerificationsService {
  async submitRequest(input: SubmitVerificationInput): Promise<VerificationRequest> {
    const res = await api.post<ApiEnvelope<VerificationRequest>>('/verifications', input);
    return res.data.data!;
  }

  async getMyRequests(): Promise<VerificationRequest[]> {
    const res = await api.get<ApiEnvelope<VerificationRequest[]>>('/verifications/me');
    return res.data.data!;
  }
}

export const verificationsApi = new VerificationsService();