export class ApiError extends Error {
  constructor(
    public message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Recursively parses and extracts readable validation error messages from various API error formats:
 * - Array of { field, message } or { path, msg } or strings
 * - Zod structured errors { _errors: [], fieldName: { _errors: [] } }
 * - Key-value map of { fieldName: "Error message" }
 */
export function formatErrorDetails(details: unknown): string | null {
  if (!details) return null;

  // 1. Array of error items
  if (Array.isArray(details)) {
    const messages: string[] = [];
    for (const item of details) {
      if (typeof item === 'string' && item.trim()) {
        messages.push(item.trim());
      } else if (item && typeof item === 'object') {
        const msg = (item as any).message || (item as any).msg || (item as any).error;
        if (typeof msg === 'string' && msg.trim()) {
          messages.push(msg.trim());
        } else if (Array.isArray((item as any).messages)) {
          messages.push(...(item as any).messages.filter((m: unknown) => typeof m === 'string' && m.trim()));
        } else if (Array.isArray((item as any)._errors)) {
          messages.push(...(item as any)._errors.filter((m: unknown) => typeof m === 'string' && m.trim()));
        }
      }
    }

    if (messages.length === 0) return null;
    if (messages.length === 1) return messages[0];
    const unique = Array.from(new Set(messages));
    return unique.map((m) => `• ${m}`).join('\n');
  }

  // 2. Object with fields / Zod formatted errors
  if (typeof details === 'object' && details !== null) {
    const messages: string[] = [];

    const traverse = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;

      if (Array.isArray(obj)) {
        for (const v of obj) {
          if (typeof v === 'string' && v.trim()) {
            messages.push(v.trim());
          } else if (v && typeof v === 'object') {
            const msg = v.message || v.msg || v.error;
            if (typeof msg === 'string' && msg.trim()) {
              messages.push(msg.trim());
            } else {
              traverse(v);
            }
          }
        }
        return;
      }

      for (const [key, value] of Object.entries(obj)) {
        if (key === '_errors' && Array.isArray(value)) {
          for (const err of value) {
            if (typeof err === 'string' && err.trim()) messages.push(err.trim());
          }
        } else if (typeof value === 'string' && value.trim()) {
          messages.push(value.trim());
        } else if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === 'string' && item.trim()) {
              messages.push(item.trim());
            } else if (item && typeof item === 'object') {
              const msg = (item as any).message || (item as any).msg || (item as any).error;
              if (typeof msg === 'string' && msg.trim()) {
                messages.push(msg.trim());
              } else {
                traverse(item);
              }
            }
          }
        } else if (value && typeof value === 'object') {
          traverse(value);
        }
      }
    };

    traverse(details);
    if (messages.length === 0) return null;
    if (messages.length === 1) return messages[0];
    const unique = Array.from(new Set(messages));
    return unique.map((m) => `• ${m}`).join('\n');
  }

  if (typeof details === 'string' && details.trim()) {
    return details.trim();
  }

  return null;
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, body, ...customConfig } = options;

  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const defaultHeaders: HeadersInit = isFormData
    ? {}
    : {
        'Content-Type': 'application/json',
      };

  const config: RequestInit = {
    method: options.method || 'GET',
    headers: {
      ...defaultHeaders,
      ...headers,
    },
    credentials: 'include',
    body: isFormData ? body : body && typeof body === 'object' ? JSON.stringify(body) : body,
    ...customConfig,
  };

  const response = await fetch(url, config);

  if (response.status === 204) {
    return {} as T;
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const rawDetails = data?.error?.details ?? data?.details ?? data?.error?.issues ?? data?.issues ?? data?.errors;
    const formattedDetails = formatErrorDetails(rawDetails);

    let errorMessage = data?.error?.message || data?.message;
    const isGenericValidation =
      !errorMessage ||
      errorMessage === 'Validation failed' ||
      errorMessage === 'Validation Error' ||
      errorMessage === 'Invalid request body' ||
      errorMessage === 'Invalid request payload';

    if (isGenericValidation && formattedDetails) {
      errorMessage = formattedDetails;
    } else if (formattedDetails && !errorMessage?.includes(formattedDetails)) {
      errorMessage = `${errorMessage}\n${formattedDetails}`;
    } else if (!errorMessage) {
      errorMessage = `HTTP ${response.status}: Request failed`;
    }

    throw new ApiError(errorMessage, response.status, rawDetails || data);
  }

  return data?.data !== undefined ? data.data : (data as T);
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) => request<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'POST', body: body as any }),
  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PUT', body: body as any }),
  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PATCH', body: body as any }),
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),

  downloadBlob: async (endpoint: string, filename: string, options?: RequestOptions): Promise<void> => {
    let url = endpoint;
    if (options?.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }

    const response = await fetch(url, {
      credentials: 'include',
      headers: options?.headers,
    });

    if (!response.ok) {
      throw new ApiError(`Download failed (HTTP ${response.status})`, response.status);
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);
  },
};
