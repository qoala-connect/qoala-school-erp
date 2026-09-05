import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App only if it hasn't been initialized already
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Configure Google OAuth provider with required Classroom scopes
export const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/classroom.courses');
provider.addScope('https://www.googleapis.com/auth/classroom.coursework.students');
provider.addScope('https://www.googleapis.com/auth/classroom.announcements');
provider.addScope('https://www.googleapis.com/auth/classroom.rosters.readonly');
provider.addScope('https://www.googleapis.com/auth/classroom.profile.emails');

// In-memory token cache (never persisted in localStorage/sessionStorage for security)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize auth state listener. Must be called on page/app load.
export const initGoogleClassroomAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Initiate Google Sign-In popup to fetch credentials and Access Token
export const googleClassroomSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google Auth');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Retrieve currently cached access token
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

// Handle Google Logout
export const googleClassroomLogout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// ============================================================================
// GOOGLE CLASSROOM API CALLS
// ============================================================================

export interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  room?: string;
  ownerId: string;
  creationTime: string;
  alternateLink: string;
  courseState: string;
  teacherGroupEmail?: string;
  studentGroupEmail?: string;
}

export interface ClassroomRosterUser {
  courseId: string;
  userId: string;
  profile: {
    id: string;
    name: {
      fullName: string;
      givenName?: string;
      familyName?: string;
    };
    emailAddress?: string;
    photoUrl?: string;
  };
}

export interface ClassroomAnnouncement {
  id: string;
  courseId: string;
  text: string;
  alternateLink: string;
  creationTime: string;
  state: string;
}

export interface ClassroomCourseWork {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  alternateLink: string;
  creationTime: string;
  maxPoints?: number;
  workType: 'ASSIGNMENT' | 'SHORT_ANSWER_QUESTION' | 'MULTIPLE_CHOICE_QUESTION';
  state: string;
  dueDate?: {
    year: number;
    month: number;
    day: number;
  };
  dueTime?: {
    hours: number;
    minutes: number;
  };
}

/**
 * List Classroom Courses (Active & Enrolled/Taught)
 */
export const listClassroomCourses = async (token: string): Promise<ClassroomCourse[]> => {
  const url = `https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to list classroom courses: ${response.status}`);
  }

  const data = await response.json();
  return data.courses || [];
};

/**
 * Fetch detailed roster of students enrolled in a Google Classroom
 */
export const listClassroomStudents = async (token: string, courseId: string): Promise<ClassroomRosterUser[]> => {
  const url = `https://classroom.googleapis.com/v1/courses/${courseId}/students`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (response.status === 404 || response.status === 403) {
    return []; // No student rosters or access denied gracefully
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to list classroom students: ${response.status}`);
  }

  const data = await response.json();
  return data.students || [];
};

/**
 * Fetch detailed roster of teachers in a Google Classroom
 */
export const listClassroomTeachers = async (token: string, courseId: string): Promise<ClassroomRosterUser[]> => {
  const url = `https://classroom.googleapis.com/v1/courses/${courseId}/teachers`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (response.status === 404 || response.status === 403) {
    return [];
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to list classroom teachers: ${response.status}`);
  }

  const data = await response.json();
  return data.teachers || [];
};

/**
 * Fetch announcements in a Google Classroom course
 */
export const listClassroomAnnouncements = async (token: string, courseId: string): Promise<ClassroomAnnouncement[]> => {
  const url = `https://classroom.googleapis.com/v1/courses/${courseId}/announcements`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to list classroom announcements: ${response.status}`);
  }

  const data = await response.json();
  return data.announcements || [];
};

/**
 * Fetch assignments / coursework in a Google Classroom course
 */
export const listClassroomCourseWork = async (token: string, courseId: string): Promise<ClassroomCourseWork[]> => {
  const url = `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to list classroom coursework: ${response.status}`);
  }

  const data = await response.json();
  return data.courseWork || [];
};

/**
 * Create a new Google Classroom Course
 */
export const createClassroomCourse = async (
  token: string,
  name: string,
  section?: string,
  room?: string,
  descriptionHeading?: string
): Promise<ClassroomCourse> => {
  const url = `https://classroom.googleapis.com/v1/courses`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      name,
      section,
      room,
      descriptionHeading,
      ownerId: 'me',
      courseState: 'ACTIVE',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create classroom course: ${response.status}`);
  }

  return response.json();
};

/**
 * Create a coursework item (Assignment) inside a Google Classroom course
 */
export const createClassroomAssignment = async (
  token: string,
  courseId: string,
  title: string,
  description?: string,
  maxPoints?: number
): Promise<ClassroomCourseWork> => {
  const url = `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      title,
      description,
      workType: 'ASSIGNMENT',
      status: 'PUBLISHED',
      maxPoints: maxPoints || 100,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create assignment coursework: ${response.status}`);
  }

  return response.json();
};

/**
 * Create an announcement inside a Google Classroom course
 */
export const createClassroomAnnouncement = async (
  token: string,
  courseId: string,
  text: string
): Promise<ClassroomAnnouncement> => {
  const url = `https://classroom.googleapis.com/v1/courses/${courseId}/announcements`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      text,
      state: 'PUBLISHED',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create classroom announcement: ${response.status}`);
  }

  return response.json();
};
