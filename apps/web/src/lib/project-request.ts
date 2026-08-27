export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';
export type PreferredChannel = 'البريد الإلكتروني' | 'الهاتف' | 'واتساب' | '';

export type ProjectRequest = {
  name: string;
  businessName: string;
  projectType: string;
  idea: string;
  preferredContactMethod: PreferredChannel;
  contactDetails: string;
  website?: string;
};

/** The persistent lead contract that Turn 2 will store and manage. */
export type ProjectLead = {
  id: string;
  name: string;
  businessName: string;
  projectType: string;
  idea: string;
  preferredChannel: Exclude<PreferredChannel, ''>;
  contactValue: string;
  status: LeadStatus;
  source: 'public-website';
  createdAt: string;
  updatedAt: string;
};

export type ProjectRequestResponse = { requestId: string };

export class RequestDestinationUnavailableError extends Error {
  constructor() {
    super('لم تُهيّأ بعد وجهة آمنة لاستقبال طلبات المشاريع.');
  }
}

export function validateProjectRequest(request: ProjectRequest) {
  const errors: Partial<Record<keyof ProjectRequest, string>> = {};
  if (!request.name.trim()) errors.name = 'أدخل الاسم.';
  if (!request.businessName.trim()) errors.businessName = 'أدخل اسم النشاط.';
  if (!request.projectType) errors.projectType = 'اختر نوع المشروع.';
  if (request.idea.trim().length < 12) errors.idea = 'اكتب وصفًا موجزًا لا يقل عن 12 حرفًا.';
  if (!request.preferredContactMethod) errors.preferredContactMethod = 'اختر وسيلة التواصل المفضلة.';
  if (!request.contactDetails.trim()) errors.contactDetails = 'أدخل بيانات التواصل.';
  if (request.preferredContactMethod === 'البريد الإلكتروني' && request.contactDetails && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.contactDetails.trim())) errors.contactDetails = 'أدخل بريدًا إلكترونيًا صالحًا.';
  if (request.preferredContactMethod && request.preferredContactMethod !== 'البريد الإلكتروني' && request.contactDetails.replace(/\D/g, '').length < 7) errors.contactDetails = 'أدخل رقم تواصل صالحًا.';
  return errors;
}

export async function submitProjectRequest(request: ProjectRequest): Promise<ProjectRequestResponse> {
  if (request.website) throw new Error('تعذر إرسال الطلب.');
  const endpoint = import.meta.env.VITE_PROJECT_REQUEST_ENDPOINT?.trim() || '/api/public/leads';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('تعذر تأكيد استلام الطلب. حاول مرة أخرى لاحقًا.');
  const result = (await response.json()) as Partial<ProjectRequestResponse>;
  if (!result.requestId) throw new Error('لم تؤكد وجهة الاستقبال رقم الطلب. لم يتم عرض رسالة نجاح.');
  return { requestId: result.requestId };
}
