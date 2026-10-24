import type {
  Besmm4Reference,
  BoqGenerateRequest,
  BoqOut,
  BoqUpdate,
  DetectResult,
  ProjectOut,
  ProjectSummary,
  RawTakeoffOut,
  RawTakeoffUpdate,
  SheetGeometry,
  SheetOut,
  SheetSummary,
  Takeoff,
} from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errMessage = `Error ${res.status}: ${res.statusText}`;
    try {
      const data = await res.json();
      if (data.detail) errMessage = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }
  return res.json();
}

export const api = {
  // Projects
  async listProjects(): Promise<ProjectSummary[]> {
    const res = await fetch(`${API_BASE}/api/projects`);
    return handleResponse<ProjectSummary[]>(res);
  },

  async createProject(data: { name: string; client?: string; location?: string }): Promise<ProjectOut> {
    const res = await fetch(`${API_BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<ProjectOut>(res);
  },

  async getProject(projectId: string): Promise<ProjectOut> {
    const res = await fetch(`${API_BASE}/api/projects/${projectId}`);
    return handleResponse<ProjectOut>(res);
  },

  async updateProject(
    projectId: string,
    data: { name?: string; client?: string; location?: string; specs?: any }
  ): Promise<ProjectOut> {
    const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<ProjectOut>(res);
  },

  async deleteProject(projectId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/projects/${projectId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete project');
  },

  async uploadDrawing(projectId: string, file: File): Promise<SheetSummary[]> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/projects/${projectId}/drawings`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<SheetSummary[]>(res);
  },

  // Sheets
  async getSheet(sheetId: string): Promise<SheetOut> {
    const res = await fetch(`${API_BASE}/api/sheets/${sheetId}`);
    return handleResponse<SheetOut>(res);
  },

  async updateSheet(
    sheetId: string,
    data: {
      name?: string;
      scale_m_per_px?: number;
      include?: boolean;
      has_substructure?: boolean;
      has_roof?: boolean;
      geometry?: SheetGeometry;
    }
  ): Promise<SheetOut> {
    const res = await fetch(`${API_BASE}/api/sheets/${sheetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<SheetOut>(res);
  },

  async calibrateSheet(
    sheetId: string,
    data: { p1: [number, number]; p2: [number, number]; real_length_m: number; label?: string }
  ): Promise<SheetOut> {
    const res = await fetch(`${API_BASE}/api/sheets/${sheetId}/calibrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<SheetOut>(res);
  },

  async detectLayout(
    sheetId: string,
    method: 'auto' | 'vector' | 'raster' | 'ai' = 'auto',
    apply = false
  ): Promise<DetectResult> {
    const res = await fetch(`${API_BASE}/api/sheets/${sheetId}/detect?apply=${apply}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method }),
    });
    return handleResponse<DetectResult>(res);
  },

  async getSheetTakeoff(sheetId: string): Promise<Takeoff> {
    const res = await fetch(`${API_BASE}/api/sheets/${sheetId}/takeoff`);
    return handleResponse<Takeoff>(res);
  },

  async getProjectTakeoff(projectId: string): Promise<Takeoff> {
    const res = await fetch(`${API_BASE}/api/projects/${projectId}/takeoff`);
    return handleResponse<Takeoff>(res);
  },

  getSheetImageUrl(sheetId: string): string {
    return `${API_BASE}/api/sheets/${sheetId}/image`;
  },

  getProjectExportUrl(projectId: string): string {
    return `${API_BASE}/api/projects/${projectId}/takeoff/export`;
  },

  // --- Phase 2: BESMM4 Bill of Quantities ---
  async getBoq(projectId: string): Promise<BoqOut> {
    const res = await fetch(`${API_BASE}/api/projects/${projectId}/boq`);
    return handleResponse<BoqOut>(res);
  },

  async updateBoq(projectId: string, data: BoqUpdate): Promise<BoqOut> {
    const res = await fetch(`${API_BASE}/api/projects/${projectId}/boq`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<BoqOut>(res);
  },

  async generateBoq(projectId: string, options: BoqGenerateRequest = {}): Promise<BoqOut> {
    const res = await fetch(`${API_BASE}/api/projects/${projectId}/boq/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    return handleResponse<BoqOut>(res);
  },

  getBoqExcelExportUrl(projectId: string): string {
    return `${API_BASE}/api/projects/${projectId}/boq/export/excel`;
  },

  getBoqHtmlExportUrl(projectId: string): string {
    return `${API_BASE}/api/projects/${projectId}/boq/export/html`;
  },

  // --- Phase 2: Raw Dimension Sheet Takeoff ---
  async getRawTakeoff(projectId: string): Promise<RawTakeoffOut> {
    const res = await fetch(`${API_BASE}/api/projects/${projectId}/raw-takeoff`);
    return handleResponse<RawTakeoffOut>(res);
  },

  async updateRawTakeoff(projectId: string, data: RawTakeoffUpdate): Promise<RawTakeoffOut> {
    const res = await fetch(`${API_BASE}/api/projects/${projectId}/raw-takeoff`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<RawTakeoffOut>(res);
  },

  async convertRawTakeoff(projectId: string): Promise<BoqOut> {
    const res = await fetch(`${API_BASE}/api/projects/${projectId}/raw-takeoff/convert`, {
      method: 'POST',
    });
    return handleResponse<BoqOut>(res);
  },

  // --- NIQS BESMM4 Reference & PDF Viewer ---
  getBesmm4PdfUrl(page?: number): string {
    return page ? `${API_BASE}/api/besmm4/pdf#page=${page}` : `${API_BASE}/api/besmm4/pdf`;
  },

  async getBesmm4Reference(code?: string): Promise<Besmm4Reference> {
    const query = code ? `?code=${encodeURIComponent(code)}` : '';
    const res = await fetch(`${API_BASE}/api/besmm4/reference${query}`);
    return handleResponse<Besmm4Reference>(res);
  },
};

