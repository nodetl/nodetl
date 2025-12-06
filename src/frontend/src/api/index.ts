import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { 
  Workflow, 
  NodeType, 
  Schema, 
  Execution, 
  FieldMapping,
  AIMappingResponse 
} from '@/types';
import type { User, TokenPair, LoginResponse, AppSettings, ThemePreference } from '@/stores/authStore';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token refresh flag to prevent multiple refresh calls
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from localStorage (zustand persist)
    const authData = localStorage.getItem('nodetl-auth');
    if (authData) {
      try {
        const { state } = JSON.parse(authData);
        if (state.accessToken) {
          config.headers.Authorization = `Bearer ${state.accessToken}`;
        }
      } catch {
        // Ignore parse errors
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // If error is 401 and we haven't tried refreshing yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for token refresh
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Get refresh token from localStorage
        const authData = localStorage.getItem('nodetl-auth');
        if (!authData) {
          throw new Error('No auth data');
        }

        const { state } = JSON.parse(authData);
        if (!state.refreshToken) {
          throw new Error('No refresh token');
        }

        // Refresh tokens
        const { data } = await axios.post<{ tokens: TokenPair }>('/api/v1/auth/refresh', {
          refreshToken: state.refreshToken,
        });

        // Update stored tokens
        const newAuthData = {
          state: {
            ...state,
            accessToken: data.tokens.accessToken,
            refreshToken: data.tokens.refreshToken,
          },
          version: 0,
        };
        localStorage.setItem('nodetl-auth', JSON.stringify(newAuthData));

        isRefreshing = false;
        onTokenRefreshed(data.tokens.accessToken);

        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${data.tokens.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        // Clear auth data and redirect to login
        localStorage.removeItem('nodetl-auth');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdatePreferencesRequest {
  themePreference?: ThemePreference;
}

export interface InvitationRequest {
  email: string;
  name?: string;
  roleId: string;
}

export interface AcceptInvitationRequest {
  token: string;
  password: string;
  name?: string;
}

export interface Permission {
  resource: string;
  actions: string[];
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  createdAt: string;
  link?: string;
}

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
    return data;
  },

  refresh: async (refreshToken: string) => {
    const { data } = await api.post<{ tokens: TokenPair }>('/auth/refresh', { refreshToken });
    return data;
  },

  logout: async () => {
    await api.post('/auth/logout');
  },

  getMe: async () => {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  updatePreferences: async (prefs: UpdatePreferencesRequest) => {
    const { data } = await api.put<User>('/auth/preferences', prefs);
    return data;
  },

  changePassword: async (req: ChangePasswordRequest) => {
    await api.put('/auth/password', req);
  },

  getOAuthProviders: async () => {
    const { data } = await api.get<{ providers: string[] }>('/auth/providers');
    return data;
  },
};

// Settings API (public)
export const settingsApi = {
  getPublic: async () => {
    const { data } = await api.get<AppSettings>('/settings');
    return data;
  },

  getFull: async () => {
    const { data } = await api.get<AppSettings>('/settings/full');
    return data;
  },

  update: async (settings: Partial<AppSettings>) => {
    const { data } = await api.put<AppSettings>('/settings', settings);
    return data;
  },
};

// Users API
export const usersApi = {
  list: async (params?: { page?: number; pageSize?: number; status?: string; roleId?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params?.status) searchParams.set('status', params.status);
    if (params?.roleId) searchParams.set('roleId', params.roleId);
    
    const { data } = await api.get<{ data: User[]; total: number; page: number }>(`/users?${searchParams}`);
    return data;
  },

  get: async (id: string) => {
    const { data } = await api.get<User>(`/users/${id}`);
    return data;
  },

  update: async (id: string, user: Partial<User>) => {
    const { data } = await api.put<User>(`/users/${id}`, user);
    return data;
  },

  delete: async (id: string) => {
    await api.delete(`/users/${id}`);
  },
};

// Roles API
export const rolesApi = {
  list: async () => {
    const { data } = await api.get<{ data: Role[] }>('/roles');
    return data;
  },

  get: async (id: string) => {
    const { data } = await api.get<Role>(`/roles/${id}`);
    return data;
  },

  create: async (role: { name: string; description: string; permissions: Permission[] }) => {
    const { data } = await api.post<Role>('/roles', role);
    return data;
  },

  update: async (id: string, role: Partial<{ name: string; description: string; permissions: Permission[] }>) => {
    const { data } = await api.put<Role>(`/roles/${id}`, role);
    return data;
  },

  delete: async (id: string) => {
    await api.delete(`/roles/${id}`);
  },

  getPermissions: async () => {
    const { data } = await api.get<{ permissions: string[]; grouped: Record<string, string[]> }>('/roles/permissions');
    return data;
  },
};

// Invitations API
export const invitationsApi = {
  list: async (params?: { page?: number; pageSize?: number; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params?.status) searchParams.set('status', params.status);
    
    const { data } = await api.get<{ data: Invitation[]; total: number; page: number }>(`/invitations?${searchParams}`);
    return data;
  },

  get: async (id: string) => {
    const { data } = await api.get<Invitation>(`/invitations/${id}`);
    return data;
  },

  create: async (invitation: InvitationRequest, sendEmail = true) => {
    const { data } = await api.post<Invitation>(`/invitations?sendEmail=${sendEmail}`, invitation);
    return data;
  },

  revoke: async (id: string) => {
    await api.delete(`/invitations/${id}`);
  },

  resend: async (id: string) => {
    const { data } = await api.post<{ message: string; link: string }>(`/invitations/${id}/resend`);
    return data;
  },

  accept: async (token: string, password: string, name?: string) => {
    const { data } = await api.post<{ message: string; user: User }>('/invitations/accept', { token, password, name });
    return data;
  },

  validate: async (token: string) => {
    const { data } = await api.get<{ valid: boolean; message: string }>(`/invitations/validate?token=${token}`);
    return data;
  },
};

// Workflows API
export const workflowsApi = {
  list: async () => {
    const { data } = await api.get<{ data: Workflow[]; total: number }>('/workflows');
    return data;
  },
  
  get: async (id: string) => {
    const { data } = await api.get<Workflow>(`/workflows/${id}`);
    return data;
  },
  
  create: async (workflow: Partial<Workflow>) => {
    const { data } = await api.post<Workflow>('/workflows', workflow);
    return data;
  },
  
  update: async (id: string, workflow: Partial<Workflow>) => {
    const { data } = await api.put<Workflow>(`/workflows/${id}`, workflow);
    return data;
  },
  
  // Lightweight partial update for auto-save (only nodes/edges)
  patch: async (id: string, updates: { nodes?: any[]; edges?: any[] }) => {
    const { data } = await api.post<{ id: string; success: boolean }>(`/workflows/${id}/autosave`, updates);
    return data;
  },
  
  delete: async (id: string) => {
    await api.delete(`/workflows/${id}`);
  },
  
  activate: async (id: string) => {
    const { data } = await api.post<Workflow>(`/workflows/${id}/activate`);
    return data;
  },
  
  deactivate: async (id: string) => {
    const { data } = await api.post<Workflow>(`/workflows/${id}/deactivate`);
    return data;
  },
  
  execute: async (id: string, input: Record<string, unknown> = {}) => {
    const { data } = await api.post(`/workflows/${id}/execute`, { input });
    return data;
  },
};

// Schemas API
export const schemasApi = {
  list: async (type?: string, category?: string) => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (category) params.set('category', category);
    const { data } = await api.get<{ data: Schema[]; total: number }>(`/schemas?${params}`);
    return data;
  },
  
  get: async (id: string) => {
    const { data } = await api.get<Schema>(`/schemas/${id}`);
    return data;
  },
  
  create: async (schema: Partial<Schema>) => {
    const { data } = await api.post<Schema>('/schemas', schema);
    return data;
  },
  
  update: async (id: string, schema: Partial<Schema>) => {
    const { data } = await api.put<Schema>(`/schemas/${id}`, schema);
    return data;
  },
  
  delete: async (id: string) => {
    await api.delete(`/schemas/${id}`);
  },
  
  getPredefined: async () => {
    const { data } = await api.get<Schema[]>('/schemas/predefined');
    return data;
  },
};

// Node Types API
export const nodeTypesApi = {
  list: async (category?: string, builtIn?: boolean) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (builtIn !== undefined) params.set('builtIn', String(builtIn));
    const { data } = await api.get<NodeType[]>(`/node-types?${params}`);
    return data;
  },
  
  getBuiltIn: async () => {
    const { data } = await api.get<NodeType[]>('/node-types/built-in');
    return data;
  },
  
  createCustom: async (nodeType: Partial<NodeType>) => {
    const { data } = await api.post<NodeType>('/node-types', nodeType);
    return data;
  },
};

