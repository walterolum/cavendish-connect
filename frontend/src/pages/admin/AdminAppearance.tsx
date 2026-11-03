import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FiAlertTriangle, FiCheck, FiImage, FiRotateCcw, FiSave, FiTrash2, FiUpload } from 'react-icons/fi';
import { adminApi } from '../../services/admin.service';
import { api, getErrorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { DEFAULT_BRAND } from '../../lib/settings';
import { cn } from '../../lib/utils';
import { PageHeader } from '../../components/ui/page';
import { Card, CardBody, CardHeader } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Field, Input, Textarea } from '../../components/ui/input';
import { ErrorState, Skeleton } from '../../components/ui/loading';
import { ApiResponse } from '../../types';

/** Every setting this page edits, with its default (used by "Reset"). */
const KEYS = {
  appName: ['platform.name', DEFAULT_BRAND.appName],
  tagline: ['platform.tagline', DEFAULT_BRAND.tagline],
  universityName: ['brand.university_name', DEFAULT_BRAND.universityName],
  universityShort: ['brand.university_short', DEFAULT_BRAND.universityShort],
  location: ['brand.location', DEFAULT_BRAND.location],
  primary: ['brand.primary_color', DEFAULT_BRAND.primaryColor],
  accent: ['brand.accent_color', DEFAULT_BRAND.accentColor],
  logo: ['brand.logo_url', ''],
  heroMarket: ['brand.hero_market', DEFAULT_BRAND.heroMarket],
  heroServices: ['brand.hero_services', DEFAULT_BRAND.heroServices],
  heroStays: ['brand.hero_stays', DEFAULT_BRAND.heroStays],
  seo: ['seo.description', DEFAULT_BRAND.seoDescription],
} as const;
type Field = keyof typeof KEYS;
type Values = Record<Field, string>;

const PALETTES = [
  { name: 'Navy & gold', primary: '#1442a3', accent: '#ffc81f' },
  { name: 'Maroon & gold', primary: '#7a1f2b', accent: '#f2b632' },
  { name: 'Forest & amber', primary: '#0f6b3a', accent: '#f5a623' },
  { name: 'Royal purple', primary: '#5b2a86', accent: '#f4c430' },
  { name: 'Teal & coral', primary: '#0e6e73', accent: '#ff8a5b' },
  { name: 'Crimson & slate', primary: '#b3122e', accent: '#ffd166' },
];

const HEX = /^#[0-9a-f]{6}$/i;

/** WCAG contrast ratio between two hex colours. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, bl] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Points the page's colour stylesheet at /brand.css, optionally with unsaved colours. */
function setBrandStylesheet(primary?: string, accent?: string) {
  const link = document.querySelector<HTMLLinkElement>('link[href^="/brand.css"]');
  if (!link) return;
  link.href = primary && accent ? `/brand.css?primary=${encodeURIComponent(primary)}&accent=${encodeURIComponent(accent)}` : `/brand.css?v=${Date.now()}`;
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody className="space-y-5">{children}</CardBody>
    </Card>
  );
}

function ColorField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: ReactNode }) {
  const valid = HEX.test(value);
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <label className="relative h-11 w-14 shrink-0 cursor-pointer overflow-hidden rounded-xl ring-1 ring-gray-300" style={{ background: valid ? value : '#ffffff' }}>
          <input type="color" value={valid ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={`${label} picker`} />
        </label>
        <Input value={value} onChange={(e) => onChange(e.target.value.trim())} maxLength={7} className="w-32 font-mono uppercase" error={valid ? undefined : 'Use a colour like #1442A3'} aria-label={`${label} hex code`} />
      </div>
    </Field>
  );
}

