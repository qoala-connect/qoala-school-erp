import { supabase } from './supabase';

/**
 * Compresses and resizes an image file to standard passport/avatar dimensions (max 600x600)
 * Returns a high quality JPEG Blob and base64 fallback.
 */
export async function processImageFile(file: File, maxWidth = 600, maxHeight = 600): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        // Fill white background for transparent PNGs
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl });
            } else {
              resolve({ blob: file, dataUrl });
            }
          },
          'image/jpeg',
          0.88
        );
      };
      img.onerror = () => reject(new Error('Failed to load image for processing'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export interface PhotoUploadResult {
  url: string;
  /** false when the upload fell back to an embedded data URL instead of reaching Storage. */
  stored: boolean;
}

/**
 * Uploads a student or teacher photo to Supabase storage bucket `student-photos`
 * with automatic fallback to data URL if storage upload is unavailable.
 */
export async function uploadEntityPhoto(
  file: File,
  folder: 'students' | 'teachers' | 'staff' = 'students',
  entityId?: string
): Promise<PhotoUploadResult> {
  const { blob, dataUrl } = await processImageFile(file);
  const cleanId = entityId ? entityId.replace(/[^a-zA-Z0-9_-]/g, '') : 'new';
  const fileName = `${folder}/${cleanId}_${Date.now()}.jpg`;

  try {
    const { data, error } = await supabase.storage
      .from('student-photos')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600'
      });

    if (error) {
      console.warn('[PhotoUpload] Supabase bucket upload failed, using dataUrl fallback:', error.message);
      return { url: dataUrl, stored: false };
    }

    const { data: publicData } = supabase.storage
      .from('student-photos')
      .getPublicUrl(fileName);

    return publicData.publicUrl
      ? { url: publicData.publicUrl, stored: true }
      : { url: dataUrl, stored: false };
  } catch (err) {
    console.warn('[PhotoUpload] Exception during storage upload, using dataUrl fallback:', err);
    return { url: dataUrl, stored: false };
  }
}
