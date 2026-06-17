import React, { useEffect, useState } from 'react';
import { Palette, Type, Sliders, RefreshCw, X } from 'lucide-react';

interface ThemeDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  activeWsUrl?: string;
}

export const ThemeDashboard: React.FC<ThemeDashboardProps> = ({ isOpen, onClose, activeWsUrl }) => {
  // Theme Presets Definition
  const fontPresets = [
    { name: 'Outfit (Sleek Modern)', value: "'Outfit', 'Inter', sans-serif" },
    { name: 'Inter (Professional)', value: "'Inter', sans-serif" },
    { name: 'Roboto Mono (Telemetry)', value: "'Roboto Mono', monospace" },
    { name: 'Playfair (Classic Serif)', value: "'Playfair Display', serif" },
  ];

  const primaryColorPresets = [
    { name: 'Neon Blue', value: '#3b82f6' },
    { name: 'Electric Indigo', value: '#6366f1' },
    { name: 'Vibrant Violet', value: '#8b5cf6' },
    { name: 'Teal Aurora', value: '#06b6d4' },
    { name: 'Cyberpunk Rose', value: '#f43f5e' },
    { name: 'Safety Amber', value: '#f59e0b' },
  ];

  const secondaryColorPresets = [
    { name: 'Aurora Emerald', value: '#10b981' },
    { name: 'Cyberpunk Purple', value: '#a855f7' },
    { name: 'Neon Pink', value: '#ec4899' },
    { name: 'Vivid Cyan', value: '#06b6d4' },
    { name: 'Sunset Orange', value: '#f97316' },
  ];

  const bgPresets = [
    { name: 'Midnight Black', value: '#0b0f19' },
    { name: 'Deep Slate Space', value: '#0f172a' },
    { name: 'Cyberpunk Violet', value: '#120b1e' },
    { name: 'Obsidian Charcoal', value: '#0c0c0e' },
  ];

  const fontSizePresets = [
    { name: 'Compact', value: '14px' },
    { name: 'Default', value: '16px' },
    { name: 'Enlarged', value: '18px' },
  ];

  const fontWeightPresets = [
    { name: 'Semi-Bold', value: '600' },
    { name: 'Bold (Default)', value: '700' },
    { name: 'Ultra-Bold', value: '800' },
  ];

  // Dynamically resolve API base from WebSocket URL, with loopback fallback
  const getApiBase = (wsUrl?: string) => {
    if (wsUrl) {
      try {
        const url = new URL(wsUrl);
        const protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
        return `${protocol}//${url.host}`;
      } catch (e) {
        console.error('Failed to parse WebSocket URL for API base, using fallback', e);
      }
    }
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `http://${hostname}:8000`;
      }
    }
    return 'http://127.0.0.1:8000';
  };

  const API_BASE = getApiBase(activeWsUrl);

  // Local state for loaded styles
  const [selectedFont, setSelectedFont] = useState(fontPresets[0].value);
  const [primaryColor, setPrimaryColor] = useState(primaryColorPresets[0].value);
  const [secondaryColor, setSecondaryColor] = useState(secondaryColorPresets[0].value);
  const [bgColor, setBgColor] = useState(bgPresets[0].value);
  const [fontSize, setFontSize] = useState(fontSizePresets[1].value);
  const [fontWeight, setFontWeight] = useState(fontWeightPresets[1].value);

  // Load theme settings from database on mount with localStorage fallback
  useEffect(() => {
    const applyTheme = (font: string, primary: string, secondary: string, bg: string, size: string, weight: string) => {
      setSelectedFont(font);
      setPrimaryColor(primary);
      setSecondaryColor(secondary);
      setBgColor(bg);
      setFontSize(size);
      setFontWeight(weight);

      document.documentElement.style.setProperty('--font-family', font);
      document.documentElement.style.setProperty('--primary-color', primary);
      document.documentElement.style.setProperty('--secondary-color', secondary);
      document.documentElement.style.setProperty('--bg-color', bg);
      document.documentElement.style.setProperty('--font-size-base', size);
      document.documentElement.style.setProperty('--font-weight-bold', weight);
    };

    const fetchTheme = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/settings/theme_config`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.fontFamily) {
            applyTheme(
              data.fontFamily,
              data.primaryColor,
              data.secondaryColor,
              data.bgColor,
              data.fontSize,
              data.fontWeight
            );
            return;
          }
        }
      } catch (err) {
        console.error('Failed to load theme config from database. Using localStorage.', err);
      }

      // Fallback
      const savedFont = localStorage.getItem('theme-font') || fontPresets[0].value;
      const savedPrimary = localStorage.getItem('theme-primary') || primaryColorPresets[0].value;
      const savedSecondary = localStorage.getItem('theme-secondary') || secondaryColorPresets[0].value;
      const savedBg = localStorage.getItem('theme-bg') || bgPresets[0].value;
      const savedFontSize = localStorage.getItem('theme-fontSize') || fontSizePresets[1].value;
      const savedFontWeight = localStorage.getItem('theme-fontWeight') || fontWeightPresets[1].value;
      applyTheme(savedFont, savedPrimary, savedSecondary, savedBg, savedFontSize, savedFontWeight);
    };

    fetchTheme();
  }, [API_BASE]);

  // Sync state helpers
  const saveThemeToDb = async (font: string, primary: string, secondary: string, bg: string, size: string, weight: string) => {
    try {
      await fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'theme_config',
          value: {
            fontFamily: font,
            primaryColor: primary,
            secondaryColor: secondary,
            bgColor: bg,
            fontSize: size,
            fontWeight: weight
          }
        })
      });
    } catch (err) {
      console.error('Failed to sync theme config to database:', err);
    }
  };

  // Update & Apply styles helpers
  const handleStyleChange = (key: string, value: string, localSetter: (val: string) => void, storageKey: string) => {
    localSetter(value);
    document.documentElement.style.setProperty(key, value);
    localStorage.setItem(storageKey, value);

    const font = key === '--font-family' ? value : selectedFont;
    const primary = key === '--primary-color' ? value : primaryColor;
    const secondary = key === '--secondary-color' ? value : secondaryColor;
    const bg = key === '--bg-color' ? value : bgColor;
    const size = key === '--font-size-base' ? value : fontSize;
    const weight = key === '--font-weight-bold' ? value : fontWeight;

    saveThemeToDb(font, primary, secondary, bg, size, weight);
  };

  const resetToDefault = () => {
    const font = fontPresets[0].value;
    const primary = primaryColorPresets[0].value;
    const secondary = secondaryColorPresets[0].value;
    const bg = bgPresets[0].value;
    const size = fontSizePresets[1].value;
    const weight = fontWeightPresets[1].value;

    setSelectedFont(font);
    setPrimaryColor(primary);
    setSecondaryColor(secondary);
    setBgColor(bg);
    setFontSize(size);
    setFontWeight(weight);

    document.documentElement.style.setProperty('--font-family', font);
    document.documentElement.style.setProperty('--primary-color', primary);
    document.documentElement.style.setProperty('--secondary-color', secondary);
    document.documentElement.style.setProperty('--bg-color', bg);
    document.documentElement.style.setProperty('--font-size-base', size);
    document.documentElement.style.setProperty('--font-weight-bold', weight);

    localStorage.setItem('theme-font', font);
    localStorage.setItem('theme-primary', primary);
    localStorage.setItem('theme-secondary', secondary);
    localStorage.setItem('theme-bg', bg);
    localStorage.setItem('theme-fontSize', size);
    localStorage.setItem('theme-fontWeight', weight);

    saveThemeToDb(font, primary, secondary, bg, size, weight);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 glass-panel border-l border-white/10 z-50 flex flex-col shadow-2xl transition-transform duration-300 transform translate-x-0">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-sm tracking-wide uppercase">Appearance Config</h2>
        </div>
        <button 
          onClick={onClose} 
          className="p-1 rounded-lg text-textSecondary hover:text-white hover:bg-white/5 transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Colors Section */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-textSecondary uppercase tracking-widest flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" /> Color Highlights
          </h3>
          
          {/* Primary */}
          <div className="space-y-1.5">
            <label className="text-xs text-textSecondary">Primary Accent</label>
            <div className="grid grid-cols-6 gap-2">
              {primaryColorPresets.map((p) => (
                <button
                  key={p.name}
                  onClick={() => handleStyleChange('--primary-color', p.value, setPrimaryColor, 'theme-primary')}
                  style={{ backgroundColor: p.value }}
                  title={p.name}
                  className={`h-7 w-7 rounded-full transition-transform ring-offset-2 ring-offset-black ${
                    primaryColor === p.value ? 'scale-110 ring-2 ring-white' : 'opacity-80 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Secondary */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs text-textSecondary">Secondary Accent</label>
            <div className="grid grid-cols-6 gap-2">
              {secondaryColorPresets.map((s) => (
                <button
                  key={s.name}
                  onClick={() => handleStyleChange('--secondary-color', s.value, setSecondaryColor, 'theme-secondary')}
                  style={{ backgroundColor: s.value }}
                  title={s.name}
                  className={`h-7 w-7 rounded-full transition-transform ring-offset-2 ring-offset-black ${
                    secondaryColor === s.value ? 'scale-110 ring-2 ring-white' : 'opacity-80 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Background Section */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-textSecondary uppercase tracking-widest flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" /> Interface Background
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {bgPresets.map((bg) => (
              <button
                key={bg.name}
                onClick={() => handleStyleChange('--bg-color', bg.value, setBgColor, 'theme-bg')}
                style={{ backgroundColor: bg.value, border: '1px solid rgba(255,255,255,0.05)' }}
                className={`p-3 rounded-xl text-left text-xs transition-all ${
                  bgColor === bg.value 
                    ? 'ring-1 ring-primary font-medium text-white' 
                    : 'text-textSecondary hover:text-white hover:bg-white/5'
                }`}
              >
                {bg.name}
              </button>
            ))}
          </div>
        </div>

        {/* Fonts Section */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-textSecondary uppercase tracking-widest flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5" /> Typography Family
          </h3>
          <div className="flex flex-col gap-2">
            {fontPresets.map((f) => (
              <button
                key={f.name}
                onClick={() => handleStyleChange('--font-family', f.value, setSelectedFont, 'theme-font')}
                style={{ fontFamily: f.value }}
                className={`w-full p-2.5 rounded-xl text-left text-xs transition-all border border-transparent ${
                  selectedFont === f.value 
                    ? 'bg-primary/10 border-primary/20 text-white font-medium shadow-[0_0_8px_rgba(59,130,246,0.1)]' 
                    : 'text-textSecondary hover:text-white hover:bg-white/5'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>

        {/* Typography Sizing and Weights */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold text-textSecondary uppercase tracking-widest flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5" /> Font Parameters
          </h3>
          
          {/* Base Size */}
          <div className="space-y-1.5">
            <label className="text-xs text-textSecondary">Text Sizing Scale</label>
            <div className="grid grid-cols-3 gap-2">
              {fontSizePresets.map((fs) => (
                <button
                  key={fs.name}
                  onClick={() => handleStyleChange('--font-size-base', fs.value, setFontSize, 'theme-fontSize')}
                  className={`py-1.5 px-2 rounded-lg text-xs transition-all border ${
                    fontSize === fs.value 
                      ? 'bg-secondary/15 border-secondary/35 text-white font-medium' 
                      : 'border-white/5 text-textSecondary hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {fs.name}
                </button>
              ))}
            </div>
          </div>

          {/* Bold Weight */}
          <div className="space-y-1.5">
            <label className="text-xs text-textSecondary">Bold Text Weight</label>
            <div className="grid grid-cols-3 gap-2">
              {fontWeightPresets.map((fw) => (
                <button
                  key={fw.name}
                  onClick={() => handleStyleChange('--font-weight-bold', fw.value, setFontWeight, 'theme-fontWeight')}
                  className={`py-1.5 px-2 rounded-lg text-xs transition-all border ${
                    fontWeight === fw.value 
                      ? 'bg-secondary/15 border-secondary/35 text-white font-medium' 
                      : 'border-white/5 text-textSecondary hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {fw.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Reset */}
      <div className="p-4 border-t border-white/5 bg-black/20 flex gap-2">
        <button
          onClick={resetToDefault}
          className="w-full py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-xs font-medium text-textSecondary hover:text-white transition-all flex items-center justify-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reset to Defaults
        </button>
      </div>
    </div>
  );
};