// Mappings API
export const mappingsApi = {
  suggest: async (
    sourceSchemaId: string, 
    targetSchemaId: string, 
    sampleData?: Record<string, unknown>,
    instructions?: string
  ) => {
    const { data } = await api.post<AIMappingResponse>('/mappings/suggest', {
      sourceSchemaId,
      targetSchemaId,
      sampleData,
      instructions,
    });
    return data;
  },
  
  list: async () => {
    const { data } = await api.get<{ data: FieldMapping[]; total: number }>('/mappings');
    return data;
  },
  
  get: async (id: string) => {
    const { data } = await api.get<FieldMapping>(`/mappings/${id}`);
    return data;
  },
  
  save: async (mapping: Partial<FieldMapping>) => {
    const { data } = await api.post<FieldMapping>('/mappings', mapping);
    return data;
  },
  
  update: async (id: string, mapping: Partial<FieldMapping>) => {
    const { data } = await api.put<FieldMapping>(`/mappings/${id}`, mapping);
    return data;
  },
  
  delete: async (id: string) => {
    await api.delete(`/mappings/${id}`);
  },
};

// Executions API
export const executionsApi = {
  get: async (id: string) => {
    const { data } = await api.get<Execution>(`/executions/${id}`);
    return data;
  },
  
  listByWorkflow: async (workflowId: string) => {
    const { data } = await api.get<{ data: Execution[]; total: number }>(
      `/workflows/${workflowId}/executions`
    );
    return data;
  },
  
  getLatest: async (workflowId: string) => {
    const { data } = await api.get<Execution[]>(
      `/workflows/${workflowId}/executions/latest`
    );
    return data;
  },
};

