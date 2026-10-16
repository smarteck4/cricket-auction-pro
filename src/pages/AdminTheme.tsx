import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ImageUrlOrUpload } from '@/components/ImageUrlOrUpload';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FONT_OPTIONS, SiteSettings, useSiteSettings } from '@/hooks/useSiteSettings';
import { ArrowLeft, RotateCcw, Save } from 'lucide-react';

const DEFAULT = 'default';

export default function AdminTheme() {
  const { settings, reload } = useSiteSettings();
  const { toast } = useToast();
  const [form, setForm] = useState<SiteSettings>(settings);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(settings), [settings]);
  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => setForm(f => ({ ...f, [k]: v }));

  const save = async (values: SiteSettings) => {
    setSaving(true);
    const { error } = await supabase.from('site_settings').update({ ...values, updated_at: new Date().toISOString() }).eq('id', true);
    setSaving(false);
    if (error) return toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
    await reload();
    toast({ title: 'Theme updated', description: 'The whole website now uses these settings.' });
  };

  const fontSelect = (k: 'font_family' | 'heading_font', label: string) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={form[k] ?? DEFAULT} onValueChange={v => set(k, v === DEFAULT ? null : v)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT}>Default</SelectItem>
          {FONT_OPTIONS.map(f => <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  const colorInput = (k: 'text_color' | 'primary_color', label: string) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <input type="color" value={form[k] ?? '#000000'} onChange={e => set(k, e.target.value)} className="h-10 w-14 cursor-pointer rounded-md border border-input bg-transparent" />
        <Input value={form[k] ?? ''} placeholder="Default" onChange={e => set(k, e.target.value || null)} />
        {form[k] && <Button variant="ghost" size="icon" onClick={() => set(k, null)} title="Reset"><RotateCcw className="h-4 w-4" /></Button>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-3xl px-3 py-6 sm:px-6 sm:py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Website Theme</h1>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1.5" />Admin Panel</Link>
          </Button>
        </div>

        <Card className="card-shadow">
          <CardHeader><CardTitle>Logo & name</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Website name</Label>
              <Input value={form.site_name ?? ''} placeholder="CricBid" onChange={e => set('site_name', e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label>Website logo</Label>
              <ImageUrlOrUpload value={form.logo_url ?? ''} onChange={v => set('logo_url', v || null)} folder="branding" placeholder="Logo image URL" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-shadow">
          <CardHeader><CardTitle>Fonts & colours</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {fontSelect('font_family', 'Body font')}
            {fontSelect('heading_font', 'Heading font')}
            {colorInput('text_color', 'Text colour')}
            {colorInput('primary_color', 'Main accent colour')}
            <div className="space-y-3 sm:col-span-2">
              <Label>Font size: {form.font_size ?? 16}px {form.font_size ? '' : '(default)'}</Label>
              <Slider min={12} max={22} step={1} value={[form.font_size ?? 16]} onValueChange={([v]) => set('font_size', v)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-1" style={{ fontFamily: form.font_family ?? undefined, color: form.text_color ?? undefined, fontSize: form.font_size ?? undefined }}>
            <p className="text-xs uppercase text-muted-foreground">Preview</p>
            <p className="text-2xl font-bold" style={{ fontFamily: form.heading_font ?? undefined, color: form.primary_color ?? undefined }}>Live Auction Tonight</p>
            <p>Sample body text to preview your font and colour.</p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={saving} onClick={() => save({ font_family: null, heading_font: null, text_color: null, primary_color: null, font_size: null, site_name: null, logo_url: null })}>
            <RotateCcw className="h-4 w-4 mr-1.5" />Reset all to default
          </Button>
          <Button disabled={saving} onClick={() => save(form)}><Save className="h-4 w-4 mr-1.5" />{saving ? 'Saving…' : 'Save theme'}</Button>
        </div>
      </main>
    </div>
  );
}
