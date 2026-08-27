import { useCallback, useEffect, useState } from 'react';
import type { Service } from '../data/services';
import type { Project } from '../data/projects';

type LoadState<T> = { data: T; loading: boolean; error: string };

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly fields?: Record<string, string>) { super(message); }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    ...init,
  });
  const body = await response.json().catch(() => ({})) as { error?: string; fields?: Record<string, string> };
  if (!response.ok) throw new ApiError(body.error ?? 'تعذر إكمال العملية.', response.status, body.fields);
  return body as T;
}

function useResource<T>(path: string, initial: T) {
  const [state, setState] = useState<LoadState<T>>({ data: initial, loading: true, error: '' });
  const reload = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const result = await api<{ data: T }>(path);
      setState({ data: result.data, loading: false, error: '' });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : 'تعذر تحميل البيانات.' }));
    }
  }, [path]);
  useEffect(() => { void reload(); }, [reload]);
  return { ...state, reload };
}

export function usePublicServices() { return useResource<Service[]>('/api/public/services', []); }
export function usePublicProjects() { return useResource<Project[]>('/api/public/projects', []); }
export function usePublicProject(slug: string) {
  const [state, setState] = useState<LoadState<Project | null> & { notFound: boolean }>({ data: null, loading: true, error: '', notFound: false });
  const reload = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '', notFound: false }));
    try {
      const result = await api<{ data: Project }>(`/api/public/projects/${encodeURIComponent(slug)}`);
      setState({ data: result.data, loading: false, error: '', notFound: false });
    } catch (error) {
      setState({ data: null, loading: false, error: error instanceof Error ? error.message : 'تعذر تحميل المشروع.', notFound: error instanceof ApiError && error.status === 404 });
    }
  }, [slug]);
  useEffect(() => { void reload(); }, [reload]);
  return { ...state, reload };
}
