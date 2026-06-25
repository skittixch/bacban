import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Cloud,
  Database,
  Download,
  HardDrive,
  Moon,
  RotateCcw,
  Save,
  Sun,
  Upload,
} from 'lucide-react';

const RETENTION_OPTIONS = [
  { value: 1, label: '1 day' },
  { value: 3, label: '3 days' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 0, label: 'Never' },
];

const STORAGE_OPTIONS = [
  { value: 'server', label: 'Docker JSON API', icon: Database },
  { value: 'browser', label: 'This browser', icon: HardDrive },
];

const PROVIDERS = [
  { id: 'google-drive', label: 'Google Drive' },
  { id: 'dropbox', label: 'Dropbox' },
];

const downloadJson = (data) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bacban-board-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const SettingsPanel = ({
  themes,
  currentTheme,
  isDarkMode,
  settings,
  storageConfig,
  projectColors,
  setCurrentTheme,
  setIsDarkMode,
  updateSettings,
  updateStorageConfig,
  updateProjectColorName,
  exportData,
  importData,
  isDemoMode,
  resetDemoData,
}) => {
  const fileInputRef = useRef(null);
  const [apiUrlDraft, setApiUrlDraft] = useState(storageConfig.apiUrl || '');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setApiUrlDraft(storageConfig.apiUrl || '');
  }, [storageConfig.apiUrl]);

  const report = (message) => {
    setError('');
    setNotice(message);
  };

  const reportError = (message) => {
    setNotice('');
    setError(message);
  };

  const handleStorageModeChange = async (mode) => {
    if (isDemoMode && mode !== 'browser') {
      reportError('The public demo uses browser storage only.');
      return;
    }

    const ok = await updateStorageConfig({ mode });
    if (ok) report(mode === 'browser' ? 'Browser storage is active.' : 'Docker API storage is active.');
    else reportError('Could not switch storage.');
  };

  const handleApiUrlApply = async () => {
    const ok = await updateStorageConfig({ apiUrl: apiUrlDraft });
    if (ok) report('API URL applied.');
    else reportError('Could not load that API URL.');
  };

  const handleExport = () => {
    downloadJson(exportData());
    report('Board JSON exported.');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const ok = await importData(parsed);
        if (ok) report('Board JSON imported.');
        else reportError('Import loaded but could not save.');
      } catch (importError) {
        reportError(importError.message || 'Import failed.');
      } finally {
        event.target.value = '';
      }
    };
    reader.onerror = () => {
      reportError('Could not read that file.');
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleResetDemoData = async () => {
    const ok = await resetDemoData?.();
    if (ok) report('Sample board reset.');
    else reportError('Could not reset the sample board.');
  };

  const ActiveStorageIcon = storageConfig.mode === 'browser' ? HardDrive : Database;

  return (
    <div
      id="settings-panel"
      className="settings-panel border-b bg-[var(--surface-primary)] border-[var(--border-default)]"
      style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div className="max-w-full mx-auto px-5 py-4">
        <div className="settings-grid">
          <section className="settings-section">
            <p className="settings-section-title">Look</p>
            <div className="settings-theme-row">
              {Object.entries(themes).map(([key, theme]) => (
                <button
                  key={key}
                  type="button"
                  className={`settings-theme-btn ${currentTheme === key ? 'is-active' : ''}`}
                  onClick={() => setCurrentTheme(key)}
                  aria-pressed={currentTheme === key}
                  title={theme.name}
                >
                  <span className="settings-theme-swatch" style={{ background: theme.primary }} />
                  <span>{theme.name}</span>
                </button>
              ))}
            </div>
            <div className="settings-field-row">
              <label htmlFor="settings-density">Card density</label>
              <select
                id="settings-density"
                value={settings.cardDensity}
                onChange={(event) => updateSettings({ cardDensity: event.target.value })}
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </div>
            <button
              type="button"
              className="settings-command"
              onClick={() => setIsDarkMode(value => !value)}
            >
              {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
              <span>{isDarkMode ? 'Light mode' : 'Dark mode'}</span>
            </button>
          </section>

          <section className="settings-section">
            <p className="settings-section-title">Completed</p>
            <div className="settings-field-row">
              <label htmlFor="settings-retention">Remove after</label>
              <select
                id="settings-retention"
                value={settings.completedTaskRetentionDays}
                onChange={(event) => updateSettings({ completedTaskRetentionDays: Number(event.target.value) })}
              >
                {RETENTION_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <label className="settings-toggle-row">
              <span>Fade before removal</span>
              <input
                type="checkbox"
                checked={settings.completedTaskFade}
                onChange={(event) => updateSettings({ completedTaskFade: event.target.checked })}
              />
            </label>
            <label className="settings-toggle-row">
              <span>Completion burst</span>
              <input
                type="checkbox"
                checked={settings.completionCelebration}
                onChange={(event) => updateSettings({ completionCelebration: event.target.checked })}
              />
            </label>
          </section>

          <section className="settings-section settings-section-wide">
            <p className="settings-section-title">Storage</p>
            <div className="settings-storage-current">
              <ActiveStorageIcon size={15} />
              <span>{isDemoMode ? 'Demo browser storage' : storageConfig.mode === 'browser' ? 'This browser' : 'Docker JSON API'}</span>
              <Check size={14} />
            </div>
            {isDemoMode && (
              <p className="settings-demo-note">
                Demo changes are kept in this browser's local storage and can disappear if site data is cleared.
              </p>
            )}
            <div className="settings-storage-options" role="group" aria-label="Storage mode">
              {STORAGE_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={`settings-storage-option ${storageConfig.mode === value ? 'is-active' : ''}`}
                  onClick={() => handleStorageModeChange(value)}
                  aria-pressed={storageConfig.mode === value}
                  disabled={isDemoMode && value !== 'browser'}
                  title={isDemoMode && value !== 'browser' ? 'The public demo uses browser storage only.' : label}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            {!isDemoMode && (
              <div className="settings-api-row">
                <input
                  type="url"
                  value={apiUrlDraft}
                  onChange={(event) => setApiUrlDraft(event.target.value)}
                  placeholder="http://127.0.0.1:3001"
                  aria-label="Custom API URL"
                />
                <button type="button" className="settings-command icon-only" onClick={handleApiUrlApply} title="Apply API URL" aria-label="Apply API URL">
                  <Save size={15} />
                </button>
              </div>
            )}
            <div className="settings-action-row">
              {isDemoMode && (
                <button type="button" className="settings-command" onClick={handleResetDemoData}>
                  <RotateCcw size={15} />
                  <span>Reset demo</span>
                </button>
              )}
              <button type="button" className="settings-command" onClick={handleExport}>
                <Download size={15} />
                <span>Export</span>
              </button>
              <button type="button" className="settings-command" onClick={handleImportClick}>
                <Upload size={15} />
                <span>Import</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportFile}
              />
            </div>
            <div className="settings-provider-row">
              {PROVIDERS.map(provider => (
                <button
                  key={provider.id}
                  type="button"
                  className="settings-provider-option"
                  disabled
                  title="Needs connector"
                >
                  <Cloud size={14} />
                  <span>{provider.label}</span>
                  <small>Needs connector</small>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section settings-section-wide">
            <p className="settings-section-title">Projects</p>
            <div className="settings-project-grid">
              {projectColors && Object.entries(projectColors).map(([hex, name]) => (
                <label key={hex} className="settings-project-field">
                  <span className="settings-color-dot" style={{ background: hex }} />
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => updateProjectColorName(hex, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="settings-section settings-shortcuts">
            <p className="settings-section-title">Shortcuts</p>
            <div className="settings-shortcut-list">
              {[['Ctrl+Z', 'Undo'], ['Ctrl+Shift+Z', 'Redo'], ['T', 'Dark'], ['S', 'Settings'], ['ESC', 'Close']].map(([key, label]) => (
                <span key={key}>
                  <kbd>{key}</kbd> {label}
                </span>
              ))}
            </div>
            {(notice || error) && (
              <p className={`settings-message ${error ? 'is-error' : ''}`}>
                {error || notice}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
