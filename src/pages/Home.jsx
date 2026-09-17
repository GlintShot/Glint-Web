import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sun,
  Moon,
  Upload,
  Sparkles,
  ArrowRight,
  Layers,
  Smartphone,
  DownloadCloud,
  CheckCircle2,
  FolderOpen,
  Zap,
  LayoutTemplate,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import UploadZone from '../components/UploadZone';
import SessionImporter from '../components/SessionImporter';
import { loadAllTemplates, filterVisibleTemplates } from '../utils/templateLoader';
import TemplateSetPreview from '../components/TemplateSetPreview';
import DeviceBrowseFilters, { filterByDevice, deviceFilterToStore } from '../components/StoreBrowseFilters';
import { parseGlint, isGlintFile } from '../utils/projectPack';
import { getStoreTarget } from '../utils/storeCatalog';

export default function Home() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deviceFilter, setDeviceFilter] = useState('android-phone');
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    loadAllTemplates({ enabledOnly: true })
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, []);

  const filteredTemplates = filterByDevice(
    filterVisibleTemplates(templates, null),
    deviceFilter,
  );

  const handleUpload = (ingested) => {
    navigate('/editor', {
      state: {
        screenshots: ingested.map((x) => x.url),
        assetItems: ingested,
      },
    });
  };

  const handleSessionImport = ({ screenshots: imported, session: importedSession }) => {
    navigate('/editor', {
      state: {
        screenshots: imported,
        session: importedSession,
        assetItems: imported.map((url, i) => ({
          id: `session-${i}`,
          url,
          name: `Screen ${i + 1}`,
        })),
      },
    });
  };

  const handleProjectImport = (pack) => {
    navigate('/editor', { state: { glintPack: pack } });
  };

  const glintFileRef = useRef(null);

  const handleGlintFileImport = async (file) => {
    if (!file || !isGlintFile(file)) {
      alert('Not a valid .glint file');
      return;
    }
    try {
      const pack = await parseGlint(file);
      navigate('/editor', { state: { glintPack: pack } });
    } catch (err) {
      console.error('Import failed:', err);
      alert(`Import failed: ${err.message || err}`);
    }
  };

  const handleGlintFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleGlintFileImport(file);
    e.target.value = '';
  };

  const handleStartFromTemplate = (template) => {
    navigate('/editor', { state: { template } });
  };

  const handleStartBlank = (storeKey) => {
    const store = storeKey || deviceFilterToStore(deviceFilter);
    navigate('/editor', { state: { scratch: true, store } });
  };

  const scratchStore = deviceFilterToStore(deviceFilter);
  const scratchTarget = getStoreTarget(scratchStore);

  return (
    <div className="h-screen overflow-y-auto glint-gradient-bg selection:bg-glint-accent/30 selection:text-glint-text">
      {/* Modern Sticky Frosted Navigation */}
      <header className="border-b border-glint-border/60 bg-glint-surface/60 backdrop-blur-xl sticky top-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-glint-accent/25 via-glint-accent/10 to-transparent border border-glint-accent/30 flex items-center justify-center shadow-sm group-hover:border-glint-accent/60 transition-all duration-300">
              <img src="/logo.png" alt="Glint" className="w-6 h-6 object-contain" />
              <div className="absolute inset-0 rounded-xl bg-glint-accent/10 opacity-0 group-hover:opacity-100 blur-sm transition-opacity" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-glint-text tracking-tight">Glint</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-glint-accent-muted text-glint-accent border border-glint-accent/20">Studio</span>
              </div>
              <p className="text-[11px] text-glint-text-tertiary font-medium">App Store & Play Store Screenshots</p>
            </div>
          </div>

          <nav className="flex items-center gap-2 sm:gap-4 text-sm font-medium">
            <a
              href="#templates"
              className="px-3.5 py-1.5 rounded-lg text-glint-text-secondary hover:text-glint-text hover:bg-glint-surface-2/60 transition-all"
            >
              Templates
            </a>
            <a
              href="#upload"
              className="px-3.5 py-1.5 rounded-lg text-glint-text-secondary hover:text-glint-text hover:bg-glint-surface-2/60 transition-all"
            >
              Import
            </a>
            <button
              onClick={() => handleStartBlank()}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 glint-btn-primary rounded-xl text-xs font-semibold shadow-sm hover:shadow-md transition-all"
            >
              <Sparkles size={14} />
              Blank board
            </button>
            <button
              onClick={toggle}
              className="p-2.5 rounded-xl text-glint-text-secondary hover:text-glint-text hover:bg-glint-surface-2 border border-transparent hover:border-glint-border transition-all duration-200"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 md:py-16 space-y-24">
        {/* Modern Hero Section */}
        <section className="relative text-center max-w-4xl mx-auto space-y-8 pt-4">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-glint-accent-muted border border-glint-accent/25 shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-glint-accent animate-pulse" />
              <span className="text-xs font-semibold text-glint-accent uppercase tracking-wider">
                Store-Ready Graphic Suites
              </span>
            </div>

            <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-glint-text tracking-tight leading-[1.12]">
              App store screenshots,<br />
              <span className="bg-gradient-to-r from-glint-accent via-glint-accent-hover to-glint-accent bg-clip-text text-transparent">
                crafted to perfection
              </span>
            </h2>

            <p className="text-base sm:text-lg text-glint-text-secondary max-w-2xl mx-auto leading-relaxed">
              Transform raw app captures into polished screenshot sets for App Store and Google Play. Instant PNG templates, zero device emulators.
            </p>
          </div>

          <div className="flex flex-wrap gap-3.5 justify-center items-center pt-2">
            <button
              onClick={() => document.getElementById('templates')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-7 py-3.5 glint-btn-primary rounded-xl text-sm sm:text-base font-semibold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 inline-flex items-center gap-2 group"
            >
              <Sparkles size={18} className="group-hover:rotate-12 transition-transform duration-300" />
              Explore Templates
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform duration-300" />
            </button>
            <button
              onClick={() => document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-6 py-3.5 border border-glint-border-strong bg-glint-surface/70 backdrop-blur rounded-xl text-sm sm:text-base font-semibold text-glint-text hover:bg-glint-surface-2 hover:border-glint-accent/40 hover:scale-105 active:scale-95 transition-all duration-300 inline-flex items-center gap-2"
            >
              <Upload size={17} />
              Import Screenshots
            </button>
          </div>

          {/* Value Props Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-6 max-w-3xl mx-auto text-left">
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-glint-surface/50 border border-glint-border text-xs text-glint-text font-medium">
              <Zap size={15} className="text-glint-accent shrink-0" />
              <span>Zero login required</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-glint-surface/50 border border-glint-border text-xs text-glint-text font-medium">
              <Sparkles size={15} className="text-glint-accent shrink-0" />
              <span>Instant PNG previews</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-glint-surface/50 border border-glint-border text-xs text-glint-text font-medium">
              <Smartphone size={15} className="text-glint-accent shrink-0" />
              <span>iOS & Android sizes</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-glint-surface/50 border border-glint-border text-xs text-glint-text font-medium">
              <DownloadCloud size={15} className="text-glint-accent shrink-0" />
              <span>1-Click ZIP export</span>
            </div>
          </div>
        </section>

        {/* Workflow Steps */}
        <section className="grid md:grid-cols-3 gap-6">
          <div className="glint-card rounded-2xl p-7 space-y-4 text-left border border-glint-border hover:border-glint-accent/50 hover:shadow-xl hover:shadow-glint-accent/10 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group cursor-default">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-glint-accent/20 to-glint-accent/5 border border-glint-accent/25 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                <Upload className="w-5 h-5 text-glint-accent" />
              </div>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-glint-surface-2 text-glint-text-tertiary border border-glint-border">
                STEP 01
              </span>
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-glint-text text-lg">Import & Layout</h3>
              <p className="text-xs sm:text-sm leading-relaxed text-glint-text-secondary">
                Drag and drop your raw captures, select a curated store pack, and watch device bezels and typography align automatically.
              </p>
            </div>
          </div>

          <div className="glint-card rounded-2xl p-7 space-y-4 text-left border border-glint-border hover:border-glint-accent/50 hover:shadow-xl hover:shadow-glint-accent/10 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group cursor-default" style={{ animationDelay: '80ms' }}>
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-glint-accent/20 to-glint-accent/5 border border-glint-accent/25 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                <Layers className="w-5 h-5 text-glint-accent" />
              </div>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-glint-surface-2 text-glint-text-tertiary border border-glint-border">
                STEP 02
              </span>
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-glint-text text-lg">Polish & Brand</h3>
              <p className="text-xs sm:text-sm leading-relaxed text-glint-text-secondary">
                Fine-tune headlines, background graphics, badge tags, and bezel styling on an infinite interactive board with live feedback.
              </p>
            </div>
          </div>

          <div className="glint-card rounded-2xl p-7 space-y-4 text-left border border-glint-border hover:border-glint-accent/50 hover:shadow-xl hover:shadow-glint-accent/10 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group cursor-default" style={{ animationDelay: '160ms' }}>
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-glint-accent/20 to-glint-accent/5 border border-glint-accent/25 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                <DownloadCloud className="w-5 h-5 text-glint-accent" />
              </div>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-glint-surface-2 text-glint-text-tertiary border border-glint-border">
                STEP 03
              </span>
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-glint-text text-lg">Batch Export</h3>
              <p className="text-xs sm:text-sm leading-relaxed text-glint-text-secondary">
                Export pixel-perfect PNG zip packages structured for Google Play Console, App Store Connect, or automated CI/CD pipelines.
              </p>
            </div>
          </div>
        </section>

        {/* Template Showcase Section */}
        <section id="templates" className="space-y-8 pt-4">
          

          <DeviceBrowseFilters
            device={deviceFilter}
            onDeviceChange={setDeviceFilter}
          />

          {loading ? (
            <div className="space-y-5">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-80 rounded-2xl bg-gradient-to-r from-glint-surface to-glint-surface-2 animate-pulse border border-glint-border/50"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-glint-border bg-glint-surface/40 space-y-3">
              <Layers size={36} className="mx-auto text-glint-text-tertiary opacity-60" />
              <p className="text-base font-semibold text-glint-text">No templates found for this filter</p>
              <p className="text-xs text-glint-text-secondary">Try selecting "All Devices" or resetting your filter.</p>
              <button
                onClick={() => setDeviceFilter('android-phone')}
                className="mt-2 px-4 py-2 text-xs font-semibold rounded-lg bg-glint-surface-2 border border-glint-border hover:border-glint-accent/50 text-glint-text transition-all"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredTemplates.map((t, i) => (
                <TemplateShowcaseRow
                  key={t.id}
                  template={t}
                  index={i}
                  onClick={() => handleStartFromTemplate(t)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Build From Scratch & Import Section */}
        <section id="upload" className="space-y-8 pt-4">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-glint-surface-2 border border-glint-border text-xs font-medium text-glint-text-secondary">
              <FolderOpen size={13} className="text-glint-accent" />
              <span>Studio Workflows</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-glint-text tracking-tight">Or build from scratch</h3>
            <p className="text-xs sm:text-sm text-glint-text-secondary">
              Start with empty device frames, import shots, or resume a saved project.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glint-card rounded-2xl p-7 space-y-5 border border-glint-accent/40 bg-glint-accent/[0.03] hover:border-glint-accent/60 hover:shadow-lg hover:shadow-glint-accent/10 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-glint-accent/20 to-glint-accent/5 border border-glint-accent/20 flex items-center justify-center">
                  <LayoutTemplate className="w-5 h-5 text-glint-accent" />
                </div>
                <div>
                  <h4 className="font-bold text-glint-text text-base">Blank board</h4>
                  <p className="text-[11px] text-glint-text-tertiary">5 device frames, no template</p>
                </div>
              </div>
              <DeviceBrowseFilters
                device={deviceFilter}
                onDeviceChange={setDeviceFilter}
                size="sm"
              />
              <p className="text-xs text-glint-text-secondary leading-relaxed">
                {scratchTarget.fullLabel} ({scratchTarget.width}×{scratchTarget.height}) with
                white screens and the matching device bezel. Pick a size above, then start.
              </p>
              <button
                type="button"
                onClick={() => handleStartBlank()}
                className="w-full px-4 py-3 glint-btn-primary rounded-xl text-xs sm:text-sm font-semibold"
              >
                Start blank · {scratchTarget.label}
              </button>
            </div>

            <div className="glint-card rounded-2xl p-7 space-y-5 border border-glint-border hover:border-glint-accent/40 hover:shadow-lg hover:shadow-glint-accent/10 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-glint-accent/20 to-glint-accent/5 border border-glint-accent/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Upload className="w-5 h-5 text-glint-accent" />
                </div>
                <div>
                  <h4 className="font-bold text-glint-text text-base">Upload Screenshots</h4>
                  <p className="text-[11px] text-glint-text-tertiary">PNG, JPG, WebP image files</p>
                </div>
              </div>
              <UploadZone onUpload={handleUpload} />
            </div>

            <div className="glint-card rounded-2xl p-7 space-y-5 border border-glint-border hover:border-glint-accent/40 hover:shadow-lg hover:shadow-glint-accent/10 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ animationDelay: '60ms' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-glint-accent/20 to-glint-accent/5 border border-glint-accent/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Layers className="w-5 h-5 text-glint-accent" />
                </div>
                <div>
                  <h4 className="font-bold text-glint-text text-base">Import Session</h4>
                  <p className="text-[11px] text-glint-text-tertiary">From Glint Capture or Bridge</p>
                </div>
              </div>
              <SessionImporter
                onImport={handleSessionImport}
                onProjectImport={handleProjectImport}
              />
            </div>

            <div className="glint-card rounded-2xl p-7 space-y-5 border border-glint-border hover:border-glint-accent/40 hover:shadow-lg hover:shadow-glint-accent/10 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ animationDelay: '120ms' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-glint-accent/20 to-glint-accent/5 border border-glint-accent/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <FolderOpen className="w-5 h-5 text-glint-accent" />
                </div>
                <div>
                  <h4 className="font-bold text-glint-text text-base">Open .glint Project</h4>
                  <p className="text-[11px] text-glint-text-tertiary">Resume your saved studio workspace</p>
                </div>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => glintFileRef.current?.click()}
                  className="w-full px-4 py-3.5 border-2 border-dashed border-glint-border hover:border-glint-accent/60 rounded-xl text-xs sm:text-sm text-glint-text-secondary hover:text-glint-text hover:bg-glint-accent-muted hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 font-medium flex items-center justify-center gap-2 group"
                >
                  <Upload size={16} className="group-hover:-translate-y-1 transition-transform duration-300" />
                  Select .glint project file
                </button>
                <input
                  ref={glintFileRef}
                  type="file"
                  accept=".glint,.glint.zip"
                  onChange={handleGlintFileInput}
                  className="hidden"
                />
                <p className="text-[11px] text-center text-glint-text-tertiary">Restores canvas state, screenshots, and text</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Modern Footer */}
      <footer className="border-t border-glint-border/40 bg-glint-surface/40 backdrop-blur-md mt-24">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Glint" className="w-5 h-5 rounded opacity-70" />
            <span className="text-xs sm:text-sm text-glint-text-secondary">
              Crafted by the{' '}
              <a
                href="https://github.com/GlintShot"
                target="_blank"
                rel="noreferrer"
                className="text-glint-text hover:text-glint-accent transition-colors font-semibold"
              >
                Glint Team
              </a>
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-glint-text-tertiary">
            <a href="https://github.com/GlintShot" target="_blank" rel="noreferrer" className="hover:text-glint-text transition-colors">GitHub</a>
            <span>•</span>
            <a href="#templates" className="hover:text-glint-text transition-colors">Templates</a>
            <span>•</span>
            <a href="#upload" className="hover:text-glint-text transition-colors">Import</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TemplateShowcaseRow({ template, onClick, index = 0 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setShown(true);
      },
      { rootMargin: '80px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className={`group w-full cursor-pointer rounded-2xl overflow-hidden border border-glint-border bg-glint-surface
        shadow-sm hover:shadow-2xl hover:shadow-glint-accent/15
        hover:border-glint-accent/50
        hover:scale-[1.02] active:scale-[0.98]
        transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
        ${shown ? 'glint-reveal' : 'opacity-0 translate-y-6'}`}
      style={shown ? { animationDelay: `${Math.min(index, 6) * 80}ms` } : undefined}
    >
      <TemplateSetPreview template={template} />
    </div>
  );
}

