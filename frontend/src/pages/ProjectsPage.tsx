import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderPlus,
  FileText,
  UploadCloud,
  Trash2,
  ArrowRight,
  Layers,
  MapPin,
  User,
  Sparkles,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../api/client';
import type { ProjectSummary } from '../api/types';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // New Project Modal State
  const [showModal, setShowModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await api.listProjects();
      setProjects(data);
    } catch (err: any) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      alert('Project name is required');
      return;
    }

    try {
      setCreating(true);
      const newProj = await api.createProject({
        name: projectName.trim(),
        client: clientName.trim() || undefined,
        location: locationName.trim() || undefined,
      });

      if (selectedFile) {
        await api.uploadDrawing(newProj.id, selectedFile);
      }

      setShowModal(false);
      setProjectName('');
      setClientName('');
      setLocationName('');
      setSelectedFile(null);
      navigate(`/projects/${newProj.id}`);
    } catch (err: any) {
      alert(`Error creating project: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete project "${name}"?`)) return;
    try {
      await api.deleteProject(id);
      loadProjects();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  return (
    <div style={{ minHeight: '100%', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <header style={{
        backgroundColor: '#0F172A',
        color: '#FFFFFF',
        padding: '24px 40px',
        borderBottom: '1px solid #1E293B',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #2563EB 0%, #0D9488 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
          }}>
            <Sparkles size={22} color="#FFFFFF" />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: '#F8FAFC' }}>
              PlanToBOQ
            </h1>
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>
              Production Architectural Taking-Off & Measurement Engine
            </p>
          </div>
        </div>

        <button
          className="btn btn-primary btn-lg"
          onClick={() => setShowModal(true)}
          style={{ fontWeight: 600, boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)' }}
        >
          <FolderPlus size={18} />
          <span>New Project</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '36px 40px', maxWidth: '1280px', width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Projects Library</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Manage taking-off drawings, calibrate scales, and compute quantity survey bills.
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <div style={{
            backgroundColor: '#FFFFFF',
            border: '2px dashed var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            padding: '60px 20px',
            textAlign: 'center',
            maxWidth: '540px',
            margin: '40px auto',
          }}>
            <FileText size={48} color="var(--text-subtle)" style={{ margin: '0 auto 16px auto' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>No Projects Yet</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Create your first project and upload a floor plan PDF or image to begin taking off.
            </p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <FolderPlus size={16} />
              <span>Create First Project</span>
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
          }}>
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-light)',
                  boxShadow: 'var(--shadow-sm)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  e.currentTarget.style.borderColor = 'var(--primary-border)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  e.currentTarget.style.borderColor = 'var(--border-light)';
                }}
              >
                {/* Thumbnail banner */}
                <div style={{
                  height: '140px',
                  backgroundColor: '#0F172A',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {p.thumbnail_sheet_id ? (
                    <img
                      src={api.getSheetImageUrl(p.thumbnail_sheet_id)}
                      alt={p.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
                    />
                  ) : (
                    <Layers size={36} color="#334155" />
                  )}
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                  }}>
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ padding: '4px 8px', borderRadius: '6px' }}
                      onClick={(e) => handleDeleteProject(p.id, p.name, e)}
                      title="Delete Project"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                      {p.name}
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {p.client && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <User size={13} color="var(--primary)" />
                          <span>{p.client}</span>
                        </div>
                      )}
                      {p.location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={13} color="#10B981" />
                          <span>{p.location}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Layers size={13} color="#0EA5E9" />
                        <span>{p.sheet_count} Drawing Sheet{p.sheet_count === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    marginTop: '20px',
                    paddingTop: '14px',
                    borderTop: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                      {new Date(p.updated_at).toLocaleDateString()}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '11px', padding: '4px 10px', height: '28px', gap: '4px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects/${p.id}/boq`);
                        }}
                        title="View BESMM4 Bill of Quantities"
                      >
                        <FileSpreadsheet size={13} color="#2563EB" />
                        <span>BOQ</span>
                      </button>
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--primary)',
                      }}>
                        Studio <ArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* New Project Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 style={{ fontSize: '16px' }}>Create New Taking-Off Project</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 4-Bedroom Duplex Floor Plan"
                    className="input"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                      Client (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Arc. Johnson"
                      className="input"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                      Location (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Abuja, Nigeria"
                      className="input"
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Initial Floor Plan Drawing (PDF / Image)
                  </label>
                  <div style={{
                    border: '2px dashed var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    padding: '24px 16px',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-app)',
                    cursor: 'pointer',
                  }}
                    onClick={() => document.getElementById('file-upload-input')?.click()}
                  >
                    <input
                      id="file-upload-input"
                      type="file"
                      accept=".pdf,image/png,image/jpeg"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedFile(e.target.files[0]);
                        }
                      }}
                    />
                    <UploadCloud size={32} color="var(--primary)" style={{ margin: '0 auto 8px auto' }} />
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-main)' }}>
                      {selectedFile ? selectedFile.name : 'Click to select or drag PDF / Image'}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      CAD Vector PDFs, Scanned PDFs, PNG, JPG (up to 40MB)
                    </p>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating & Ingesting...' : 'Create & Open Studio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
