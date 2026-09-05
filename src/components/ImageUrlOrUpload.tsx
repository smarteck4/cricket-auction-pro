import { useRef, useState } from 'react';
import { Link as LinkIcon, Upload, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { validateImageFile, uploadPlayerImageToCloudinary } from '@/lib/player-image';

interface ImageUrlOrUploadProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  placeholder?: string;
}

/** URL / Upload toggle that stores uploaded images on Cloudinary. */
export function ImageUrlOrUpload({
  value,
  onChange,
  folder = 'teams',
  placeholder = 'Enter image URL',
}: ImageUrlOrUploadProps) {
  const [mode, setMode] = useState<'url' | 'file'>('url');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    const check = validateImageFile(file);
    if (!check.ok) {
      toast({
        title: check.reason === 'type' ? 'Unsupported image type' : 'Image too large',
        description: check.reason === 'type' ? 'Use JPG, PNG, WEBP or GIF.' : 'Maximum size is 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const uploaded = await uploadPlayerImageToCloudinary(supabase, dataUrl, folder);
      if (!uploaded) {
        toast({ title: 'Upload failed', description: 'Please try again.', variant: 'destructive' });
        return;
      }
      onChange(uploaded.url);
      toast({ title: 'Image uploaded!' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === 'url' ? 'default' : 'outline'}
          onClick={() => setMode('url')}
          className="flex-1"
        >
          <LinkIcon className="w-4 h-4 mr-2" />URL
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === 'file' ? 'default' : 'outline'}
          onClick={() => setMode('file')}
          className="flex-1"
        >
          <Upload className="w-4 h-4 mr-2" />Upload
        </Button>
      </div>

      {mode === 'url' ? (
        <Input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <div>
          <Input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          {uploading && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
            </p>
          )}
        </div>
      )}

      {value && (
        <div className="flex items-center gap-2">
          <img src={value} alt="Preview" className="w-12 h-12 rounded-full object-cover border border-border" />
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange('')}>
            <X className="w-3 h-3 mr-1" />Remove
          </Button>
        </div>
      )}
    </div>
  );
}
