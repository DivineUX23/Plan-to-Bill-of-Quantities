import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Toolbar } from '../components/Toolbar';
import { CanvasEditor } from '../components/CanvasEditor';
import { RightSidebar } from '../components/RightSidebar';
import { CalibrateModal } from '../components/CalibrateModal';
import { SpecsModal } from '../components/SpecsModal';
import { api } from '../api/client';
import type { ProjectOut, SheetSummary } from '../api/types';
import { useEditorStore } from '../store/editorStore';
import { UploadCloud } from 'lucide-react';

export const TakeoffPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectOut | null>(null);
  const [currentSheetSummary, setCurrentSheetSummary] = useState<SheetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSpecsModal, setShowSpecsModal] = useState(false);
  const [uploadingSheet, setUploadingSheet] = useState(false);

  const { setSheet, setSheetTakeoff } = useEditorStore();

  const loadProject = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const proj = await api.getProject(projectId);
      setProject(proj);
      if (proj.sheets.length > 0) {
        const firstSheet = proj.sheets[0];
        setCurrentSheetSummary(firstSheet);
        await loadSheet(firstSheet.id);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Failed to load project: ${err.message}`);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadSheet = async (sheetId: string) => {
    try {
      const s = await api.getSheet(sheetId);
      setSheet(s);
      // Fetch live sheet takeoff
      try {
        const t = await api.getSheetTakeoff(sheetId);
        setSheetTakeoff(t);
      } catch (err) {
        console.warn('Takeoff compute notice:', err);
      }
    } catch (err: any) {
      console.error('Failed to load sheet:', err);
    }
  };

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const handleSelectSheet = (sheetId: string) => {
    if (!project) return;
    const summary = project.sheets.find((s) => s.id === sheetId);
    if (summary) {
      setCurrentSheetSummary(summary);
      loadSheet(sheetId);
    }
  };

  const handleUploadNewDrawing = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!project || !e.target.files || !e.target.files[0]) return;
    try {
      setUploadingSheet(true);
      const newSheets = await api.uploadDrawing(project.id, e.target.files[0]);
      const updatedProj = await api.getProject(project.id);
      setProject(updatedProj);
      if (newSheets.length > 0) {
        handleSelectSheet(newSheets[0].id);
      }
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setUploadingSheet(false);
    }
  };

  if (loading || !project) {
    return (
      <div style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0F172A',
        color: '#F8FAFC',
        fontSize: '15px',
      }}>
        Loading AutoPlan Taking-off Studio...
      </div>
    );
  }

  // If no sheets uploaded yet
  if (project.sheets.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Navbar
          project={project}
          currentSheet={null}
          onSelectSheet={() => {}}
          onOpenSpecs={() => setShowSpecsModal(true)}
        />
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-app)',
          padding: '20px',
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            backgroundColor: '#FFFFFF',
            border: '2px dashed var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            padding: '40px 24px',
            textAlign: 'center',
          }}>
            <UploadCloud size={48} color="var(--primary)" style={{ margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Upload Floor Plan Drawing</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Upload your architectural drawing (PDF or high-res image) to start measuring walls and rooms.
            </p>
            <input
              type="file"
              id="empty-sheet-upload"
              accept=".pdf,image/png,image/jpeg"
              style={{ display: 'none' }}
              onChange={handleUploadNewDrawing}
            />
            <button
              className="btn btn-primary"
              disabled={uploadingSheet}
              onClick={() => document.getElementById('empty-sheet-upload')?.click()}
            >
              {uploadingSheet ? 'Rendering Drawing Pages...' : 'Select PDF / Image File'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Navbar
        project={project}
        currentSheet={currentSheetSummary}
        onSelectSheet={handleSelectSheet}
        onOpenSpecs={() => setShowSpecsModal(true)}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <Toolbar />
        <CanvasEditor />
        <RightSidebar specs={project.specs} />
      </div>

      <CalibrateModal />

      <SpecsModal
        project={project}
        isOpen={showSpecsModal}
        onClose={() => setShowSpecsModal(false)}
        onSaved={(updated) => setProject(updated)}
      />
    </div>
  );
};
