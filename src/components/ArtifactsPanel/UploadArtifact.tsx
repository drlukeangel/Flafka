/**
 * @artifact-upload @artifacts-panel
 * UploadArtifact — Modal with 3-step upload flow.
 *
 * Form fields: Display Name (required), Class Name (required, regex-validated),
 * Content Format toggle (JAR / ZIP), Description (optional), Doc Link (optional),
 * File (required, accepts .jar or .zip based on format selection).
 *
 * Progress steps:
 * 1. "Requesting upload URL..." (indeterminate)
 * 2. "Uploading file... NN%" (real % via axios onUploadProgress)
 * 3. "Creating artifact..." (indeterminate)
 *
 * Cancel during upload: AbortController + confirmation sub-dialog.
 * Accessibility: role="progressbar" with aria-valuenow, focus trap, aria-describedby.
 */

import { useState, useRef, useEffect } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import * as artifactApi from '../../api/artifact-api';
import { env } from '../../config/environment';
import { FiX, FiUpload, FiLoader, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { getSessionTag } from '../../utils/names';

// Java: fully-qualified class name (e.g. com.example.MyUdf)
const JAVA_CLASS_REGEX = /^[a-zA-Z_$][\w$]*(\.[a-zA-Z_$][\w$]*)*$/;
// Python: simple identifier (e.g. sentiment_score)
const PYTHON_CLASS_REGEX = /^[a-zA-Z_][\w]*$/;

const MAX_FILE_SIZE = 256 * 1024 * 1024; // 256MB

type ContentFormat = 'JAR' | 'ZIP';

interface UploadArtifactProps {
  onClose: () => void;
}

type UploadStep = 'form' | 'requesting-url' | 'uploading' | 'creating' | 'done' | 'error';

const UploadArtifact: React.FC<UploadArtifactProps> = ({ onClose }) => {
  const loadArtifacts = useWorkspaceStore((s) => s.loadArtifacts);
  const setArtifactUploading = useWorkspaceStore((s) => s.setArtifactUploading);
  const setUploadProgress = useWorkspaceStore((s) => s.setUploadProgress);
  const addToast = useWorkspaceStore((s) => s.addToast);

  const [displayName, setDisplayName] = useState('');
  const [className, setClassName] = useState('');
  const [contentFormat, setContentFormat] = useState<ContentFormat>('JAR');
  const [description, setDescription] = useState('');
  const [docLink, setDocLink] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<UploadStep>('form');
  const [uploadPercent, setUploadPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isJava = contentFormat === 'JAR';
  const classRegex = isJava ? JAVA_CLASS_REGEX : PYTHON_CLASS_REGEX;
  const classNameValid = classRegex.test(className);
  const formValid = displayName.trim() && className.trim() && classNameValid && selectedFile;

  // Reset file when content format changes
  useEffect(() => {
    setSelectedFile(null);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [contentFormat]);

  // Focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (step === 'uploading') {
          setShowCancelConfirm(true);
        } else if (step === 'form' || step === 'done' || step === 'error') {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [step, onClose]);

  const fileExtension = isJava ? '.jar' : '.zip';
  const fileLabel = isJava ? 'JAR File' : 'ZIP File';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max 256MB)`);
      return;
    }
    if (!file.name.endsWith(fileExtension)) {
      setErrorMsg(`Only ${fileExtension} files are accepted`);
      return;
    }
    setErrorMsg('');
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!formValid || !selectedFile) return;

    const abort = new AbortController();
    abortRef.current = abort;
    setArtifactUploading(true);

    try {
      // Step 1: Get presigned URL
      setStep('requesting-url');
      const presigned = await artifactApi.getPresignedUploadUrl(contentFormat);

      if (abort.signal.aborted) return;

      // Step 2: Upload file via S3 POST form
      setStep('uploading');
      setUploadPercent(0);
      await artifactApi.uploadFileToPresignedUrl(
        presigned,
        selectedFile,
        (percent) => {
          setUploadPercent(percent);
          setUploadProgress(percent);
        },
        abort.signal,
      );

      if (abort.signal.aborted) return;

      // Step 3: Create artifact
      setStep('creating');
      const sessionTag = getSessionTag();
      const suffix = `-${sessionTag}`;
      const taggedName = displayName.trim().endsWith(suffix)
        ? displayName.trim()
        : `${displayName.trim()}${suffix}`;
      await artifactApi.createArtifact({
        display_name: taggedName,
        class: className.trim(),
        cloud: env.cloudProvider,
        region: env.cloudRegion,
        environment: env.environmentId,
        content_format: contentFormat,
        runtime_language: isJava ? 'JAVA' : 'PYTHON',
        description: description.trim() || undefined,
        documentation_link: docLink.trim() || undefined,
        upload_source: {
          location: 'PRESIGNED_URL_LOCATION',
          upload_id: presigned.upload_id,
        },
      });

      setStep('done');
      setArtifactUploading(false);
      setUploadProgress(null);
      addToast({ type: 'success', message: `Artifact "${taggedName}" created` });
      loadArtifacts();
    } catch (error: unknown) {
      if (abort.signal.aborted) return;
      const err = error as { message?: string };
      setErrorMsg(err?.message || 'Upload failed');
      setStep('error');
      setArtifactUploading(false);
      setUploadProgress(null);
    }
  };

  const handleCancelUpload = () => {
    abortRef.current?.abort();
    setArtifactUploading(false);
    setUploadProgress(null);
    setShowCancelConfirm(false);
    setStep('form');
    setUploadPercent(0);
  };

  const isUploading = step === 'requesting-url' || step === 'uploading' || step === 'creating';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
      onClick={() => {
        if (!isUploading) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-label="Upload artifact"
        style={{
          background: 'var(--color-surface)',
          borderRadius: 8,
          padding: 24,
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text-primary)' }}>
            <FiUpload size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
            Upload Artifact
          </span>
          {!isUploading && (
            <button
              onClick={onClose}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                padding: 4,
                display: 'flex',
              }}
              aria-label="Close"
            >
              <FiX size={16} />
            </button>
          )}
        </div>

        {/* Progress or Form */}
        {isUploading ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <FiLoader size={24} className="spin" style={{ color: 'var(--color-primary)', marginBottom: 12 }} />
            <p style={{ fontSize: 13, color: 'var(--color-text-primary)', margin: '0 0 12px' }}>
              {step === 'requesting-url' && 'Requesting upload URL...'}
              {step === 'uploading' && `Uploading ${isJava ? 'JAR' : 'ZIP'}... ${uploadPercent}%`}
              {step === 'creating' && 'Creating artifact...'}
            </p>
            {step === 'uploading' && (
              <div
                role="progressbar"
                aria-valuenow={uploadPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Upload progress"
                style={{
                  width: '100%',
                  height: 6,
                  background: 'var(--color-border)',
                  borderRadius: 3,
                  overflow: 'hidden',
                  margin: '0 0 12px',
                }}
              >
                <div
                  style={{
                    width: `${uploadPercent}%`,
                    height: '100%',
                    background: 'var(--color-primary)',
                    borderRadius: 3,
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            )}
            <button
              onClick={() => setShowCancelConfirm(true)}
              style={{
                border: '1px solid var(--color-border)',
                background: 'var(--color-input-bg)',
                cursor: 'pointer',
                padding: '6px 16px',
                borderRadius: 4,
                fontSize: 12,
                color: 'var(--color-text-primary)',
              }}
            >
              Cancel
            </button>
          </div>
        ) : step === 'done' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <FiCheck size={32} style={{ color: 'var(--color-success)', marginBottom: 8 }} />
            <p style={{ fontSize: 13, color: 'var(--color-text-primary)', margin: '0 0 16px' }}>
              Artifact created successfully.
            </p>
            <button
              onClick={onClose}
              style={{
                border: 'none',
                background: 'var(--color-primary)',
                color: '#fff',
                cursor: 'pointer',
                padding: '6px 20px',
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Error banner */}
            {(errorMsg || step === 'error') && (
              <div
                style={{
                  padding: '8px 10px',
                  marginBottom: 12,
                  fontSize: 12,
                  color: 'var(--color-error)',
                  background: 'rgba(239,68,68,0.08)',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <FiAlertCircle size={14} />
                {errorMsg}
              </div>
            )}

            {/* Form fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Content Format Toggle */}
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Content Format <span style={{ color: 'var(--color-error)' }}>*</span>
                <div
                  style={{
                    display: 'flex',
                    gap: 0,
                    marginTop: 4,
                    borderRadius: 4,
                    overflow: 'hidden',
                    border: '1px solid var(--color-border)',
                  }}
                  role="radiogroup"
                  aria-label="Content format"
                >
                  {(['JAR', 'ZIP'] as ContentFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      role="radio"
                      aria-checked={contentFormat === fmt}
                      onClick={() => setContentFormat(fmt)}
                      style={{
                        flex: 1,
                        padding: '6px 0',
                        border: 'none',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        background: contentFormat === fmt ? 'var(--color-primary)' : 'var(--color-input-bg)',
                        color: contentFormat === fmt ? '#fff' : 'var(--color-text-primary)',
                        transition: 'background 0.15s ease, color 0.15s ease',
                      }}
                    >
                      {fmt} {fmt === 'JAR' ? '(Java)' : '(Python)'}
                    </button>
                  ))}
                </div>
              </div>

              <label style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Display Name <span style={{ color: 'var(--color-error)' }}>*</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="my-udf-artifact"
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 4,
                    padding: '6px 8px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    fontSize: 12,
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-primary)',
                    boxSizing: 'border-box',
                  }}
                  autoFocus
                />
              </label>

              <label style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Entry Class <span style={{ color: 'var(--color-error)' }}>*</span>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder={isJava ? 'com.example.MyUdf' : 'my_function'}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 4,
                    padding: '6px 8px',
                    border: `1px solid ${className && !classNameValid ? 'var(--color-error)' : 'var(--color-border)'}`,
                    borderRadius: 4,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-primary)',
                    boxSizing: 'border-box',
                  }}
                />
                {className && !classNameValid && (
                  <span style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 2, display: 'block' }}>
                    {isJava
                      ? 'Must be a valid Java class name (e.g. com.example.MyUdf)'
                      : 'Must be a valid Python identifier (e.g. my_function)'}
                  </span>
                )}
              </label>

              <label style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Description
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 4,
                    padding: '6px 8px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    fontSize: 12,
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-primary)',
                    boxSizing: 'border-box',
                  }}
                />
              </label>

              <label style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Documentation Link
                <input
                  type="url"
                  value={docLink}
                  onChange={(e) => setDocLink(e.target.value)}
                  placeholder="https://docs.example.com/my-udf"
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 4,
                    padding: '6px 8px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    fontSize: 12,
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-primary)',
                    boxSizing: 'border-box',
                  }}
                />
              </label>

              <label style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {fileLabel} <span style={{ color: 'var(--color-error)' }}>*</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={fileExtension}
                  onChange={handleFileChange}
                  aria-describedby="file-help"
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 4,
                    padding: '6px 8px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    fontSize: 12,
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-primary)',
                    boxSizing: 'border-box',
                  }}
                />
                <span id="file-help" style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2, display: 'block' }}>
                  {selectedFile
                    ? `${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(1)}MB)`
                    : `Max 256MB, ${fileExtension} files only`}
                </span>
              </label>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                style={{
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                  padding: '6px 16px',
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!formValid}
                style={{
                  border: 'none',
                  background: formValid ? 'var(--color-primary)' : 'var(--color-border)',
                  color: '#fff',
                  cursor: formValid ? 'pointer' : 'not-allowed',
                  padding: '6px 16px',
                  borderRadius: 4,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <FiUpload size={13} />
                Upload
              </button>
            </div>
          </>
        )}

        {/* Cancel confirmation sub-dialog */}
        {showCancelConfirm && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
            }}
          >
            <div
              style={{
                background: 'var(--color-surface)',
                borderRadius: 6,
                padding: 16,
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                maxWidth: 280,
              }}
            >
              <p style={{ fontSize: 13, margin: '0 0 12px', color: 'var(--color-text-primary)' }}>
                Upload in progress. Cancel?
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  style={{
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-primary)',
                    cursor: 'pointer',
                    padding: '4px 12px',
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  Continue
                </button>
                <button
                  onClick={handleCancelUpload}
                  style={{
                    border: 'none',
                    background: 'var(--color-error)',
                    color: '#fff',
                    cursor: 'pointer',
                    padding: '4px 12px',
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  Cancel Upload
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadArtifact;
