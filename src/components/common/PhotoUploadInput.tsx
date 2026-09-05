import React, { useRef, useState } from 'react';
import { Camera, Upload, Trash2, Loader2, User, CheckCircle2 } from 'lucide-react';
import { uploadEntityPhoto } from '@/lib/photoUpload';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PhotoUploadInputProps {
  value?: string | null;
  onChange: (url: string) => void;
  entityFolder?: 'students' | 'teachers' | 'staff';
  entityId?: string;
  label?: string;
  sublabel?: string;
  shape?: 'rounded' | 'square' | 'circle';
  className?: string;
}

export default function PhotoUploadInput({
  value,
  onChange,
  entityFolder = 'students',
  entityId,
  label = 'Official Passport Photograph',
  sublabel = 'Appears on CBSE Admit Card, Marksheets & ID Cards (JPEG/PNG, max 5MB)',
  shape = 'rounded',
  className
}: PhotoUploadInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPEG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit.');
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading('Processing & uploading photograph...');
    try {
      const { url, stored } = await uploadEntityPhoto(file, entityFolder, entityId);
      onChange(url);
      if (stored) {
        toast.success('Photo uploaded and synchronized successfully!', { id: toastId });
      } else {
        toast.warning('Photo saved, but cloud storage was unreachable — it is embedded directly for now. Try re-uploading later.', { id: toastId });
      }
    } catch (err: any) {
      console.error('[PhotoUploadInput] Error:', err);
      toast.error('Failed to upload photo. Please try another image.', { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast.info('Photo removed.');
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
            {label}
          </label>
          {value && (
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
              <CheckCircle2 size={11} /> Photo Attached
            </span>
          )}
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Photo Container */}
        <div
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "relative w-28 h-32 shrink-0 border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden group bg-slate-50",
            shape === 'circle' ? "rounded-full w-28 h-28" : shape === 'rounded' ? "rounded-2xl" : "rounded-lg",
            isDragging ? "border-violet-500 bg-violet-50/50 scale-[1.02]" : "border-slate-300 hover:border-violet-400 hover:bg-slate-100/80",
            value ? "border-solid border-slate-300" : ""
          )}
        >
          {value ? (
            <>
              <img
                src={value}
                alt="Uploaded passport"
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
              <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white p-1 text-center">
                <Camera size={18} />
                <span className="text-[9px] font-bold">Change Photo</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-2 text-center text-slate-400 group-hover:text-violet-600 transition-colors">
              {isUploading ? (
                <Loader2 size={24} className="animate-spin text-violet-600" />
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-slate-200/80 flex items-center justify-center mb-1 group-hover:bg-violet-100 transition-colors">
                    <User size={20} className="text-slate-500 group-hover:text-violet-600" />
                  </div>
                  <span className="text-[10px] font-bold leading-tight">Upload Photo</span>
                </>
              )}
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-2xs flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-violet-600" />
            </div>
          )}
        </div>

        {/* Action Controls & Instruction */}
        <div className="flex-1 space-y-2 py-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg"
            onChange={onFileInputChange}
            className="hidden"
          />

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {value ? 'Replace Photo' : 'Choose Image File'}
            </button>

            {value && (
              <button
                type="button"
                onClick={handleRemove}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={12} /> Remove
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            {sublabel}
          </p>
        </div>
      </div>
    </div>
  );
}
