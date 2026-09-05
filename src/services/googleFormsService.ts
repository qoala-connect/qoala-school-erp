import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App only if it hasn't been initialized already
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Configure Google OAuth provider with required Google Forms & Drive scopes
export const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/forms.body');
provider.addScope('https://www.googleapis.com/auth/forms.responses.readonly');

// In-memory token cache (never persisted in localStorage/sessionStorage for security)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize auth state listener. Must be called on page/app load.
export const initGoogleAuth = (
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
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
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
export const googleLogout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// ============================================================================
// GOOGLE DRIVE & GOOGLE FORMS API CALLS
// ============================================================================

export interface GoogleDriveFile {
  id: string;
  name: string;
  webViewLink: string;
  createdTime: string;
  modifiedTime: string;
}

export interface GoogleFormDetails {
  formId: string;
  info: {
    title: string;
    description?: string;
    documentTitle: string;
  };
  responderUri: string;
  items?: Array<{
    itemId: string;
    title?: string;
    description?: string;
    questionItem?: {
      question: {
        questionId: string;
        required?: boolean;
        textQuestion?: any;
        choiceQuestion?: {
          type: 'RADIO' | 'CHECKBOX' | 'DROP_DOWN';
          options: Array<{ value: string }>;
        };
      };
    };
  }>;
}

export interface GoogleFormResponse {
  responseId: string;
  createTime: string;
  lastSubmittedTime: string;
  answers: {
    [questionId: string]: {
      questionId: string;
      textAnswers: {
        answers: Array<{ value: string }>;
      };
    };
  };
}

/**
 * List recent Google Forms from Google Drive
 */
export const listGoogleForms = async (token: string): Promise<GoogleDriveFile[]> => {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.form' and trashed=false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink,createdTime,modifiedTime)&pageSize=30&orderBy=modifiedTime desc`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to list forms from Google Drive: ${response.status}`);
  }

  const data = await response.json();
  return data.files || [];
};

/**
 * Fetch detailed configuration and questions of a single Google Form
 */
export const getGoogleFormDetails = async (token: string, formId: string): Promise<GoogleFormDetails> => {
  const url = `https://forms.googleapis.com/v1/forms/${formId}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to fetch Google Form details: ${response.status}`);
  }

  return response.json();
};

/**
 * Fetch responses submitted to a specific Google Form
 */
