export class ValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super('البيانات المدخلة غير صالحة.');
  }
}

export const serviceStatuses = ['active', 'draft', 'archived'] as const;
export const projectStatuses = ['live', 'concept', 'demo', 'internal'] as const;
export const projectCategories = ['business-websites', 'stores', 'dashboards', 'custom-systems', 'integrations'] as const;
export const leadStatuses = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'] as const;
export const serviceIcons = ['globe', 'store', 'dashboard', 'custom', 'integration'] as const;

export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function text(value: unknown, field: string, min = 1, max = 5000) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new ValidationError({ [field]: `يجب أن يحتوي الحقل على ${min} إلى ${max} حرفًا.` });
  }
  return value.trim();
}

export function optionalText(value: unknown, max = 5000) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > max) throw new ValidationError({ value: 'القيمة النصية غير صالحة.' });
  return value.trim();
}

export function slug(value: unknown) {
  const result = text(value, 'slug', 2, 120).toLowerCase();
  if (!slugPattern.test(result)) throw new ValidationError({ slug: 'استخدم حروفًا إنجليزية صغيرة وأرقامًا وشرطات فقط.' });
  return result;
}

export function enumValue<T extends readonly string[]>(value: unknown, values: T, field: string): T[number] {
  if (typeof value !== 'string' || !values.includes(value)) throw new ValidationError({ [field]: 'القيمة المختارة غير صالحة.' });
  return value as T[number];
}

export function booleanValue(value: unknown) {
  return value === true || value === 1;
}

export function integer(value: unknown, field: string, min = 0, max = 1_000_000) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new ValidationError({ [field]: 'القيمة الرقمية غير صالحة.' });
  return number;
}

export function stringArray(value: unknown, field: string, maxItems = 30) {
  if (!Array.isArray(value) || value.length > maxItems || value.some((item) => typeof item !== 'string' || item.trim().length > 300)) {
    throw new ValidationError({ [field]: 'القائمة غير صالحة.' });
  }
  return value.map((item) => (item as string).trim()).filter(Boolean);
}

export function safeUrl(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') return null;
  const candidate = text(value, field, 1, 2048);
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    return parsed.toString();
  } catch {
    throw new ValidationError({ [field]: 'الرابط غير صالح.' });
  }
}
