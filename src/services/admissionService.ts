import { supabase } from '@/lib/supabase';
import { AdmissionRecord, CreateAdmissionInput, AdmissionStatus, AdmissionDocument } from '@/types/admission';

// Only send columns that exist on the admissions table — PostgREST rejects
// the whole request if any key is unknown ("column not found in schema cache").
const ADMISSION_COLUMNS = new Set([
  'application_number', 'name', 'father_name', 'mother_name', 'date_of_birth', 'gender',
  'class', 'class_id', 'section', 'section_id', 'academic_year', 'academic_year_id',
  'phone', 'email', 'address', 'photo_url', 'aadhaar_last4', 'category',
  'cwsn_status', 'only_child_girl', 'previous_school', 'previous_class', 'previous_marks',
  'transfer_certificate_no', 'blood_group', 'emergency_contact', 'religion', 'nationality',
  'father_occupation', 'mother_occupation', 'documents', 'notes', 'status',
]);

export interface AdmissionFilters {
  search?: string;
  classFilter?: string;
  statusFilter?: string;
  academicYearFilter?: string;
  sectionFilter?: string;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

export const admissionService = {
  /**
   * Fetch all admissions with optional filtering and relation joins
   */
  async fetchAdmissions(filters?: AdmissionFilters): Promise<AdmissionRecord[]> {
    let query = supabase
      .from('admissions')
      .select(`
        *,
        students:student_id (
          id,
          admission_number,
          roll_number,
          class,
          section,
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (filters?.statusFilter && filters.statusFilter !== 'all') {
      query = query.eq('status', filters.statusFilter);
    }

    if (filters?.academicYearFilter && filters.academicYearFilter !== 'all') {
      query = query.eq('academic_year', filters.academicYearFilter);
    }

    if (filters?.classFilter && filters.classFilter !== 'all') {
      const cls = filters.classFilter;
      query = query.or(`class.eq.${cls},class.ilike.%${cls}%`);
    }

    if (filters?.sectionFilter && filters.sectionFilter !== 'all') {
      query = query.eq('section', filters.sectionFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[admissionService.fetchAdmissions] Error:', error);
      throw error;
    }

    let records = (data || []) as AdmissionRecord[];

    // Client-side search for multi-field precision
    if (filters?.search && filters.search.trim()) {
      const s = filters.search.toLowerCase().trim();
      records = records.filter(r => 
        (r.name && r.name.toLowerCase().includes(s)) ||
        (r.application_number && r.application_number.toLowerCase().includes(s)) ||
        (r.father_name && r.father_name.toLowerCase().includes(s)) ||
        (r.mother_name && r.mother_name.toLowerCase().includes(s)) ||
        (r.phone && r.phone.includes(s)) ||
        (r.email && r.email.toLowerCase().includes(s))
      );
    }

    return records;
  },

  /**
   * Fetch a single admission by ID
   */
  async fetchAdmissionById(id: string): Promise<AdmissionRecord | null> {
    const { data, error } = await supabase
      .from('admissions')
      .select(`
        *,
        students:student_id (
          id,
          admission_number,
          roll_number,
          class,
          section,
          name
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[admissionService.fetchAdmissionById] Error:', error);
      throw error;
    }

    return data as AdmissionRecord | null;
  },

  /**
   * Load active classes, sections, and academic years
   */
  async fetchReferenceData() {
    const [classesRes, sectionsRes, yearsRes] = await Promise.all([
      supabase.from('classes').select('id, class_name').order('class_name'),
      supabase.from('sections').select('id, section_name, capacity').order('section_name'),
      supabase.from('academic_years').select('id, name, is_current, start_date, end_date').order('start_date', { ascending: false }),
    ]);

    if (classesRes.error) console.error('Error loading classes:', classesRes.error.message);
    if (sectionsRes.error) console.error('Error loading sections:', sectionsRes.error.message);
    if (yearsRes.error) console.error('Error loading academic years:', yearsRes.error.message);

    return {
      classes: classesRes.data || [],
      sections: sectionsRes.data || [],
      academicYears: yearsRes.data || [],
    };
  },

  /**
   * Create a new admission application
   */
  async createAdmission(input: CreateAdmissionInput): Promise<AdmissionRecord> {
    // Generate official application number: SJS/ADM/YYYY-YY/XXXX
    const yearCode = input.academic_year || '2026-27';
    const randSeq = Math.floor(1000 + Math.random() * 9000);
    const appNum = `SJS/ADM/${yearCode}/${randSeq}`;

    // Standard document checklist initial state
    const defaultDocs: AdmissionDocument[] = input.documents && input.documents.length > 0 ? input.documents : [
      { id: 'doc-1', name: 'Birth Certificate', type: 'Certificate', status: 'Pending' },
      { id: 'doc-2', name: 'Transfer Certificate (TC)', type: 'Academic', status: 'Pending' },
      { id: 'doc-3', name: 'Previous School Marksheet', type: 'Academic', status: 'Pending' },
      { id: 'doc-4', name: 'Aadhaar Card / ID Proof', type: 'Identification', status: input.aadhaar_last4 ? 'Verified' : 'Pending' },
      { id: 'doc-5', name: 'Passport Size Photograph', type: 'Photo', status: input.photo_url ? 'Verified' : 'Pending', url: input.photo_url },
    ];

    const payload = {
      application_number: appNum,
      name: input.name.trim(),
      father_name: input.father_name.trim(),
      mother_name: input.mother_name ? input.mother_name.trim() : null,
      date_of_birth: input.date_of_birth,
      gender: input.gender || 'male',
      class: input.class,
      class_id: input.class_id || null,
      section: input.section || 'A',
      section_id: input.section_id || null,
      academic_year: input.academic_year || '2026-27',
      academic_year_id: input.academic_year_id || null,
      phone: input.phone ? input.phone.trim() : null,
      email: input.email ? input.email.trim() : null,
      address: input.address ? input.address.trim() : null,
      photo_url: input.photo_url || null,
      aadhaar_last4: input.aadhaar_last4 || null,
      category: input.category || 'General',
      cwsn_status: input.cwsn_status || false,
      only_child_girl: input.only_child_girl || false,
      previous_school: input.previous_school ? input.previous_school.trim() : null,
      previous_class: input.previous_class ? input.previous_class.trim() : null,
      previous_marks: input.previous_marks ? input.previous_marks.trim() : null,
      transfer_certificate_no: input.transfer_certificate_no ? input.transfer_certificate_no.trim() : null,
      blood_group: input.blood_group || null,
      emergency_contact: input.emergency_contact || null,
      religion: input.religion || null,
      nationality: input.nationality || 'Indian',
      father_occupation: input.father_occupation || null,
      mother_occupation: input.mother_occupation || null,
      documents: defaultDocs,
      notes: input.notes || null,
      status: input.status || 'Pending',
    };

    const safePayload = Object.fromEntries(
      Object.entries(payload).filter(([key]) => ADMISSION_COLUMNS.has(key))
    );

    const { data, error } = await supabase
      .from('admissions')
      .insert([safePayload])
      .select()
      .single();

    if (error) {
      console.error('[admissionService.createAdmission] Insert error:', error);
      throw error;
    }

    return data as AdmissionRecord;
  },

  /**
   * Update an existing admission record
   */
  async updateAdmission(id: string, updates: Partial<AdmissionRecord>): Promise<AdmissionRecord> {
    const safeUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => ADMISSION_COLUMNS.has(key))
    );

    try {
      const { data, error } = await supabase
        .from('admissions')
        .update({
          ...safeUpdates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        return data as AdmissionRecord;
      }
      if (error) throw error;
    } catch (err) {
      console.warn('[admissionService.updateAdmission] Direct update failed, attempting server fallback:', err);
    }

    // Resilient server-side fallback
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/admissions/${id}/update`, {
      method: 'POST',
      headers,
      body: JSON.stringify(safeUpdates)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to update admission');
    }

    return await res.json();
  },

  /**
   * Update status transition
   */
  async updateStatus(id: string, status: AdmissionStatus, notes?: string): Promise<void> {
    const payload: any = { status, updated_at: new Date().toISOString() };
    if (notes) payload.notes = notes;

    await this.updateAdmission(id, payload);
  },

  /**
   * Approve admission atomically via PostgreSQL RPC with server fallback
   */
  async approveAdmission(admissionId: string, sectionName?: string, rollNumber?: string | null) {
    try {
      const { data, error } = await supabase.rpc('approve_admission', {
        _admission_id: admissionId,
        _section_name: sectionName || 'A',
        _roll_number: rollNumber || null,
      });

      if (!error && data) {
        const res = Array.isArray(data) ? data[0] : data;
        return res;
      }
      if (error) throw error;
    } catch (err: any) {
      console.warn('[admissionService.approveAdmission] RPC error, trying server fallback:', err);
      
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admissions/${admissionId}/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          section_name: sectionName || 'A',
          roll_number: rollNumber || null
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || err.message || 'Failed to approve admission');
      }

      return await res.json();
    }
  },

  /**
   * Reject admission with required reason via PostgreSQL RPC
   */
  async rejectAdmission(admissionId: string, reason: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('reject_admission', {
      _admission_id: admissionId,
      _reason: reason,
    });

    if (error) {
      console.error('[admissionService.rejectAdmission] RPC Error:', error);
      throw error;
    }

    return !!data;
  },

  /**
   * Verify or reject a specific document inside the application documents JSONB
   * Uses atomic PostgreSQL RPC with resilient server API fallback
   */
  async updateDocumentVerification(
    admissionId: string,
    documentId: string,
    status: 'Verified' | 'Rejected' | 'Pending',
    remarks?: string
  ): Promise<AdmissionRecord> {
    // 1. Try atomic PostgreSQL RPC (POST /rpc/verify_admission_document)
    try {
      const { data, error } = await supabase.rpc('verify_admission_document', {
        _admission_id: admissionId,
        _document_id: documentId,
        _status: status,
        _remarks: remarks || null
      });

      if (!error && data) {
        return data as AdmissionRecord;
      }
      if (error) throw error;
    } catch (rpcErr) {
      console.warn('[admissionService.updateDocumentVerification] RPC failed, trying server API:', rpcErr);
    }

    // 2. Try Server API endpoint (/api/admissions/:id/verify-document)
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admissions/${admissionId}/verify-document`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          document_id: documentId,
          status,
          remarks
        })
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (apiErr) {
      console.warn('[admissionService.updateDocumentVerification] Server API failed, trying client merge:', apiErr);
    }

    // 3. Fallback: Client-side JSON array merge + update
    const admission = await this.fetchAdmissionById(admissionId);
    if (!admission) throw new Error('Admission record not found');

    const currentDocs: AdmissionDocument[] = admission.documents || [];
    const updatedDocs = currentDocs.map(doc => {
      if (doc.id === documentId) {
        return {
          ...doc,
          status,
          remarks: remarks || doc.remarks,
          verified_at: new Date().toISOString(),
          verified_by: 'Admissions Office',
        };
      }
      return doc;
    });

    return await this.updateAdmission(admissionId, { documents: updatedDocs });
  },

  /**
   * Delete an unapproved admission record
   */
  async deleteAdmission(id: string): Promise<void> {
    const { error } = await supabase
      .from('admissions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[admissionService.deleteAdmission] Error:', error);
      throw error;
    }
  }
};
