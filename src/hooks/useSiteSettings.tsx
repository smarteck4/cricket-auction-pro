import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SiteSettings {
  font_family: string | null;
  heading_font: string | null;
  text_color: string | null;
  primary_color: string | null;
  font_size: number | null;
  site_name: string | null;
  logo_url: string | null;
}

export const FONT_OPTIONS = [
  'Space Grotesk', 'Hind', 'Outfit', 'Archivo Black', 'Poppins', 'Roboto', 'Montserrat',
  'Lato', 'Open Sans', 'Oswald', 'Rubik', 'Barlow', 'Bebas Neue', 'Teko', 'Nunito', 'Noto Nastaliq Urdu',
];

const EMPTY: SiteSettings = { font_family: null, heading_font: null, text_color: null, primary_color: null, font_size: null, site_name: null, logo_url: null };

/** "#rrggbb" -> "h s% l%" (shadcn token format). */
export function hexToHslToken(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function loadFont(name: string) {
  const id = `gf-${name.replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

function applySettings(s: SiteSettings) {
  let css = '';
  if (s.font_family) { loadFont(s.font_family); css += `body, .font-sans, .font-body { font-family: '${s.font_family}', ui-sans-serif, system-ui, sans-serif !important; }\n`; }
  if (s.heading_font) { loadFont(s.heading_font); css += `h1, h2, h3, h4, .font-display, .font-heading { font-family: '${s.heading_font}', ui-sans-serif, system-ui, sans-serif !important; }\n`; }
  const fg = s.text_color && hexToHslToken(s.text_color);
  const pr = s.primary_color && hexToHslToken(s.primary_color);
  if (fg || pr) css += `:root, .dark { ${fg ? `--foreground: ${fg}; --card-foreground: ${fg};` : ''} ${pr ? `--primary: ${pr}; --ring: ${pr};` : ''} }\n`;
  if (s.font_size) css += `html { font-size: ${s.font_size}px; }\n`;
  let tag = document.getElementById('site-theme-overrides');
  if (!tag) { tag = document.createElement('style'); tag.id = 'site-theme-overrides'; document.head.appendChild(tag); }
  tag.textContent = css;
  if (s.site_name) document.title = s.site_name;
}

const Ctx = createContext<{ settings: SiteSettings; reload: () => Promise<void> }>({ settings: EMPTY, reload: async () => {} });

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(EMPTY);
  const reload = async () => {
    const { data } = await supabase.from('site_settings').select('*').maybeSingle();
    const next = { ...EMPTY, ...(data || {}) } as SiteSettings;
    setSettings(next);
    applySettings(next);
  };
  useEffect(() => {
    reload();
    const ch = supabase.channel('site-settings').on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, reload).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  return <Ctx.Provider value={{ settings, reload }}>{children}</Ctx.Provider>;
}

export const useSiteSettings = () => useContext(Ctx);
