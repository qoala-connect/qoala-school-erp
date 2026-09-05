import React, { useEffect, useState, useCallback } from 'react';
import { 
  fetchSystemSettings, 
  updateSystemSettings, 
  SystemSettings 
} from '@/services/systemService';
import { useAuth } from '@/context/AuthContext';
import { SystemLoadingBlock, SystemErrorBlock } from './shared';
import { toast } from 'sonner';
import { 
  Building2, 
  Palette, 
  Globe, 
  Shield, 
  Save, 
  RefreshCw, 
  FileText, 
  Phone, 
  Mail, 
  MapPin, 
  Award,
  Loader2,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';

const COLOR_PRESETS = [
  { name: 'SJS Royal Blue', primary: '#1a73e8', accent: '#061f3d' },
  { name: 'SJS Maroon Gold', primary: '#881525', accent: '#ecb30b' },
  { name: 'SJS Green Accent', primary: '#00a651', accent: '#1a73e8' },
  { name: 'CBSE Navy', primary: '#1E3A8A', accent: '#3B82F6' },
  { name: 'Slate Enterprise', primary: '#334155', accent: '#64748B' },
];

export default function SchoolSettingsView() {
  const { can } = useAuth();
  const canManage = can('settings.manage');

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [formData, setFormData] = useState<Partial<SystemSettings>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSystemSettings();
      setSettings(data);
      setFormData(data);
    } catch (err: any) {
      console.error('[SchoolSettings] fetch failed:', err);
      setError(err?.message || 'Could not load school settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleChange = (field: keyof SystemSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      toast.error('You do not have permission to modify school settings');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateSystemSettings(formData);
      setSettings(updated);
      setFormData(updated);
      toast.success('School settings updated and committed to database successfully!');
    } catch (err: any) {
      console.error('[SchoolSettings] save failed:', err);
      toast.error(err?.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <SystemLoadingBlock message="Loading institutional configuration…" />;
  }

  if (error || !settings) {
    return <SystemErrorBlock message={error || 'Settings not available'} onRetry={loadSettings} />;
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {/* Top action header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Institutional Configuration &amp; Global Settings</h2>
          <p className="text-[11px] text-slate-500">
            Canonical single-source of truth for school identity, official CBSE affiliation, branding, and system preferences.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={loadSettings}
            disabled={isSaving}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
          >
            <RefreshCw size={12} className={cn(isLoading && 'animate-spin')} />
            Reset
          </button>
          <button
            type="submit"
            disabled={!canManage || isSaving}
            className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save Configuration
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (8 cols): Identity, Affiliation, Contact, Branding */}
        <div className="lg:col-span-8 space-y-4">
          {/* 1. School Identity */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Building2 size={14} className="text-violet-600" />
              School Identity
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Official School Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!canManage}
                  value={formData.school_name || ''}
                  onChange={e => handleChange('school_name', e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  placeholder="e.g. St. Joseph’s School, Barhalganj"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">School Code</label>
                <input
                  type="text"
                  disabled={!canManage}
                  value={formData.school_code || ''}
                  onChange={e => handleChange('school_code', e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  placeholder="e.g. SDPS-7021"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Principal / Head Name</label>
                <input
                  type="text"
                  disabled={!canManage}
                  value={formData.principal_name || ''}
                  onChange={e => handleChange('principal_name', e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  placeholder="e.g. Dr. R. M. Sharma"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Affiliation Board</label>
                <input
                  type="text"
                  disabled={!canManage}
                  value={formData.affiliation_board || ''}
                  onChange={e => handleChange('affiliation_board', e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  placeholder="e.g. CBSE / ICSE / State Board"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Affiliation Number</label>
                <input
                  type="text"
                  disabled={!canManage}
                  value={formData.affiliation_number || ''}
                  onChange={e => handleChange('affiliation_number', e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  placeholder="e.g. 2130000"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Official Website URL</label>
                <input
                  type="url"
                  disabled={!canManage}
                  value={formData.school_website || ''}
                  onChange={e => handleChange('school_website', e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  placeholder="https://sjsbrlschool.edu.in"
                />
              </div>
            </div>
          </div>

          {/* 2. Contact & Address */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <MapPin size={14} className="text-emerald-600" />
              Location &amp; Contact Details
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Official Campus Address</label>
                <textarea
                  rows={2}
                  disabled={!canManage}
                  value={formData.school_address || ''}
                  onChange={e => handleChange('school_address', e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  placeholder="Campus address, City, State, PIN"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Office Phone Number</label>
                  <input
                    type="tel"
                    disabled={!canManage}
                    value={formData.school_phone || ''}
                    onChange={e => handleChange('school_phone', e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    placeholder="+91 98765 43210"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Official Contact Email</label>
                  <input
                    type="email"
                    disabled={!canManage}
                    value={formData.school_email || ''}
                    onChange={e => handleChange('school_email', e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    placeholder="info@school.edu.in"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Official Branding */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Palette size={14} className="text-indigo-600" />
              Branding &amp; Document Identity
            </h3>

            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Primary Brand Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      disabled={!canManage}
                      value={formData.brand_primary_color || '#1a73e8'}
                      onChange={e => handleChange('brand_primary_color', e.target.value)}
                      className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white shrink-0"
                    />
                    <input
                      type="text"
                      disabled={!canManage}
                      value={formData.brand_primary_color || '#1a73e8'}
                      onChange={e => handleChange('brand_primary_color', e.target.value)}
                      className="w-full text-xs font-mono p-2 bg-slate-50 border border-slate-200 rounded-xl uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Accent Brand Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      disabled={!canManage}
                      value={formData.brand_accent_color || '#061f3d'}
                      onChange={e => handleChange('brand_accent_color', e.target.value)}
                      className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white shrink-0"
                    />
                    <input
                      type="text"
                      disabled={!canManage}
                      value={formData.brand_accent_color || '#061f3d'}
                      onChange={e => handleChange('brand_accent_color', e.target.value)}
                      className="w-full text-xs font-mono p-2 bg-slate-50 border border-slate-200 rounded-xl uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Color Presets */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Suggested Color Palettes
                </span>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map(p => (
                    <button
                      key={p.name}
                      type="button"
                      disabled={!canManage}
                      onClick={() => {
                        handleChange('brand_primary_color', p.primary);
                        handleChange('brand_accent_color', p.accent);
                      }}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 transition-colors"
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.primary }} />
                      <div className="w-3 h-3 rounded-full -ml-1" style={{ backgroundColor: p.accent }} />
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Document Header Note</label>
                  <input
                    type="text"
                    disabled={!canManage}
                    value={formData.document_header_note || ''}
                    onChange={e => handleChange('document_header_note', e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    placeholder="e.g. Recognized by Govt of U.P. & CBSE"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Document Footer Note</label>
                  <input
                    type="text"
                    disabled={!canManage}
                    value={formData.document_footer_note || ''}
                    onChange={e => handleChange('document_footer_note', e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    placeholder="e.g. Computer generated document. Valid without signature."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Regional Formatting & Security Policies */}
        <div className="lg:col-span-4 space-y-4">
          {/* 4. Global & Regional Formatting */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3.5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Globe size={14} className="text-cyan-600" />
              Regional Preferences
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Timezone</label>
                <select
                  disabled={!canManage}
                  value={formData.timezone || 'Asia/Kolkata'}
                  onChange={e => handleChange('timezone', e.target.value)}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                  <option value="UTC">UTC</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Date Format</label>
                <select
                  disabled={!canManage}
                  value={formData.date_format || 'DD/MM/YYYY'}
                  onChange={e => handleChange('date_format', e.target.value)}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2026)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (2026-12-31)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2026)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Currency Code</label>
                <input
                  type="text"
                  disabled={!canManage}
                  value={formData.currency_code || 'INR'}
                  onChange={e => handleChange('currency_code', e.target.value)}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono"
                  placeholder="INR"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Default Page Size</label>
                <select
                  disabled={!canManage}
                  value={formData.default_page_size || 25}
                  onChange={e => handleChange('default_page_size', Number(e.target.value))}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  <option value={10}>10 items per page</option>
                  <option value={25}>25 items per page</option>
                  <option value={50}>50 items per page</option>
                  <option value={100}>100 items per page</option>
                </select>
              </div>
            </div>
          </div>

          {/* 5. Session & Security Governance */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3.5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Lock size={14} className="text-amber-600" />
              Security Governance
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Session Timeout (Minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  disabled={!canManage}
                  value={formData.session_timeout_minutes || 60}
                  onChange={e => handleChange('session_timeout_minutes', Number(e.target.value))}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Automatic session expiry after idle duration (5–1440 mins).
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">Two-Factor Authentication (MFA)</div>
                  <div className="text-[10px] text-slate-400">Require multi-factor auth for administrators</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canManage}
                    checked={formData.mfa_enabled || false}
                    onChange={e => handleChange('mfa_enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600" />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
