import React, { useEffect, useState } from 'react';
import { Palette, Type, Sliders, RefreshCw, X } from 'lucide-react';

interface ThemeDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeDashboard: React.FC<ThemeDashboardProps> = ({ isOpen, onClose }) => {
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

  // Local state for loaded styles
  const [selectedFont, setSelectedFont] = useState(fontPresets[0].value);
  const [primaryColor, setPrimaryColor] = useState(primaryColorPresets[0].value);
  const [secondaryColor, setSecondaryColor] = useState(secondaryColorPresets[0].value);
  const [bgColor, setBgColor] = useState(bgPresets[0].value);
  const [fontSize, setFontSize] = useState(fontSizePresets[1].value);
  const [fontWeight, setFontWeight] = useState(fontWeightPresets[1].value);

  // Load theme settings from localStorage on mount
  useEffect(() => {
    const savedFont = localStorage.getItem('theme-font') || fontPresets[0].value;
    const savedPrimary = localStorage.getItem('theme-primary') || primaryColorPresets[0].value;
    const savedSecondary = localStorage.getItem('theme-secondary') || secondaryColorPresets[0].value;
    const savedBg = localStorage.getItem('theme-bg') || bgPresets[0].value;
    const savedFontSize = localStorage.getItem('theme-fontSize') || fontSizePresets[1].value;
    const savedFontWeight = localStorage.getItem('theme-fontWeight') || fontWeightPresets[1].value;

    setSelectedFont(savedFont);
    setPrimaryColor(savedPrimary);
    setSecondaryColor(savedSecondary);
    setBgColor(savedBg);
    setFontSize(savedFontSize);
    setFontWeight(savedFontWeight);

    // Apply values to HTML element
    document.documentElement.style.setProperty('--font-family', savedFont);
    document.documentElement.style.setProperty('--primary-color', savedPrimary);
    document.documentElement.style.setProperty('--secondary-color', savedSecondary);
    document.documentElement.style.setProperty('--bg-color', savedBg);
    document.documentElement.style.setProperty('--font-size-base', savedFontSize);
    document.documentElement.style.setProperty('--font-weight-bold', savedFontWeight);
  }, []);

  // Update & Apply styles helpers
  const handleStyleChange = (key: string, value: string, localSetter: (val: string) => void, storageKey: string) => {
    localSetter(value);
    document.documentElement.style.setProperty(key, value);
    localStorage.setItem(storageKey, value);
  };

  const resetToDefault = () => {
    handleStyleChange('--font-family', fontPresets[0].value, setSelectedFont, 'theme-font');
    handleStyleChange('--primary-color', primaryColorPresets[0].value, setPrimaryColor, 'theme-primary');
    handleStyleChange('--secondary-color', secondaryColorPresets[0].value, setSecondaryColor, 'theme-secondary');
    handleStyleChange('--bg-color', bgPresets[0].value, setBgColor, 'theme-bg');
    handleStyleChange('--font-size-base', fontSizePresets[1].value, setFontSize, 'theme-fontSize');
    handleStyleChange('--font-weight-bold', fontWeightPresets[1].value, setFontWeight, 'theme-fontWeight');
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