function ImageField({
  label,
  hint,
  value,
  fallback,
  onChange,
  wide = true,
}: {
  label: string;
  hint: string;
  value: string;
  fallback: string;
  onChange: (v: string) => void;
  wide?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const shown = value || fallback;

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('That image is larger than 5 MB. Please choose a smaller one.');
      return;
    }
    const form = new FormData();
    form.append('image', file);
    setBusy(true);
    try {
      const res = await api.post<ApiResponse<{ url: string }>>('/admin/branding/image', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 });
      onChange(res.data.data!.url);
      toast.success('Image uploaded. Save to publish it.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Upload failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-gray-800">{label}</p>
      <div className={cn('flex gap-4', wide ? 'flex-col sm:flex-row sm:items-center' : 'items-center')}>
        <div className={cn('relative shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-gray-200', wide ? 'aspect-[16/7] w-full sm:w-64' : 'h-20 w-20')}>
          {shown ? (
            <img src={shown} alt="" className={cn('h-full w-full', wide ? 'object-cover' : 'object-contain p-1')} />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-gray-400">
              <FiImage className="h-6 w-6" />
            </span>
          )}
          {busy && <span className="absolute inset-0 animate-pulse bg-white/60" />}
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-xs text-gray-500">{hint}</p>
          <div className="flex flex-wrap gap-2">
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={upload} />
            <Button size="sm" variant="outline" loading={busy} onClick={() => input.current?.click()}>
              <FiUpload className="h-4 w-4" /> Upload
            </Button>
            {value && value !== fallback && (
              <Button size="sm" variant="ghost" onClick={() => onChange(wide ? fallback : '')}>
                {wide ? <FiRotateCcw className="h-4 w-4" /> : <FiTrash2 className="h-4 w-4" />} {wide ? 'Use default' : 'Remove'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminAppearance() {
  useDocumentTitle('Appearance · Admin');
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => adminApi.getSettings() });

  const original = useMemo<Values>(() => {
    const byKey = Object.fromEntries((data ?? []).map((s) => [s.key, s.value]));
    return Object.fromEntries(Object.entries(KEYS).map(([f, [key, def]]) => [f, byKey[key] ?? def])) as Values;
  }, [data]);
  const [v, setV] = useState<Values>(original);
  useEffect(() => setV(original), [original]);
  const set = (f: Field) => (value: string) => setV((cur) => ({ ...cur, [f]: value }));

  const changed = (Object.keys(KEYS) as Field[]).filter((f) => v[f] !== original[f]);
  const colorsValid = HEX.test(v.primary) && HEX.test(v.accent);
  const emptyRequired = (['appName', 'universityName', 'universityShort', 'location', 'tagline', 'seo'] as Field[]).filter((f) => !v[f].trim());

  // Live preview: the whole console takes on the unsaved colours while editing.
  useEffect(() => {
    if (!colorsValid) return;
    const t = window.setTimeout(() => {
      if (v.primary !== original.primary || v.accent !== original.accent) setBrandStylesheet(v.primary, v.accent);
      else setBrandStylesheet();
    }, 150);
    return () => window.clearTimeout(t);
  }, [v.primary, v.accent, original.primary, original.accent, colorsValid]);
  useEffect(() => () => setBrandStylesheet(), []);

  const save = useMutation({
    mutationFn: () => adminApi.updateSettings(changed.map((f) => ({ key: KEYS[f][0], value: v[f].trim() }))),
    onSuccess: () => {
      toast.success('Appearance saved. Everyone sees the changes on their next page load.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      queryClient.invalidateQueries({ queryKey: ['settings', 'public'] });
      setBrandStylesheet();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Could not save appearance')),
  });

  const onPrimary = colorsValid ? contrast('#ffffff', v.primary) : 0;
  const onAccent = colorsValid ? contrast('#06173d', v.accent) : 0;

  if (error) {
    return (
      <Card>
        <ErrorState message={getErrorMessage(error, 'Could not load appearance settings')} onRetry={() => refetch()} />
      </Card>
    );
  }

  return (
    <div className="pb-24">
      <PageHeader
        title="Appearance"
        description="Make the platform your university's own: name, colours, logo and photos. Colour changes preview live across this console before you save."
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Section title="Identity" description="Used in the header, page titles, emails and search results.">
            <Field label="Platform name" hint="Shown in the logo and every page title, e.g. “Cavendish Connect”.">
              <Input value={v.appName} onChange={(e) => set('appName')(e.target.value)} maxLength={40} />
            </Field>
            <Field label="University name" hint="Full name, e.g. “Cavendish University Uganda”.">
              <Input value={v.universityName} onChange={(e) => set('universityName')(e.target.value)} maxLength={80} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Short name" hint="Used in sentences: “near Cavendish”.">
                <Input value={v.universityShort} onChange={(e) => set('universityShort')(e.target.value)} maxLength={30} />
              </Field>
              <Field label="Location" hint="City, country.">
                <Input value={v.location} onChange={(e) => set('location')(e.target.value)} maxLength={60} />
              </Field>
            </div>
            <Field label="Tagline">
              <Input value={v.tagline} onChange={(e) => set('tagline')(e.target.value)} maxLength={80} />
            </Field>
          </Section>

          <Section title="Colours" description="Every shade on the site is generated from these two colours.">
            <div>
              <p className="mb-2 text-sm font-medium text-gray-800">Quick palettes</p>
              <div className="flex flex-wrap gap-2">
                {PALETTES.map((p) => {
                  const active = v.primary.toLowerCase() === p.primary && v.accent.toLowerCase() === p.accent;
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setV((cur) => ({ ...cur, primary: p.primary, accent: p.accent }))}
                      className={cn('flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition', active ? 'border-gray-900 text-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400')}
                    >
                      <span className="flex">
                        <span className="h-4 w-4 rounded-full ring-2 ring-white" style={{ background: p.primary }} />
                        <span className="-ml-1.5 h-4 w-4 rounded-full ring-2 ring-white" style={{ background: p.accent }} />
                      </span>
                      {p.name}
                      {active && <FiCheck className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField label="Main colour" value={v.primary} onChange={set('primary')} hint="Buttons, links, sidebars." />
              <ColorField label="Accent colour" value={v.accent} onChange={set('accent')} hint="Highlights and call-outs." />
            </div>
            {colorsValid && (onPrimary < 4.5 || onAccent < 4.5) && (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {onPrimary < 4.5 && <>White text on the main colour is hard to read ({onPrimary.toFixed(1)}:1, aim for 4.5+). Choose a darker main colour. </>}
                  {onAccent < 4.5 && <>Dark text on the accent is hard to read ({onAccent.toFixed(1)}:1). Choose a lighter, brighter accent.</>}
                </span>
              </p>
            )}
            {/* Preview uses the live colours */}
            <div className="overflow-hidden rounded-2xl ring-1 ring-gray-200">
              <div className="bg-gradient-to-r from-brand-900 to-brand-700 p-4 text-white">
                <p className="text-xs text-white/70">Preview</p>
                <p className="text-lg font-extrabold">
                  {v.appName.split(' ')[0]} <span className="text-accent-400">{v.appName.split(' ').slice(1).join(' ')}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 bg-white p-4">
                <Button size="sm">Primary button</Button>
                <span className="inline-flex h-8 items-center rounded-full bg-accent-400 px-3 text-[13px] font-bold text-brand-950">Accent</span>
                <Badge variant="brand">Badge</Badge>
                <span className="text-sm font-semibold text-brand-700">Link text</span>
              </div>
            </div>
          </Section>

          <Section title="Logo and photos" description="PNG, JPG or WebP up to 5 MB. Wide banner photos look best at 2000×900 or larger.">
            <ImageField label="Logo" hint="Square, ideally with a transparent background. Without one, a shield with the university's initials is shown." value={v.logo} fallback="" onChange={set('logo')} wide={false} />
            <ImageField label="Campus Market banner" hint="Also used when pages are shared on social media." value={v.heroMarket} fallback={DEFAULT_BRAND.heroMarket} onChange={set('heroMarket')} />
            <ImageField label="Services Hub banner" hint="Shown behind “Campus Services Hub”." value={v.heroServices} fallback={DEFAULT_BRAND.heroServices} onChange={set('heroServices')} />
            <ImageField label="Accommodation banner" hint="A bright photo of a residence or room works best." value={v.heroStays} fallback={DEFAULT_BRAND.heroStays} onChange={set('heroStays')} />
          </Section>

          <Section title="Search engines" description="How the platform appears on Google and when links are shared.">
            <Field label="Site description" hint={`${v.seo.length} characters. Google shows about 155; aim for 120–160.`}>
              <Textarea rows={4} value={v.seo} onChange={(e) => set('seo')(e.target.value)} maxLength={320} />
            </Field>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Search result preview</p>
              <p className="mt-1 truncate text-lg text-[#1a0dab] dark:text-brand-700">
                {v.appName} · {v.tagline}
              </p>
              <p className="line-clamp-2 text-sm text-gray-600">{v.seo}</p>
            </div>
          </Section>
        </div>
      )}

      {changed.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">{changed.length}</span> unsaved change{changed.length === 1 ? '' : 's'}
              {!colorsValid && <span className="text-red-600"> · fix the colour codes</span>}
              {emptyRequired.length > 0 && <span className="text-red-600"> · fill in the empty fields</span>}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setV(original)} disabled={save.isPending}>
                <FiRotateCcw className="h-4 w-4" /> Discard
              </Button>
              <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!colorsValid || emptyRequired.length > 0}>
                <FiSave className="h-4 w-4" /> Save and publish
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
