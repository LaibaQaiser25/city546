import { Save } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { SITE } from '../../config/site';
import { aiApi } from '../../services/aiApi';
import ImageField from '../admin/ImageField';
import Button from '../ui/Button';
import { GraphicPreview } from './NewsGraphic';

const SAMPLE = {
  tagline: 'اہم خبر',
  contextLine: 'شہر کے مرکزی بازار میں',
  highlight: 'نمونہ خبر',
  subline: 'یہ صرف ڈیزائن کا نمونہ ہے',
  bullets: ['برانڈنگ کی ترتیبات کا پیش نظارہ', 'اصل گرافک آپ کی خبر کی معلومات سے بنے گا'],
  theme: 'breaking',
};

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-gold-400 dark:bg-white/20 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
      <span>
        <span className="block text-sm font-semibold text-navy-900 dark:text-white">{label}</span>
        {hint && <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
      </span>
    </label>
  );
}

/** Learning options + branding used on generated news graphics. */
export default function AIBrandSettings({ initial, onSaved }) {
  const [s, setS] = useState(() => ({
    learnFromFeedback: !!initial.learnFromFeedback,
    autoRebuild: initial.autoRebuild !== false,
    graphic: {
      reporterName: initial.graphic?.reporterName ?? SITE.show.hostUrdu,
      reporterPhotoUrl: initial.graphic?.reporterPhotoUrl || '',
      partnerLogoUrl: initial.graphic?.partnerLogoUrl || '',
      partnerLabel: initial.graphic?.partnerLabel || '',
      defaultTagline: initial.graphic?.defaultTagline || '',
      showWordsWithMirza: initial.graphic?.showWordsWithMirza !== false,
    },
  }));
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState({});
  const g = s.graphic;
  const setG = (patch) => setS((x) => ({ ...x, graphic: { ...x.graphic, ...patch } }));
  const uploading = Object.values(busy).some(Boolean);

  const save = async () => {
    setSaving(true);
    try {
      const res = await aiApi.saveSettings(s);
      toast.success(res.message);
      onSaved?.(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <h3 className="font-bold text-navy-900 dark:text-white">Learning</h3>
          <Toggle
            checked={s.autoRebuild}
            onChange={(v) => setS((x) => ({ ...x, autoRebuild: v }))}
            label="Update the style automatically"
            hint="Re-analyse after new reference posts are imported or refreshed. Off = only when you click Rebuild."
          />
          <Toggle
            checked={s.learnFromFeedback}
            onChange={(v) => setS((x) => ({ ...x, learnFromFeedback: v }))}
            label="Learn from my edits and approvals"
            hint="When rebuilding, include published posts you marked “Good style” or noticeably edited. AI drafts are never used as examples on their own."
          />
        </section>

        <section className="card space-y-4 p-5">
          <h3 className="font-bold text-navy-900 dark:text-white">News graphic branding</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">Reporter name</span>
              <input dir="auto" value={g.reporterName} onChange={(e) => setG({ reporterName: e.target.value })} maxLength={60} className="input font-urdu" />
            </label>
            <label className="block">
              <span className="label">Default tagline</span>
              <input dir="auto" value={g.defaultTagline} onChange={(e) => setG({ defaultTagline: e.target.value })} maxLength={30} placeholder="اہم خبر" className="input font-urdu" />
            </label>
            <label className="block">
              <span className="label">Partner / channel label</span>
              <input value={g.partnerLabel} onChange={(e) => setG({ partnerLabel: e.target.value })} maxLength={40} placeholder="e.g. Phalia" className="input" />
            </label>
            <div className="flex items-end pb-2">
              <Toggle checked={g.showWordsWithMirza} onChange={(v) => setG({ showWordsWithMirza: v })} label="Show “Words with Mirza” badge" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="label">Reporter photo</span>
              <ImageField id="reporter-photo" compact value={g.reporterPhotoUrl} onChange={(url) => setG({ reporterPhotoUrl: url })} onBusyChange={(b) => setBusy((x) => ({ ...x, reporter: b }))} />
            </div>
            <div>
              <span className="label">Partner logo</span>
              <ImageField id="partner-logo" compact value={g.partnerLogoUrl} onChange={(url) => setG({ partnerLogoUrl: url })} onBusyChange={(b) => setBusy((x) => ({ ...x, partner: b }))} />
              <span className="mt-1 block text-xs text-slate-500">Use only logos you have the right to use.</span>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <Button onClick={save} loading={saving} disabled={uploading}>
            {!saving && <Save className="h-4 w-4" aria-hidden="true" />} Save settings
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Branding preview</p>
        <GraphicPreview graphic={SAMPLE} photos={[]} brand={g} maxWidth={320} />
      </div>
    </div>
  );
}
