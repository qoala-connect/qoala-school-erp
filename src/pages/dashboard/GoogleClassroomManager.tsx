import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, 
  Plus, 
  Sparkles, 
  LogOut, 
  ExternalLink, 
  RefreshCw, 
  GraduationCap, 
  UserCheck, 
  Users, 
  BellRing, 
  BookMarked, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Send,
  PlusCircle,
  FileText
} from 'lucide-react';
import { 
  initGoogleClassroomAuth, 
  googleClassroomSignIn, 
  googleClassroomLogout, 
  listClassroomCourses, 
  listClassroomStudents, 
  listClassroomTeachers, 
  listClassroomAnnouncements, 
  listClassroomCourseWork, 
  createClassroomCourse, 
  createClassroomAssignment, 
  createClassroomAnnouncement,
  ClassroomCourse,
  ClassroomRosterUser,
  ClassroomAnnouncement,
  ClassroomCourseWork
} from '@/services/googleClassroomService';
import { toast } from 'sonner';

export default function GoogleClassroomManager() {
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Classroom lists state
  const [coursesList, setCoursesList] = useState<ClassroomCourse[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);

  // Selected Course details state
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<ClassroomCourse | null>(null);
  const [studentsList, setStudentsList] = useState<ClassroomRosterUser[]>([]);
  const [teachersList, setTeachersList] = useState<ClassroomRosterUser[]>([]);
  const [announcements, setAnnouncements] = useState<ClassroomAnnouncement[]>([]);
  const [coursework, setCoursework] = useState<ClassroomCourseWork[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Active Workspace sub-tab
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'details'>('list');
  const [detailsSubTab, setDetailsSubTab] = useState<'announcements' | 'assignments' | 'roster'>('announcements');

  // Input states for Creating Course
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseSection, setNewCourseSection] = useState('');
  const [newCourseRoom, setNewCourseRoom] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);

  // Input states for broadcasting details
  const [announcementText, setAnnouncementText] = useState('');
  const [isPostingAnnouncement, setIsPostingAnnouncement] = useState(false);

  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentDesc, setAssignmentDesc] = useState('');
  const [assignmentPoints, setAssignmentPoints] = useState(100);
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);

  // Check auth status on component mount
  useEffect(() => {
    const unsubscribe = initGoogleClassroomAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setNeedsAuth(false);
        setIsLoadingAuth(false);
        fetchCourses(token);
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
      const result = await googleClassroomSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        setNeedsAuth(false);
        toast.success('Successfully connected to Google Classroom!');
        fetchCourses(result.accessToken);
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication with Google failed.');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleGoogleLogout = async () => {
    const confirmed = window.confirm('Are you sure you want to disconnect from Google Classroom?');
    if (!confirmed) return;

    try {
      await googleClassroomLogout();
      setGoogleUser(null);
      setGoogleToken(null);
      setNeedsAuth(true);
      setCoursesList([]);
      setSelectedCourseId(null);
      setSelectedCourse(null);
      setActiveTab('list');
      toast.success('Disconnected from Google Classroom');
    } catch (error: any) {
      toast.error('Logout failed');
    }
  };

  const fetchCourses = async (token: string) => {
    setIsLoadingCourses(true);
    try {
      const courses = await listClassroomCourses(token);
      setCoursesList(courses);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Could not fetch Google Classroom courses.');
    } finally {
      setIsLoadingCourses(false);
    }
  };

  const handleRefreshCourses = () => {
    if (googleToken) {
      fetchCourses(googleToken);
      toast.success('Course registry updated');
    }
  };

  const handleSelectCourse = async (course: ClassroomCourse) => {
    if (!googleToken) return;
    setIsLoadingDetails(true);
    setSelectedCourseId(course.id);
    setSelectedCourse(course);
    setActiveTab('details');
    setDetailsSubTab('announcements');

    try {
      const [teachers, students, announcementsData, courseworkData] = await Promise.all([
        listClassroomTeachers(googleToken, course.id),
        listClassroomStudents(googleToken, course.id),
        listClassroomAnnouncements(googleToken, course.id),
        listClassroomCourseWork(googleToken, course.id)
      ]);
      setTeachersList(teachers);
      setStudentsList(students);
      setAnnouncements(announcementsData);
      setCoursework(courseworkData);
    } catch (err: any) {
      toast.error(err.message || 'Could not load course participants or syllabus.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleToken) return;
    if (!newCourseName.trim()) {
      toast.error('Please enter a class / course name.');
      return;
    }

    setIsCreatingCourse(true);
    try {
      const created = await createClassroomCourse(
        googleToken,
        newCourseName.trim(),
        newCourseSection.trim() || undefined,
        newCourseRoom.trim() || undefined,
        newCourseDesc.trim() || undefined
      );

      toast.success(`Google Classroom Class "${created.name}" created!`);
      setNewCourseName('');
      setNewCourseSection('');
      setNewCourseRoom('');
      setNewCourseDesc('');
      
      await fetchCourses(googleToken);
      handleSelectCourse(created);
    } catch (err: any) {
      toast.error(err.message || 'Could not create classroom course.');
    } finally {
      setIsCreatingCourse(false);
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleToken || !selectedCourseId || !announcementText.trim()) return;

    setIsPostingAnnouncement(true);
    try {
      await createClassroomAnnouncement(googleToken, selectedCourseId, announcementText.trim());
      toast.success('Announcement broadcasted to Google Classroom!');
      setAnnouncementText('');
      
      // Refresh announcements list
      const freshAnnouncements = await listClassroomAnnouncements(googleToken, selectedCourseId);
      setAnnouncements(freshAnnouncements);
    } catch (err: any) {
      toast.error(err.message || 'Could not dispatch announcement.');
    } finally {
      setIsPostingAnnouncement(false);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleToken || !selectedCourseId || !assignmentTitle.trim()) return;

    setIsCreatingAssignment(true);
    try {
      await createClassroomAssignment(
        googleToken,
        selectedCourseId,
        assignmentTitle.trim(),
        assignmentDesc.trim() || undefined,
        assignmentPoints
      );

      toast.success('Assignment created & published successfully!');
      setAssignmentTitle('');
      setAssignmentDesc('');
      setAssignmentPoints(100);

      // Refresh coursework list
      const freshCoursework = await listClassroomCourseWork(googleToken, selectedCourseId);
      setCoursework(freshCoursework);
    } catch (err: any) {
      toast.error(err.message || 'Could not create coursework assignment.');
    } finally {
      setIsCreatingAssignment(false);
    }
  };

  const handleSyncRosterToPortal = () => {
    if (studentsList.length === 0) {
      toast.info('No students to sync.');
      return;
    }
    toast.success(`Synced ${studentsList.length} Google Classroom students to school attendance logs! (Simulation active)`);
  };

  const renderAuthScreen = () => {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white border border-slate-200/60 rounded-[32px] p-8 md:p-10 shadow-lg text-center space-y-6">
        <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <GraduationCap className="w-8 h-8 text-white animate-pulse" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight">Google Classroom Portal</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            Manage course streams, broadcast announcements, assign student tasks, and keep Google Classrooms synchronized with your central portal.
          </p>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-left space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Integrate Google Classroom Rosters
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Broadcast Bulletins & Announcements Directly
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Deploy and Review Assignments on Drive
          </div>
        </div>

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
                {isLoadingAuth ? 'Connecting Google Classroom...' : 'Sign in to Google Classroom'}
              </span>
            </div>
          </button>
        </div>
      </div>
    );
  };

  const renderCoursesList = () => {
    if (isLoadingCourses) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-2">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-xs font-semibold uppercase tracking-wider">Loading Active Courses...</p>
        </div>
      );
    }

    if (coursesList.length === 0) {
      return (
        <div className="text-center py-16 bg-white border border-slate-200/60 rounded-2xl p-6 shadow-xs space-y-4">
          <GraduationCap className="w-12 h-12 text-slate-300 mx-auto" />
          <div>
            <h3 className="font-bold text-slate-800 text-sm">No Classrooms Found</h3>
            <p className="text-slate-500 text-xs mt-1">We couldn't detect any active courses in your account. Launch a new class immediately!</p>
          </div>
          <button 
            onClick={() => setActiveTab('create')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" /> Create Course
          </button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {coursesList.map((course) => (
          <div 
            key={course.id} 
            className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden hover:scale-[1.01] hover:shadow-md transition-all flex flex-col group justify-between"
          >
            <div className="p-5 flex-1 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="p-2.5 bg-indigo-50 rounded-xl">
                  <GraduationCap className="w-5 h-5 text-indigo-600" />
                </div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  {course.courseState}
                </span>
              </div>
              
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-slate-800 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                  {course.name}
                </h4>
                {course.section && (
                  <p className="text-slate-400 text-xs font-semibold">{course.section}</p>
                )}
                {course.room && (
                  <p className="text-[10px] text-slate-500 font-medium">Room: {course.room}</p>
                )}
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
              <button 
                onClick={() => handleSelectCourse(course)}
                className="text-xs font-extrabold text-indigo-600 hover:text-violet-700 transition-colors cursor-pointer flex items-center gap-1"
              >
                Access Course <ChevronRight className="w-3.5 h-3.5" />
              </button>
              
              <a 
                href={course.alternateLink} 
                target="_blank" 
                rel="noreferrer"
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
                title="Go to Google Classroom"
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
      <div className="max-w-xl mx-auto bg-white border border-slate-200/60 rounded-[24px] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-extrabold text-base text-slate-800">Launch New Classroom Course</h3>
          <p className="text-slate-500 text-xs mt-0.5">Define a class which will be published instantly as an active course on your Google Classroom account.</p>
        </div>

        <form onSubmit={handleCreateCourse} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Course Name (Required)</label>
            <input 
              type="text" 
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
              placeholder="e.g. Grade 8 Mathematics"
              className="w-full bg-slate-50/50 border border-slate-200 rounded-lg py-1.5 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all h-[38px] font-semibold"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Section / Term</label>
              <input 
                type="text" 
                value={newCourseSection}
                onChange={(e) => setNewCourseSection(e.target.value)}
                placeholder="e.g. Session 2026-27"
                className="w-full bg-slate-50/50 border border-slate-200 rounded-lg py-1.5 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all h-[38px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Room</label>
              <input 
                type="text" 
                value={newCourseRoom}
                onChange={(e) => setNewCourseRoom(e.target.value)}
                placeholder="e.g. Room 102"
                className="w-full bg-slate-50/50 border border-slate-200 rounded-lg py-1.5 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all h-[38px]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Course Description</label>
            <textarea 
              value={newCourseDesc}
              onChange={(e) => setNewCourseDesc(e.target.value)}
              placeholder="Provide a general syllabus or introductory details for enrolled students..."
              className="w-full bg-slate-50/50 border border-slate-200 rounded-lg py-2 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all min-h-[90px] leading-relaxed"
            />
          </div>

          <button 
            type="submit"
            disabled={isCreatingCourse}
            className="w-full flex items-center justify-center gap-2 h-[42px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-500/15 cursor-pointer"
          >
            {isCreatingCourse ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Launching Course...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" /> Deploy Course to Classroom
              </>
            )}
          </button>
        </form>
      </div>
    );
  };

  const renderDetailsTab = () => {
    if (isLoadingDetails) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-2">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-xs font-semibold uppercase tracking-wider">Connecting to Google classroom stream...</p>
        </div>
      );
    }

    if (!selectedCourse) {
      return (
        <div className="text-center py-16 bg-white border border-slate-200/60 rounded-2xl p-6 shadow-xs">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-sm">Failed to Load Course</h3>
          <p className="text-slate-500 text-xs mt-1">We couldn't retrieve the selected Classroom credentials.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Course Banner display */}
        <div className="bg-gradient-to-tr from-indigo-900 to-slate-900 rounded-[24px] p-6 text-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-indigo-800/60 text-[9px] font-extrabold text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-700/50 uppercase tracking-widest">
                Active Classroom
              </span>
              <span className="text-[11px] text-slate-300 font-mono truncate max-w-xs md:max-w-md">ID: {selectedCourse.id}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-display font-black tracking-tight">{selectedCourse.name}</h2>
            {selectedCourse.section && (
              <p className="text-xs text-indigo-200 font-semibold">{selectedCourse.section} {selectedCourse.room ? `• Room ${selectedCourse.room}` : ''}</p>
            )}
            {selectedCourse.descriptionHeading && (
              <p className="text-xs text-slate-300 max-w-3xl leading-relaxed mt-1">{selectedCourse.descriptionHeading}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a 
              href={selectedCourse.alternateLink} 
              target="_blank" 
              rel="noreferrer"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              Google Stream <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button 
              onClick={() => handleSelectCourse(selectedCourse)}
              className="p-2 bg-slate-800/50 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl transition-all cursor-pointer"
              title="Refresh Stream"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Detailed Classroom Sub-Navigation */}
        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
          <button 
            onClick={() => setDetailsSubTab('announcements')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              detailsSubTab === 'announcements' 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Stream Announcements
          </button>
          <button 
            onClick={() => setDetailsSubTab('assignments')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              detailsSubTab === 'assignments' 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Course Assignments
          </button>
          <button 
            onClick={() => setDetailsSubTab('roster')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              detailsSubTab === 'roster' 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            People & Rosters ({studentsList.length + teachersList.length})
          </button>
        </div>

        {/* Details Content Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            
            {/* 1. ANNOUNCEMENTS SUB-TAB */}
            {detailsSubTab === 'announcements' && (
              <div className="space-y-4">
                {/* Announcement publisher */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs space-y-3">
                  <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                    <BellRing className="w-4.5 h-4.5 text-indigo-600" />
                    Share something with your class
                  </h4>
                  <form onSubmit={handlePostAnnouncement} className="space-y-3">
                    <textarea 
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      placeholder="Write announcements, reminders, or messages..."
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all min-h-[80px]"
                      required
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isPostingAnnouncement || !announcementText.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isPostingAnnouncement ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Broadcasting...
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" /> Broadcast to Google
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Announcement list */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1 font-semibold">Broadcast History</h3>
                  
                  {announcements.length === 0 ? (
                    <div className="text-center py-12 bg-white border border-slate-200/60 rounded-2xl text-slate-400 text-xs font-bold">
                      No announcements posted yet in this Google Classroom.
                    </div>
                  ) : (
                    announcements.map((ann) => (
                      <div key={ann.id} className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(ann.creationTime).toLocaleDateString()}
                          </span>
                          <a 
                            href={ann.alternateLink} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-indigo-600 hover:underline flex items-center gap-0.5"
                          >
                            Stream Link <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">{ann.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 2. ASSIGNMENTS SUB-TAB */}
            {detailsSubTab === 'assignments' && (
              <div className="space-y-4">
                {/* Create Assignment Form */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs space-y-4">
                  <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                    <PlusCircle className="w-4.5 h-4.5 text-indigo-600" />
                    Publish Assignment Coursework
                  </h4>
                  
                  <form onSubmit={handleCreateAssignment} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-3 space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Assignment Title</label>
                        <input 
                          type="text" 
                          value={assignmentTitle}
                          onChange={(e) => setAssignmentTitle(e.target.value)}
                          placeholder="e.g. Algebra Homework - Set C"
                          className="w-full bg-slate-50/50 border border-slate-200 rounded-lg py-1.5 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all h-[38px] font-semibold"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Max Points</label>
                        <input 
                          type="number" 
                          value={assignmentPoints}
                          onChange={(e) => setAssignmentPoints(Number(e.target.value))}
                          min={0}
                          max={100}
                          className="w-full bg-slate-50/50 border border-slate-200 rounded-lg py-1.5 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all h-[38px] font-semibold"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Instructions / Requirements</label>
                      <textarea 
                        value={assignmentDesc}
                        onChange={(e) => setAssignmentDesc(e.target.value)}
                        placeholder="Write detailed questions, expectations, and deadlines..."
                        className="w-full bg-slate-50/50 border border-slate-200 rounded-lg py-2 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all min-h-[80px]"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isCreatingAssignment || !assignmentTitle.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isCreatingAssignment ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Publishing...
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" /> Deploy Assignment
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Coursework list */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1 font-semibold">Course Assignments ({coursework.length})</h3>
                  
                  {coursework.length === 0 ? (
                    <div className="text-center py-12 bg-white border border-slate-200/60 rounded-2xl text-slate-400 text-xs font-bold">
                      No active homework assignments found.
                    </div>
                  ) : (
                    coursework.map((work) => (
                      <div key={work.id} className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-2xs space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="bg-emerald-50 text-[10px] text-emerald-600 font-bold px-2 py-0.5 rounded border border-emerald-100">
                                {work.maxPoints ? `${work.maxPoints} Points` : 'No grade scale'}
                              </span>
                              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{work.workType}</span>
                            </div>
                            <h4 className="font-bold text-sm text-slate-800">{work.title}</h4>
                            {work.description && (
                              <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed mt-1.5">{work.description}</p>
                            )}
                          </div>
                          <a 
                            href={work.alternateLink} 
                            target="_blank" 
                            rel="noreferrer"
                            className="p-2 hover:bg-slate-50 text-indigo-600 border border-slate-200/60 rounded-xl transition-all"
                            title="Open Homework in Classroom"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 3. ROSTERS / PEOPLE SUB-TAB */}
            {detailsSubTab === 'roster' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Teachers section */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs space-y-4">
                  <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                    <UserCheck className="w-4.5 h-4.5 text-indigo-600" />
                    Instructors ({teachersList.length})
                  </h4>
                  
                  <div className="divide-y divide-slate-50">
                    {teachersList.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 font-semibold text-xs">No registered teachers.</div>
                    ) : (
                      teachersList.map((t) => (
                        <div key={t.userId} className="flex items-center gap-3 py-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
                            {t.profile.photoUrl ? (
                              <img src={t.profile.photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Users className="w-4 h-4 text-indigo-600" />
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800">{t.profile.name.fullName}</div>
                            {t.profile.emailAddress && (
                              <div className="text-[10px] text-slate-400 font-semibold font-mono">{t.profile.emailAddress}</div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Students section */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex justify-between items-center gap-2">
                    <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                      <Users className="w-4.5 h-4.5 text-indigo-600" />
                      Class Roster ({studentsList.length})
                    </h4>
                  </div>
                  
                  <div className="divide-y divide-slate-50 max-h-[300px] overflow-y-auto pr-1">
                    {studentsList.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 font-semibold text-xs">No students enrolled yet. Share link or join code.</div>
                    ) : (
                      studentsList.map((s) => (
                        <div key={s.userId} className="flex items-center gap-3 py-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
                            {s.profile.photoUrl ? (
                              <img src={s.profile.photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Users className="w-4 h-4 text-indigo-600" />
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800">{s.profile.name.fullName}</div>
                            {s.profile.emailAddress && (
                              <div className="text-[10px] text-slate-400 font-semibold font-mono">{s.profile.emailAddress}</div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Quick Info & Actions Side panel */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-xs p-5 space-y-4">
              <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Roster Actions
              </h4>
              <p className="text-slate-500 text-xs leading-normal">
                Synchronize and reconcile Google Classroom rosters to local student management registers.
              </p>

              <button 
                onClick={handleSyncRosterToPortal}
                disabled={studentsList.length === 0}
                className="w-full px-4 py-2.5 bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 group active:scale-99 hover:scale-[1.01] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                Reconcile Student Log
              </button>
            </div>

            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-xs p-5 space-y-3">
              <h4 className="font-extrabold text-sm text-slate-800">Class Details</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 font-semibold">State</span>
                  <span className="font-bold text-indigo-600 uppercase">{selectedCourse.courseState}</span>
                </div>
                {selectedCourse.teacherGroupEmail && (
                  <div className="space-y-0.5">
                    <span className="text-slate-400 font-semibold block">Teacher Group Email</span>
                    <span className="font-mono text-[10px] text-slate-500 break-all">{selectedCourse.teacherGroupEmail}</span>
                  </div>
                )}
                {selectedCourse.studentGroupEmail && (
                  <div className="space-y-0.5 mt-1">
                    <span className="text-slate-400 font-semibold block">Student Group Email</span>
                    <span className="font-mono text-[10px] text-slate-500 break-all">{selectedCourse.studentGroupEmail}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-24 text-slate-700">
{/* Workspace Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 bg-white border border-slate-200/60 rounded-[24px] shadow-sm">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight">Google Classroom Portal</h1>
            {googleUser && (
              <span className="bg-emerald-50 border border-emerald-200/50 text-emerald-600 text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Linked
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm">Synchronize classes, launch course streams, broadcast announcements, and deploy work on Drive.</p>
        </div>

        {googleUser && (
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/60 px-4 py-1.5 rounded-2xl shadow-2xs">
            <div className="text-right">
              <div className="text-xs font-bold text-slate-800 line-clamp-1">{googleUser.email}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Google Account</div>
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

      {needsAuth ? (
        renderAuthScreen()
      ) : (
        <div className="space-y-6">
          {/* Main workspace navigation tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => {
                  setActiveTab('list');
                  setSelectedCourseId(null);
                  setSelectedCourse(null);
                }}
                className={`px-4 py-2 font-bold text-xs transition-all border-b-2 cursor-pointer ${
                  activeTab === 'list' 
                    ? 'border-indigo-600 text-indigo-600 font-extrabold' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Classrooms Registry
              </button>

              <button 
                onClick={() => {
                  setActiveTab('create');
                  setSelectedCourseId(null);
                  setSelectedCourse(null);
                }}
                className={`px-4 py-2 font-bold text-xs transition-all border-b-2 cursor-pointer ${
                  activeTab === 'create' 
                    ? 'border-indigo-600 text-indigo-600 font-extrabold' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Launch New Class
              </button>

              {activeTab === 'details' && (
                <button 
                  className="px-4 py-2 font-black text-xs transition-all border-b-2 border-indigo-600 text-indigo-600 cursor-pointer"
                >
                  Stream Manager
                </button>
              )}
            </div>

            {activeTab === 'list' && (
              <button 
                onClick={handleRefreshCourses}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Synchronize List
              </button>
            )}
          </div>

          {/* Sub-tab view rendering */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'list' && renderCoursesList()}
            {activeTab === 'create' && renderCreateTab()}
            {activeTab === 'details' && renderDetailsTab()}
          </motion.div>
        </div>
      )}
    </div>
  );
}