export const getGoogleFormResponses = async (token: string, formId: string): Promise<GoogleFormResponse[]> => {
  const url = `https://forms.googleapis.com/v1/forms/${formId}/responses`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  // If there are no responses yet, the API might return 404 or empty. Handle it gracefully.
  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to fetch Google Form responses: ${response.status}`);
  }

  const data = await response.json();
  return data.responses || [];
};

/**
 * Create a brand new Google Form
 */
export const createGoogleForm = async (token: string, title: string, description: string): Promise<GoogleFormDetails> => {
  const url = `https://forms.googleapis.com/v1/forms`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title,
        documentTitle: title,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create Google Form: ${response.status}`);
  }

  const createdForm: GoogleFormDetails = await response.json();

  // If a description was provided, let's update the form description via batchUpdate
  if (description) {
    await updateFormMetadata(token, createdForm.formId, description);
    createdForm.info.description = description;
  }

  return createdForm;
};

/**
 * Update Form description or meta
 */
const updateFormMetadata = async (token: string, formId: string, description: string): Promise<void> => {
  const url = `https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`;
  await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          updateFormInfo: {
            info: {
              description,
            },
            updateMask: 'description',
          },
        },
      ],
    }),
  });
};

/**
 * Add pre-defined questions based on selected school template
 */
export const populateFormTemplate = async (
  token: string, 
  formId: string, 
  templateType: 'feedback' | 'admission' | 'event'
): Promise<void> => {
  const url = `https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`;
  
  let requests: any[] = [];

  if (templateType === 'feedback') {
    requests = [
      {
        createItem: {
          item: {
            title: "Parent Name",
            description: "Please enter your full name.",
            questionItem: {
              question: {
                required: true,
                textQuestion: {}
              }
            }
          },
          location: { index: 0 }
        }
      },
      {
        createItem: {
          item: {
            title: "Student Name & Class",
            description: "Example: Sachin - Nursery A",
            questionItem: {
              question: {
                required: true,
                textQuestion: {}
              }
            }
          },
          location: { index: 1 }
        }
      },
      {
        createItem: {
          item: {
            title: "Overall satisfaction with Academic Standard",
            questionItem: {
              question: {
                required: true,
                choiceQuestion: {
                  type: 'RADIO',
                  options: [
                    { value: "5 - Extremely Satisfied" },
                    { value: "4 - Very Satisfied" },
                    { value: "3 - Satisfied" },
                    { value: "2 - Somewhat Satisfied" },
                    { value: "1 - Not Satisfied" }
                  ]
                }
              }
            }
          },
          location: { index: 2 }
        }
      },
      {
        createItem: {
          item: {
            title: "Satisfaction with School Fees & Facilities",
            questionItem: {
              question: {
                required: true,
                choiceQuestion: {
                  type: 'RADIO',
                  options: [
                    { value: "Highly Satisfied" },
                    { value: "Reasonable & Fair" },
                    { value: "Needs Improvement" }
                  ]
                }
              }
            }
          },
          location: { index: 3 }
        }
      },
      {
        createItem: {
          item: {
            title: "Suggestions or Comments for Improvement",
            questionItem: {
              question: {
                textQuestion: { paragraph: true }
              }
            }
          },
          location: { index: 4 }
        }
      }
    ];
  } else if (templateType === 'admission') {
    requests = [
      {
        createItem: {
          item: {
            title: "Student Full Name",
            questionItem: {
              question: {
                required: true,
                textQuestion: {}
              }
            }
          },
          location: { index: 0 }
        }
      },
      {
        createItem: {
          item: {
            title: "Target Class for Admission",
            questionItem: {
              question: {
                required: true,
                choiceQuestion: {
                  type: 'DROP_DOWN',
                  options: [
                    { value: "PlayGroup" },
                    { value: "Pre Nursery" },
                    { value: "Nursery" },
                    { value: "LKG" },
                    { value: "UKG" }
                  ]
                }
              }
            }
          },
          location: { index: 1 }
        }
      },
      {
        createItem: {
          item: {
            title: "Parent / Guardian Contact Number",
            questionItem: {
              question: {
                required: true,
                textQuestion: {}
              }
            }
          },
          location: { index: 2 }
        }
      },
      {
        createItem: {
          item: {
            title: "Previous School Attended (If Any)",
            questionItem: {
              question: {
                textQuestion: {}
              }
            }
          },
          location: { index: 3 }
        }
      },
      {
        createItem: {
          item: {
            title: "Any Specific Medical or Learning Needs?",
            questionItem: {
              question: {
                textQuestion: { paragraph: true }
              }
            }
          },
          location: { index: 4 }
        }
      }
    ];
  } else if (templateType === 'event') {
    requests = [
      {
        createItem: {
          item: {
            title: "Student Roll Number",
            questionItem: {
              question: {
                required: true,
                textQuestion: {}
              }
            }
          },
          location: { index: 0 }
        }
      },
      {
        createItem: {
          item: {
            title: "Student Name",
            questionItem: {
              question: {
                required: true,
                textQuestion: {}
              }
            }
          },
          location: { index: 1 }
        }
      },
      {
        createItem: {
          item: {
            title: "Event / Competition to Participate",
            questionItem: {
              question: {
                required: true,
                choiceQuestion: {
                  type: 'CHECKBOX',
                  options: [
                    { value: "Annual Sports Meet 2026" },
                    { value: "Science & Art Exhibition" },
                    { value: "Independence Day Cultural Dance" },
                    { value: "Inter-Class Debate Competition" }
                  ]
                }
              }
            }
          },
          location: { index: 2 }
        }
      },
      {
        createItem: {
          item: {
            title: "Requires Transportation Support?",
            questionItem: {
              question: {
                required: true,
                choiceQuestion: {
                  type: 'RADIO',
                  options: [
                    { value: "Yes" },
                    { value: "No" }
                  ]
                }
              }
            }
          },
          location: { index: 3 }
        }
      }
    ];
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to populate form template: ${response.status}`);
  }
};
