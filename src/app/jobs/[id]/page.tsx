'use client';

/**
 * Job Details Page
 * View job details and QR code (Requester) or job info (Helper)
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import QRCode from 'qrcode';
import { getPriceAmount, formatPrice } from '@/lib/pricing';

interface Job {
  id: string;
  title: string;
  description: string;
  location: string;
  eventTime: string;
  contentType: string;
  notes: string | null;
  priceTier: string;
  status: string;
  requesterId: string;
  requester: {
    name: string | null;
    email: string;
  };
  assignments: Array<{
    id: string;
    helperId: string;
    helper: {
      id: string;
      name: string | null;
      email: string;
    };
  }>;
  uploads: Array<{
    id: string;
    s3Key: string;
    s3Bucket: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    uploadedAt: string;
  }>;
}

interface CurrentUser {
  id: string;
  role: 'REQUESTER' | 'HELPER';
}

interface QRData {
  token: string;
  shortCode: string;
  expiresAt: string;
}

export default function JobDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    loadUserAndJob();
  }, []);

  const loadUserAndJob = async () => {
    try {
      // Get current user
      const userRes = await fetch('/api/auth/me');
      if (userRes.ok) {
        const userData = await userRes.json();
        setCurrentUser({ id: userData.user.id, role: userData.user.role });
      }

      // Load job
      await loadJob();
    } catch (error) {
      console.error('Failed to load:', error);
      setLoading(false);
    }
  };

  const loadJob = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`);
      if (response.ok) {
        const data = await response.json();
        setJob(data.job);
      } else {
        alert('Job not found');
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Failed to load job:', error);
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Use back camera on mobile
        audio: false,
      });
      setStream(mediaStream);
      setCameraActive(true);

      // Show video preview
      setTimeout(() => {
        const videoElement = document.getElementById('cameraPreview') as HTMLVideoElement;
        if (videoElement) {
          videoElement.srcObject = mediaStream;
        }
      }, 100);
    } catch (error) {
      console.error('Camera access denied:', error);
      alert('Camera access is required to capture photos. Please enable camera permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const capturePhoto = async () => {
    const videoElement = document.getElementById('cameraPreview') as HTMLVideoElement;
    if (!videoElement) return;

    // Create canvas to capture frame
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoElement, 0, 0);

    // Convert to blob
    canvas.toBlob(async (blob) => {
      if (!blob) return;

      const fileName = `photo-${Date.now()}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });

      // Upload immediately
      await uploadSingleFile(file);
    }, 'image/jpeg', 0.9);
  };

  const uploadSingleFile = async (file: File) => {
    try {
      setUploading(true);

      // 1. Get pre-signed URL
      const urlResponse = await fetch('/api/uploads/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });

      if (!urlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { url, key, bucket } = await urlResponse.json();

      // 2. Upload to S3
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // 3. Record upload in database
      await fetch(`/api/jobs/${jobId}/uploads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          s3Key: key,
          s3Bucket: bucket,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      alert('Photo uploaded successfully! ✅');
      loadJob(); // Reload to show uploads
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    const newProgress: Record<number, number> = {};
    selectedFiles.forEach((_, i) => (newProgress[i] = 0));
    setUploadProgress(newProgress);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];

        // 1. Get pre-signed URL
        const urlResponse = await fetch('/api/uploads/presigned-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            filename: file.name,
            contentType: file.type,
            fileSize: file.size,
          }),
        });

        if (!urlResponse.ok) {
          throw new Error('Failed to get upload URL');
        }

        const { url, key, bucket } = await urlResponse.json();

        // 2. Upload to S3
        setUploadProgress((prev) => ({ ...prev, [i]: 10 }));

        const uploadResponse = await fetch(url, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file');
        }

        setUploadProgress((prev) => ({ ...prev, [i]: 80 }));

        // 3. Record upload in database
        await fetch(`/api/jobs/${jobId}/uploads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            s3Key: key,
            s3Bucket: bucket,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          }),
        });

        setUploadProgress((prev) => ({ ...prev, [i]: 100 }));
      }

      alert('All files uploaded successfully!');
      setSelectedFiles([]);
      setUploadProgress({});
      loadJob(); // Reload to show uploads
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const generateQRCode = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/qr`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setQrData(data);

        // Generate QR code URL that includes the token
        const joinUrl = `${window.location.origin}/join/${data.token}`;

        // Generate QR code image from URL
        const qrUrl = await QRCode.toDataURL(joinUrl, {
          width: 300,
          margin: 2,
        });
        setQrCodeUrl(qrUrl);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to generate QR code');
      }
    } catch (error) {
      console.error('QR generation error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner w-12 h-12"></div>
      </div>
    );
  }

  if (!job || !currentUser) {
    return null;
  }

  const isRequester = currentUser.role === 'REQUESTER';
  const isHelper = currentUser.role === 'HELPER';

  // Generate S3 URL for viewing uploaded files
  const getS3Url = (s3Key: string) => {
    return `http://localhost:4566/snapspot-uploads/${s3Key}`;
  };

  const submitJobForReview = async () => {
    if (!confirm('Submit this job for review? You won\'t be able to upload more photos after submission.')) {
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}/submit`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('Job submitted for review! ✅');
        loadJob(); // Reload to update status
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to submit job');
      }
    } catch (error) {
      console.error('Submit failed:', error);
      alert('Failed to submit job. Please try again.');
    }
  };

  // Helper View
  if (isHelper) {
    return (
      <main className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="container-safe py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 hover:text-black"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{job.title}</h1>
                <p className="text-sm text-gray-600">Helper View</p>
              </div>
              <span className={`badge badge-${job.status.toLowerCase()}`}>
                {job.status}
              </span>
            </div>
          </div>
        </header>

        <div className="container-safe py-8 max-w-2xl">
          {/* Upload Section */}
          <div className="card mb-6">
            <h2 className="text-xl font-bold mb-4">📸 Capture Content</h2>

            {!cameraActive ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                <div className="w-16 h-16 bg-gold rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold mb-2">Start Camera</h3>
                <p className="text-gray-600 mb-4">
                  Photos are uploaded directly to secure cloud storage
                </p>
                <button onClick={startCamera} className="btn btn-gold">
                  📸 Open Camera
                </button>
                <p className="text-xs text-gray-500 mt-4">
                  ✓ No photos saved on your device<br />
                  ✓ Instant upload to S3<br />
                  ✓ Requester-owned content
                </p>
              </div>
            ) : (
              <div>
                <div className="relative bg-black rounded-lg overflow-hidden mb-4">
                  <video
                    id="cameraPreview"
                    autoPlay
                    playsInline
                    className="w-full h-auto"
                  />
                  {uploading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <div className="text-white text-center">
                        <div className="spinner w-12 h-12 mx-auto mb-2"></div>
                        <p>Uploading...</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={capturePhoto}
                    disabled={uploading}
                    className="btn btn-gold flex-1"
                  >
                    📸 Capture Photo
                  </button>
                  <button
                    onClick={stopCamera}
                    className="btn btn-secondary"
                  >
                    ✕ Close
                  </button>
                </div>

                <p className="text-sm text-gray-500 mt-3 text-center">
                  Each photo uploads instantly to S3 (not saved locally)
                </p>
              </div>
            )}
          </div>

          {/* Uploaded Photos */}
          {job.uploads.length > 0 && (
            <div className="card mb-6">
              <h2 className="text-xl font-bold mb-4">
                📸 Uploaded Photos ({job.uploads.length})
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {job.uploads.map((upload) => (
                  <a
                    key={upload.id}
                    href={getS3Url(upload.s3Key)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square bg-gray-100 rounded-lg overflow-hidden hover:ring-2 hover:ring-gold transition-all"
                  >
                    {upload.fileType.startsWith('image/') ? (
                      <img
                        src={getS3Url(upload.s3Key)}
                        alt={upload.fileName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </a>
                ))}
              </div>

              {/* Submit Button */}
              {(job.status === 'ACCEPTED' || job.status === 'IN_PROGRESS') && (
                <button
                  onClick={submitJobForReview}
                  className="btn btn-gold w-full"
                >
                  ✓ Submit for Review ({job.uploads.length} {job.uploads.length === 1 ? 'photo' : 'photos'})
                </button>
              )}

              {job.status === 'UPLOADED' && (
                <div className="text-center py-4 bg-green-50 rounded-lg">
                  <p className="text-green-700 font-medium">✓ Submitted for review</p>
                  <p className="text-sm text-green-600 mt-1">Waiting for requester approval</p>
                </div>
              )}

              {job.status === 'COMPLETED' && (
                <div className="text-center py-4 bg-gold bg-opacity-10 rounded-lg">
                  <p className="text-gold font-medium">✓ Job Completed!</p>
                  <p className="text-sm text-gray-600 mt-1">Payment will be processed</p>
                </div>
              )}
            </div>
          )}

          {/* Job Instructions */}
          <div className="card mb-6">
            <h2 className="text-xl font-bold mb-4">Job Instructions</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">What to Capture</label>
                <p className="mt-1">{job.description}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Location</label>
                  <p className="mt-1">{job.location}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Event Time</label>
                  <p className="mt-1">{new Date(job.eventTime).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Content Type</label>
                  <p className="mt-1 capitalize">{job.contentType}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Payment</label>
                  <p className="mt-1 capitalize font-medium text-gold">{job.priceTier} tier</p>
                </div>
              </div>

              {job.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Special Instructions</label>
                  <p className="mt-1 bg-yellow-50 p-3 rounded-lg text-gray-700">{job.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Requester Info */}
          <div className="card mt-6">
            <h3 className="text-lg font-bold mb-3">Requester</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-lg font-bold">
                  {job.requester.name?.[0] || job.requester.email[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium">{job.requester.name || 'Unknown'}</p>
                <p className="text-sm text-gray-600">{job.requester.email}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Requester View
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container-safe py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-black"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{job.title}</h1>
              <p className="text-sm text-gray-600">Job Details</p>
            </div>
            <span className={`badge badge-${job.status.toLowerCase()}`}>
              {job.status}
            </span>
          </div>
        </div>
      </header>

      <div className="container-safe py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Info */}
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Job Information</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Description</label>
                  <p className="mt-1">{job.description}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Location</label>
                    <p className="mt-1 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      {job.location}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">Event Time</label>
                    <p className="mt-1 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {new Date(job.eventTime).toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">Content Type</label>
                    <p className="mt-1 capitalize">{job.contentType}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">Price Tier</label>
                    <p className="mt-1 capitalize">{job.priceTier}</p>
                  </div>
                </div>

                {job.notes && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Additional Notes</label>
                    <p className="mt-1 text-gray-700">{job.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Helpers Working on This Job */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Helpers</h3>
                {job.assignments.length > 0 && (
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Total Cost</p>
                    <p className="text-xl font-bold text-gold">
                      {formatPrice(job.assignments.length * getPriceAmount(job.priceTier))}
                    </p>
                  </div>
                )}
              </div>

              {job.assignments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p className="text-sm">No helpers assigned yet</p>
                  <p className="text-xs mt-1">Share your QR code to get helpers</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {job.assignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 bg-gold rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-bold text-black">
                          {assignment.helper.name?.[0] || assignment.helper.email[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{assignment.helper.name || 'Helper'}</p>
                        <p className="text-sm text-gray-600 truncate">{assignment.helper.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`badge badge-${job.status.toLowerCase()} text-xs`}>
                            {job.status}
                          </span>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs font-medium text-gold capitalize">
                            {formatPrice(getPriceAmount(job.priceTier))} ({job.priceTier})
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Uploaded Content */}
            {job.uploads.length > 0 && (
              <div className="card">
                <h3 className="text-lg font-bold mb-4">
                  Uploaded Content ({job.uploads.length})
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {job.uploads.map((upload) => (
                    <a
                      key={upload.id}
                      href={getS3Url(upload.s3Key)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-square bg-gray-100 rounded-lg overflow-hidden hover:ring-2 hover:ring-gold transition-all"
                    >
                      {upload.fileType.startsWith('image/') ? (
                        <img
                          src={getS3Url(upload.s3Key)}
                          alt={upload.fileName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Requester Info */}
            <div className="card">
              <h3 className="text-lg font-bold mb-3">Requester</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-lg font-bold">
                    {job.requester.name?.[0] || job.requester.email[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{job.requester.name || 'Unknown'}</p>
                  <p className="text-sm text-gray-600">{job.requester.email}</p>
                </div>
              </div>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-bold mb-4">QR Code</h2>

              {!qrData ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 mb-4">Generate a QR code for Helpers to scan</p>
                  <button
                    onClick={generateQRCode}
                    className="btn btn-primary w-full"
                  >
                    Generate QR Code
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="bg-white p-4 rounded-lg inline-block mb-4">
                    <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-600 mb-1">Backup Code</p>
                    <p className="text-2xl font-bold font-mono tracking-wider">
                      {qrData.shortCode}
                    </p>
                  </div>

                  <p className="text-xs text-gray-500 mb-4">
                    Expires: {new Date(qrData.expiresAt).toLocaleString()}
                  </p>

                  <button
                    onClick={generateQRCode}
                    className="btn btn-secondary w-full text-sm"
                  >
                    Regenerate QR Code
                  </button>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            {job.status === 'OPEN' && (
              <div className="card">
                <h3 className="text-lg font-bold mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button className="btn btn-secondary w-full text-sm">
                    Edit Job
                  </button>
                  <button className="btn btn-secondary w-full text-sm text-red-600 border-red-200 hover:bg-red-50">
                    Cancel Job
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
