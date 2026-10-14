import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageUrlOrUpload } from '@/components/ImageUrlOrUpload';
import { useSponsors } from '@/components/SponsorsMarquee';
import { Megaphone, Plus, Trash2 } from 'lucide-react';

/** Admin card to add/remove sponsor logos for the live auction marquee. */
export function SponsorsManager({ className = '' }: { className?: string }) {
  const { sponsors, reload } = useSponsors();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [logo, setLogo] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!name.trim() || !logo.trim()) {
      toast({ title: 'Missing info', description: 'Add a sponsor name and logo.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('sponsors')
      .insert({ name: name.trim(), logo_url: logo.trim(), sort_order: sponsors.length });
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setName('');
    setLogo('');
    reload();
    toast({ title: 'Sponsor added', description: 'It now scrolls on the live auction screen.' });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('sponsors').delete().eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else reload();
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Megaphone className="h-5 w-5 text-primary" /> Sponsors
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <Label>Sponsor name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pepsi" />
          </div>
          <div>
            <Label>Logo</Label>
            <ImageUrlOrUpload value={logo} onChange={setLogo} folder="sponsors" placeholder="Logo image URL" />
          </div>
          <Button onClick={add} disabled={saving} className="w-full gap-2">
            <Plus className="h-4 w-4" /> Add sponsor
          </Button>
        </div>
        {sponsors.length > 0 && (
          <div className="divide-y divide-border/40 rounded-lg border border-border/40">
            {sponsors.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2">
                <img src={s.logo_url} alt={s.name} className="h-8 w-12 object-contain" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
                <Button size="icon" variant="ghost" onClick={() => remove(s.id)} aria-label={`Remove ${s.name}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
