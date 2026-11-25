'use client';

import React, { useState, useRef } from 'react';

interface SubtitleImportProps {
  onImport: (text: string, format: 'vtt' | 'srt') => void;
}

export default function SubtitleImport({ onImport }: SubtitleImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [format, setFormat] = useState<'vtt' | 'srt'>('vtt');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'srt') setFormat('srt');
    else setFormat('vtt');

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      setText(content);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (text.trim()) {
      onImport(text.trim(), format);
      setIsOpen(false);
      setText('');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-200 transition-colors"
      >
        📄 Import Subtitles
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify-center pt-20 px-4" onClick={() => setIsOpen(false)}>
          <div
            className="w-full max-w-lg bg-[#222732] border border-gray-600 rounded-xl shadow-2xl p-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
          <h3 className="font-semibold text-sm text-gray-200 mb-3">
            Import Subtitles
          </h3>

          {/* Format selector */}
          <div className="flex gap-2 mb-3">
            {(['vtt', 'srt'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  format === f
                    ? 'bg-[#fca311] text-black'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          {/* File upload */}
          <div className="mb-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".vtt,.srt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 border border-dashed border-gray-600 rounded-lg text-xs text-gray-400 hover:border-[#fca311] hover:text-[#fca311] transition-colors"
            >
              📁 Click to upload .vtt or .srt file
            </button>
          </div>

          {/* Paste area */}
          <textarea
            className="w-full h-32 px-3 py-2 rounded-lg bg-[#1a1d24] border border-gray-600 text-xs text-gray-300 font-mono focus:outline-none focus:border-[#fca311] resize-none mb-3"
            placeholder={`Paste ${format.toUpperCase()} subtitle content here…`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={!text.trim()}
              className="flex-1 py-2 rounded-lg bg-[#fca311] text-black font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-400 transition-colors"
            >
              Import
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
