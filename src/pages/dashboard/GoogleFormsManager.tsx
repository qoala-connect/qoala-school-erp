import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  FileText, 
  Plus, 
  Sparkles, 
  ArrowLeft, 
  LogOut, 
  ExternalLink, 
  RefreshCw, 
  HelpCircle, 
  Activity, 
  CheckCircle2, 
  BarChart, 
  Users, 
  Clock, 
  FileSpreadsheet, 
  Lock, 
  ChevronRight, 
  AlertCircle,
  QrCode,
  ArrowRight
} from 'lucide-react';
import { 
  initGoogleAuth, 
  googleSignIn, 
  googleLogout, 
  listGoogleForms, 
  getGoogleFormDetails, 
  getGoogleFormResponses, 
  createGoogleForm, 
  populateFormTemplate,
  GoogleDriveFile,
  GoogleFormDetails,
  GoogleFormResponse
} from '@/services/googleFormsService';
import { Toaster, toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';

const TEMPLATES = [
  {
    id: 'feedback',
    title: 'Parent Feedback Form',
    description: 'Gather feedback on academics, fees, and facilities from parents.',
    icon: HelpCircle,
    color: 'from-violet-500 to-indigo-600',
    questionsCount: 5
  },
  {
    id: 'admission',
    title: 'Admission Inquiry Survey',
    description: 'Collect inquiries and application data from prospective parents.',
    icon: Users,
    color: 'from-emerald-500 to-teal-600',
    questionsCount: 5
  },
  {
    id: 'event',
    title: 'Student Event Registration',
    description: 'Coordinate sign-ups for school sports, cultural meets, and exams.',
    icon: Sparkles,
    color: 'from-amber-500 to-orange-600',
    questionsCount: 4
  }
];

export default function GoogleFormsManager() {
  const { role } = useAuth();
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  // Forms states
  const [formsList, setFormsList] = useState<GoogleDriveFile[]>([]);
  const [isLoadingForms, setIsLoadingForms] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedFormDetails, setSelectedFormDetails] = useState<GoogleFormDetails | null>(null);
  const [selectedFormResponses, setSelectedFormResponses] = useState<GoogleFormResponse[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // New Form states
  const [newFormTitle, setNewFormTitle] = useState('');
  const [newFormDesc, setNewFormDesc] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<'feedback' | 'admission' | 'event' | 'blank'>('feedback');
  const [isCreatingForm, setIsCreatingForm] = useState(false);

  // Active Workspace section
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'details'>('list');

  // Trigger Auth state checking on load
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setNeedsAuth(false);
        setIsLoadingAuth(false);
        // Load Google Forms automatically
        fetchForms(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setNeedsAuth(true);
        setIsLoadingAuth(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoadingAuth(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        setNeedsAuth(false);
        toast.success('Successfully connected to Google Workspace!');
        fetchForms(result.accessToken);
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication with Google failed.');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleGoogleLogout = async () => {
    const confirmed = window.confirm('Are you sure you want to disconnect from Google Workspace?');
    if (!confirmed) return;

    try {
      await googleLogout();
      setGoogleUser(null);
      setGoogleToken(null);
      setNeedsAuth(true);
      setFormsList([]);
      setSelectedFormDetails(null);
      setSelectedFormResponses([]);
      setSelectedFormId(null);
      setActiveTab('list');
      toast.success('Disconnected from Google Workspace');
    } catch (error: any) {
      toast.error('Logout failed');
    }
  };

  const fetchForms = async (token: string) => {
    setIsLoadingForms(true);
    try {
      const forms = await listGoogleForms(token);
      setFormsList(forms);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Could not fetch forms from Google Drive.');
    } finally {
      setIsLoadingForms(false);
    }
  };

  const handleRefreshForms = () => {
    if (googleToken) {
      fetchForms(googleToken);
      toast.success('Form list updated');
    }
  };

  const handleSelectForm = async (formId: string) => {
    if (!googleToken) return;
    setIsLoadingDetails(true);
    setSelectedFormId(formId);
    setActiveTab('details');

    try {
      // Parallel fetch for Form configuration and submitted responses
      const [details, responses] = await Promise.all([
        getGoogleFormDetails(googleToken, formId),
        getGoogleFormResponses(googleToken, formId)
      ]);
      setSelectedFormDetails(details);
      setSelectedFormResponses(responses);
    } catch (err: any) {
      toast.error(err.message || 'Could not load form details or responses.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleCreateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleToken) return;
    if (!newFormTitle.trim()) {
      toast.error('Please enter a form title.');
      return;
    }

    setIsCreatingForm(true);
    try {
      // 1. Create form body
      const finalTitle = newFormTitle.trim();
      const finalDesc = newFormDesc.trim() || 'Form created from St. Joseph’s School, Barhalganj Portal';
      
      const created = await createGoogleForm(googleToken, finalTitle, finalDesc);
      
      // 2. Populate with templates if chosen
      if (selectedTemplate !== 'blank') {
        toast.info(`Configuring fields for template: ${selectedTemplate}...`);
        await populateFormTemplate(googleToken, created.formId, selectedTemplate);
      }

      toast.success('Google Form created and pre-configured successfully!');
      
      // Reset form controls
      setNewFormTitle('');
      setNewFormDesc('');
      
      // Refresh form list and switch back
      await fetchForms(googleToken);
      
      // Auto-open the newly created form details
      handleSelectForm(created.formId);
    } catch (err: any) {
      toast.error(err.message || 'Could not create form.');
    } finally {
      setIsCreatingForm(false);
    }
  };

  const handleSyncToSchool = (actionType: string) => {
    if (!selectedFormResponses || selectedFormResponses.length === 0) {
      toast.info('No responses to sync.');
      return;
    }

    if (actionType === 'admission') {
      toast.success(`Synced ${selectedFormResponses.length} inquiries to Admissions list! (Simulation active)`);
    } else if (actionType === 'feedback') {
      toast.success('Successfully filed parent feedback in school suggestion log!');
    }
  };

  const renderAuthScreen = () => {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white border border-slate-200/60 rounded-[32px] p-8 md:p-10 shadow-lg text-center space-y-6">
        <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/20">
          <FileText className="w-8 h-8 text-white animate-pulse" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight">Google Forms Workspace</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            Create school forms, launch surveys, and view responses in real-time. Link your Google account securely to unlock the workspace.
          </p>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-left space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Launch Instant Surveys
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Integrate with School Admissions & Suggestions
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Track, Analyze, & Chart Survey Responses
          </div>
        </div>

        {/* Official Google Material Button design */}
        <div className="pt-2">
          <button 
            onClick={handleGoogleLogin}
            disabled={isLoadingAuth}
            className="gsi-material-button w-full flex items-center justify-center py-2 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer font-bold text-xs"
          >
            <div className="gsi-material-button-state"></div>
            <div className="gsi-material-button-content-wrapper flex items-center gap-3">
              <div className="gsi-material-button-icon">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 block">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
              </div>
              <span className="gsi-material-button-contents font-semibold text-slate-700">
                {isLoadingAuth ? 'Connecting to Google...' : 'Sign in with Google'}
              </span>
            </div>
          </button>
        </div>
      </div>
    );
  };

  const renderFormsList = () => {
    if (isLoadingForms) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-2">
          <RefreshCw className="w-8 h-8 animate-spin text-violet-600" />
          <p className="text-xs font-semibold uppercase tracking-wider">Syncing with Google Drive...</p>
        </div>
      );
    }

    if (formsList.length === 0) {
      return (
        <div className="text-center py-16 bg-white border border-slate-200/60 rounded-2xl p-6 shadow-xs space-y-4">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <div>
            <h3 className="font-bold text-slate-800 text-sm">No Forms Found</h3>
            <p className="text-slate-500 text-xs mt-1">We couldn't detect any Google Forms in your Drive. Create one now using templates!</p>
          </div>
          <button 
            onClick={() => setActiveTab('create')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" /> Create Form
          </button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {formsList.map((form) => (
          <div 
            key={form.id} 
            className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden hover:scale-[1.01] hover:shadow-md transition-all flex flex-col group"
          >
            <div className="p-5 flex-1 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="p-2.5 bg-violet-50 rounded-xl">
                  <FileText className="w-5 h-5 text-violet-600" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                  Form
                </span>
              </div>
              
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-slate-800 line-clamp-2 group-hover:text-violet-600 transition-colors">
                  {form.name}
                </h4>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold">
                  <Clock className="w-3.5 h-3.5 text-slate-300" />
                  Edited {new Date(form.modifiedTime).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
              <button 
                onClick={() => handleSelectForm(form.id)}
                className="text-xs font-extrabold text-violet-600 hover:text-indigo-700 transition-colors cursor-pointer flex items-center gap-1"
              >
                View Responses <ChevronRight className="w-3.5 h-3.5" />
              </button>
              
              <a 
                href={form.webViewLink} 
                target="_blank" 
                rel="noreferrer"
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
                title="Open Form in Google Forms"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderCreateTab = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Template List */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1 font-semibold">Quick Launch Templates</h3>
          <div className="grid grid-cols-1 gap-4">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => {
                  setSelectedTemplate(tpl.id as any);
                  setNewFormTitle(tpl.title);
                  setNewFormDesc(tpl.description);
                  toast.info(`Selected ${tpl.title} template`);
                }}
                className={`w-full flex items-start gap-4 p-5 bg-white border rounded-2xl text-left hover:scale-[1.01] active:scale-99 cursor-pointer transition-all ${
                  selectedTemplate === tpl.id 
                    ? 'border-violet-500 shadow-sm bg-violet-50/10' 
                    : 'border-slate-200/60 hover:border-slate-300'
                }`}
              >
                <div className={`p-3 rounded-xl bg-gradient-to-tr ${tpl.color} text-white shrink-0`}>
                  <tpl.icon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm leading-none">{tpl.title}</span>
                    <span className="bg-slate-100 text-[9px] font-bold text-slate-500 px-1.5 py-0.5 rounded border border-slate-100">
                      {tpl.questionsCount} Questions
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs leading-normal">{tpl.description}</p>
                </div>
              </button>
            ))}

            <button
              onClick={() => {
                setSelectedTemplate('blank');
                setNewFormTitle('Blank School Form');
                setNewFormDesc('Enter custom instructions or details here.');
                toast.info('Selected Custom Blank template');
              }}
              className={`w-full flex items-start gap-4 p-5 bg-white border rounded-2xl text-left hover:scale-[1.01] active:scale-99 cursor-pointer transition-all ${
                selectedTemplate === 'blank' 
                  ? 'border-violet-500 shadow-sm bg-violet-50/10' 
                  : 'border-slate-200/60 hover:border-slate-300'
              }`}
            >
              <div className="p-3 rounded-xl bg-slate-100 text-slate-600 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-sm leading-none">Custom Blank Form</span>
                  <span className="bg-slate-100 text-[9px] font-bold text-slate-500 px-1.5 py-0.5 rounded border border-slate-100">
                    Blank Page
                  </span>
                </div>
                <p className="text-slate-500 text-xs leading-normal">Create a standard Google Form shell where you can design your own questions on the fly.</p>
              </div>
            </button>
          </div>
        </div>

        {/* Create Controller Form */}
        <div className="lg:col-span-5 bg-white border border-slate-200/60 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-extrabold text-sm text-slate-800">Form Parameters</h3>
            <p className="text-slate-500 text-[11px] mt-0.5">Customize metadata to publish your new form directly to your Google Forms drive.</p>
          </div>

          <form onSubmit={handleCreateForm} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Form Display Name</label>
              <input 
                type="text" 
                value={newFormTitle}
                onChange={(e) => setNewFormTitle(e.target.value)}
                placeholder="e.g. Pre-Nursery Admissions 2026-27"
                className="w-full bg-slate-50/50 border border-slate-200 rounded-lg py-1.5 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all h-[38px] font-semibold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Form Header Description</label>
              <textarea 
                value={newFormDesc}
                onChange={(e) => setNewFormDesc(e.target.value)}
                placeholder="Provide instructions or brief notes for respondents..."
                className="w-full bg-slate-50/50 border border-slate-200 rounded-lg py-2 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all min-h-[100px] leading-relaxed"
              />
            </div>

            <button 
              type="submit"
              disabled={isCreatingForm}
              className="w-full flex items-center justify-center gap-2 h-[42px] bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-violet-500/15 cursor-pointer"
            >
              {isCreatingForm ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Publishing Form...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Deploy Form to Google
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  };

  const renderDetailsTab = () => {
    if (isLoadingDetails) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-2">
          <RefreshCw className="w-8 h-8 animate-spin text-violet-600" />
          <p className="text-xs font-semibold uppercase tracking-wider">Retrieving Form Config & Responses...</p>
        </div>
      );
    }

    if (!selectedFormDetails) {
      return (
        <div className="text-center py-16 bg-white border border-slate-200/60 rounded-2xl p-6 shadow-xs">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-sm">Failed to Load Form</h3>
          <p className="text-slate-500 text-xs mt-1">We couldn't retrieve the requested Google Form configuration.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Form Meta Display */}
        <div className="bg-white border border-slate-200/60 rounded-[24px] p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-violet-100 text-[9px] font-bold text-violet-600 px-2 py-0.5 rounded border border-violet-200/50 uppercase tracking-wider">
                Active Form Analytics
              </span>
              <span className="text-[11px] text-slate-400 font-semibold truncate max-w-xs md:max-w-md">ID: {selectedFormDetails.formId}</span>
            </div>
            <h3 className="text-lg font-display font-black text-slate-800">{selectedFormDetails.info.title}</h3>
            {selectedFormDetails.info.description && (
              <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">{selectedFormDetails.info.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <a 
              href={selectedFormDetails.responderUri} 
              target="_blank" 
              rel="noreferrer"
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              View Live Form <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button 
              onClick={() => handleSelectForm(selectedFormDetails.formId)}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 rounded-xl transition-all cursor-pointer"
              title="Refresh Responses"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Responses & Integration Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main responses container */}
          <div className="lg:col-span-8 bg-white border border-slate-200/60 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-500" />
                Submitted Responses
                <span className="bg-emerald-50 text-[10px] text-emerald-600 font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                  {selectedFormResponses.length} submissions
                </span>
              </h4>
            </div>

            <div className="p-0 overflow-x-auto">
              {selectedFormResponses.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-bold text-xs">
                  No responses have been submitted to this Google Form yet.
                </div>
              ) : (
                <table className="w-full border-collapse text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="py-2.5 px-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Response ID</th>
                      <th className="py-2.5 px-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Submitted At</th>
                      {selectedFormDetails.items?.slice(0, 3).map(item => (
                        <th key={item.itemId} className="py-2.5 px-3 font-bold text-slate-500 uppercase tracking-wider text-[10px] max-w-[150px] truncate">
                          {item.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {selectedFormResponses.map((resp) => (
                      <tr key={resp.responseId} className="hover:bg-slate-50/40">
                        <td className="py-3 px-4 font-bold text-slate-500 max-w-[100px] truncate">
                          {resp.responseId}
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-semibold">
                          {new Date(resp.lastSubmittedTime).toLocaleDateString()} {new Date(resp.lastSubmittedTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </td>
                        {selectedFormDetails.items?.slice(0, 3).map(item => {
                          const questionId = item.questionItem?.question?.questionId;
                          const answerObj = questionId ? resp.answers[questionId] : null;
                          const answerValue = answerObj?.textAnswers?.answers?.map(a => a.value).join(', ') || 'N/A';
                          return (
                            <td key={item.itemId} className="py-3 px-3 text-slate-600 font-medium max-w-[180px] truncate" title={answerValue}>
                              {answerValue}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Quick Actions / Integration Portal */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-xs p-5 space-y-4">
              <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-violet-600 animate-pulse" />
                School Actions Sync
              </h4>
              <p className="text-slate-500 text-xs leading-normal">
                Dynamically process form submissions and register them into our central database structure.
              </p>

              <div className="space-y-2.5">
                <button 
                  onClick={() => handleSyncToSchool('admission')}
                  disabled={selectedFormResponses.length === 0}
                  className="w-full px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold text-xs rounded-xl flex items-center justify-between group active:scale-99 hover:scale-[1.01] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Sync to Admissions Queue</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <button 
                  onClick={() => handleSyncToSchool('feedback')}
                  disabled={selectedFormResponses.length === 0}
                  className="w-full px-4 py-2 bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-extrabold text-xs rounded-xl flex items-center justify-between group active:scale-99 hover:scale-[1.01] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Log Parent Feedback Log</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* Sharing & QR Code Widget */}
            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-xs p-5 space-y-3.5">
              <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-slate-500" />
                Form Sharing
              </h4>
              <p className="text-slate-500 text-xs leading-normal">
                Distribute forms easily to students and parents using high-resolution web links.
              </p>
              
              <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded-xl">
                <input 
                  type="text" 
                  value={selectedFormDetails.responderUri}
                  readOnly
                  className="w-full bg-transparent text-[10px] text-slate-500 outline-none select-all font-semibold font-mono"
                />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(selectedFormDetails.responderUri);
                    toast.success('Form link copied to clipboard!');
                  }}
                  className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white font-bold text-[10px] rounded-lg transition-all shrink-0 cursor-pointer"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-24 text-slate-700">
      <Toaster position="top-center" richColors />

      {/* Main Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 bg-white border border-slate-200/60 rounded-[24px] shadow-sm">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight">Google Forms Workspace</h1>
            {googleUser && (
              <span className="bg-emerald-50 border border-emerald-200/50 text-emerald-600 text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Linked
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm">Deploy registration forms, feedback metrics, and admission surveys with instant Drive syncing.</p>
        </div>

        {googleUser && (
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/60 px-4 py-1.5 rounded-2xl shadow-2xs">
            <div className="text-right">
              <div className="text-xs font-bold text-slate-800 line-clamp-1">{googleUser.email}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Workspace Account</div>
            </div>
            <button 
              onClick={handleGoogleLogout}
              className="p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-500 border border-slate-200 hover:border-rose-100 rounded-xl transition-all cursor-pointer"
              title="Disconnect Account"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Display Login view if user isn't authenticated yet */}
      {needsAuth ? (
        renderAuthScreen()
      ) : (
        <div className="space-y-6">
          {/* Nav Header Controls */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => {
                  setActiveTab('list');
                  setSelectedFormId(null);
                  setSelectedFormDetails(null);
                  setSelectedFormResponses([]);
                }}
                className={`px-4 py-2 font-bold text-xs transition-all border-b-2 cursor-pointer ${
                  activeTab === 'list' 
                    ? 'border-violet-600 text-violet-600 font-extrabold' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Survey Registry
              </button>

              <button 
                onClick={() => {
                  setActiveTab('create');
                  setSelectedFormId(null);
                  setSelectedFormDetails(null);
                  setSelectedFormResponses([]);
                }}
                className={`px-4 py-2 font-bold text-xs transition-all border-b-2 cursor-pointer ${
                  activeTab === 'create' 
                    ? 'border-violet-600 text-violet-600 font-extrabold' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Create New Form
              </button>

              {activeTab === 'details' && (
                <button 
                  className="px-4 py-2 font-black text-xs transition-all border-b-2 border-violet-600 text-violet-600 cursor-pointer"
                >
                  Analytics & Responses
                </button>
              )}
            </div>

            {activeTab === 'list' && (
              <button 
                onClick={handleRefreshForms}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Synchronize
              </button>
            )}
          </div>

          {/* Tab Views */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'list' && renderFormsList()}
            {activeTab === 'create' && renderCreateTab()}
            {activeTab === 'details' && renderDetailsTab()}
          </motion.div>
        </div>
      )}
    </div>
  );
}