// Node Schemas API - for transform node configurations
export interface ImportedSchema {
  id: string;
  name: string;
  fields: Array<{
    name: string;
    type: string;
    path?: string;
    description?: string;
    required?: boolean;
    children?: ImportedSchema['fields'];
  }>;
}

export interface NodeSchemaData {
  id?: string;
  workflowId: string;
  nodeId: string;
  sourceSchema?: ImportedSchema | null;
  targetSchema?: ImportedSchema | null;
  connections?: Array<{
    id: string;
    sourceField: string;
    targetField: string;
    formula: string;
    transformType: string;
    color: string;
    sourceType?: string;
    config?: Record<string, unknown>;
    validation?: Array<{
      id: string;
      type: string;
      value?: string | number;
      message: string;
      enabled: boolean;
    }>;
  }>;
  headerFields?: Array<{
    id: string;
    name: string;
    value: string;
    type: string;
    path: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export const nodeSchemaApi = {
  get: async (workflowId: string, nodeId: string) => {
    const { data } = await api.get<NodeSchemaData>(`/workflows/${workflowId}/nodes/${nodeId}/schema`);
    return data;
  },
  
  save: async (workflowId: string, nodeId: string, schemaData: Partial<NodeSchemaData>) => {
    const { data } = await api.put<NodeSchemaData>(`/workflows/${workflowId}/nodes/${nodeId}/schema`, schemaData);
    return data;
  },
  
  delete: async (workflowId: string, nodeId: string) => {
    await api.delete(`/workflows/${workflowId}/nodes/${nodeId}/schema`);
  },
  
  clearSource: async (workflowId: string, nodeId: string) => {
    const { data } = await api.delete<NodeSchemaData>(`/workflows/${workflowId}/nodes/${nodeId}/schema/source`);
    return data;
  },
  
  clearTarget: async (workflowId: string, nodeId: string) => {
    const { data } = await api.delete<NodeSchemaData>(`/workflows/${workflowId}/nodes/${nodeId}/schema/target`);
    return data;
  },
  
  listByWorkflow: async (workflowId: string) => {
    const { data } = await api.get<NodeSchemaData[]>(`/workflows/${workflowId}/nodes/schemas`);
    return data;
  },
};

// AI API
export interface AIStatusResponse {
  enabled: boolean;
  message: string;
}

export interface GenerateTestDataRequest {
  sourceSchema: Record<string, unknown>;
  description?: string;
  count?: number;
}

export interface GenerateTestDataResponse {
  testData: Record<string, unknown>[];
  description: string;
}

export const aiApi = {
  getStatus: async () => {
    const { data } = await api.get<AIStatusResponse>('/ai/status');
    return data;
  },

  generateTestData: async (req: GenerateTestDataRequest) => {
    const { data } = await api.post<GenerateTestDataResponse>('/ai/generate-test-data', req);
    return data;
  },
};

// Versions API
import type { Version, Project, ProjectListResponse } from '@/types';

export const versionsApi = {
  list: async () => {
    const { data } = await api.get<{ data: Version[] }>('/versions');
    return data;
  },
  
  get: async (id: string) => {
    const { data } = await api.get<Version>(`/versions/${id}`);
    return data;
  },
  
  create: async (version: Partial<Version>) => {
    const { data } = await api.post<Version>('/versions', version);
    return data;
  },
  
  update: async (id: string, version: Partial<Version>) => {
    const { data } = await api.put<Version>(`/versions/${id}`, version);
    return data;
  },
  
  delete: async (id: string) => {
    await api.delete(`/versions/${id}`);
  },
  
  setDefault: async (id: string) => {
    const { data } = await api.post(`/versions/${id}/set-default`);
    return data;
  },
};

// Projects API
export const projectsApi = {
  list: async (page = 1, pageSize = 10) => {
    const { data } = await api.get<ProjectListResponse>(`/projects?page=${page}&pageSize=${pageSize}`);
    return data;
  },
  
  get: async (id: string) => {
    const { data } = await api.get<Project>(`/projects/${id}`);
    return data;
  },
  
  create: async (project: Partial<Project>) => {
    const { data } = await api.post<Project>('/projects', project);
    return data;
  },
  
  update: async (id: string, project: Partial<Project>) => {
    const { data } = await api.put<Project>(`/projects/${id}`, project);
    return data;
  },
  
  delete: async (id: string) => {
    await api.delete(`/projects/${id}`);
  },
  
  addWorkflow: async (projectId: string, workflowId: string) => {
    const { data } = await api.post<Project>(`/projects/${projectId}/workflows/${workflowId}`);
    return data;
  },
  
  removeWorkflow: async (projectId: string, workflowId: string) => {
    const { data } = await api.delete<Project>(`/projects/${projectId}/workflows/${workflowId}`);
    return data;
  },
};

export default api;
