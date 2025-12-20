'use client';

/**
 * Job Details Page
 * View job details and QR code (Requester) or job info (Helper)
 */

import { useEffect, useState, useRef } from 'react';
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
  submittedAt: string | null;
  completedAt: string | null;
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
    thumbnailKey?: string;
  }>;
}

interface CurrentUser {
  id: string;
  roles: ('REQUESTER' | 'HELPER')[];
  activeRole: 'REQUESTER' | 'HELPER';
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
  // const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  // const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captureMode, setCaptureMode] = useState<'photo' | 'video'>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  useEffect(() => {
    loadUserAndJob();
  }, []);

  // Cleanup camera stream on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [stream]);

  useEffect(() => {
    // Keyboard shortcuts for media viewer
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewerOpen || !job) return;

      if (e.key === 'Escape') {
        setViewerOpen(false);
      } else if (e.key === 'ArrowLeft') {
        navigatePrevious();
      } else if (e.key === 'ArrowRight') {
        navigateNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewerOpen, currentMediaIndex, job]);

  const openMediaViewer = (index: number) => {
    setCurrentMediaIndex(index);
    setViewerOpen(true);
  };

  const closeMediaViewer = () => {
    setViewerOpen(false);
  };

  const navigatePrevious = () => {
    if (!job) return;
    setCurrentMediaIndex((prev) => (prev > 0 ? prev - 1 : job.uploads.length - 1));
  };

  const navigateNext = () => {
    if (!job) return;
    setCurrentMediaIndex((prev) => (prev < job.uploads.length - 1 ? prev + 1 : 0));
  };

  const deleteUpload = async (uploadId: string) => {
    if (!confirm('Delete this file? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}/uploads/${uploadId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('File deleted successfully');
        loadJob(); // Reload to update gallery
        setViewerOpen(false); // Close modal
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete file. Please try again.');
    }
  };

  const loadUserAndJob = async () => {
    try {
      // Get current user
      const userRes = await fetch('/api/auth/me');
      if (userRes.ok) {
        const userData = await userRes.json();
        setCurrentUser({
          id: userData.user.id,
          roles: userData.user.roles,
          activeRole: userData.user.activeRole,
        });
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
        audio: captureMode === 'video', // Enable audio for video recording
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
      alert('Camera access is required to capture content. Please enable camera permissions.');
    }
  };

  const stopCamera = () => {
    if (isRecording) {
      stopRecording();
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setCameraActive(false);
    setRecordingTime(0);
  };

  const startRecording = () => {
    if (!stream) return;

    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm',
    });

    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const fileName = `video-${Date.now()}.webm`;
      const file = new File([blob], fileName, { type: 'video/webm' });

      // Generate thumbnail from video
      const thumbnail = await generateVideoThumbnail(blob);

      await uploadSingleFile(file, thumbnail);
      setRecordingTime(0);

      // Stop camera stream after recording
      stopCamera();
    };

    recorder.start();
    setMediaRecorder(recorder);
    setIsRecording(true);

    // Start timer
    recordingIntervalRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const generateVideoThumbnail = async (videoBlob: Blob): Promise<File | null> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      video.onloadeddata = () => {
        // Seek to 1 second or 10% of duration
        video.currentTime = Math.min(1, video.duration * 0.1);
      };

      video.onseeked = () => {
        // Create canvas and capture frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);

        // Convert to blob
        canvas.toBlob((blob) => {
          if (blob) {
            const thumbnailFile = new File([blob], `thumbnail-${Date.now()}.jpg`, {
              type: 'image/jpeg',
            });
            resolve(thumbnailFile);
          } else {
            resolve(null);
          }
        }, 'image/jpeg', 0.8);

        // Cleanup
        URL.revokeObjectURL(video.src);
      };

      video.onerror = () => {
        resolve(null);
        URL.revokeObjectURL(video.src);
      };

      video.src = URL.createObjectURL(videoBlob);
    });
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
      await uploadSingleFile(file, null);
    }, 'image/jpeg', 0.9);
  };

  const uploadSingleFile = async (file: File, thumbnail: File | null) => {
    try {
      setUploading(true);

      let thumbnailKey = null;

      // Upload thumbnail first if exists
      if (thumbnail) {
        console.log('Uploading video thumbnail...', {
          name: thumbnail.name,
          type: thumbnail.type,
          size: thumbnail.size
        });

        try {
          const thumbUrlResponse = await fetch('/api/uploads/presigned-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobId,
              filename: thumbnail.name,
              contentType: thumbnail.type,
              fileSize: thumbnail.size,
            }),
          });

          if (thumbUrlResponse.ok) {
            const { url: thumbUrl, key: thumbKey } = await thumbUrlResponse.json();
            console.log('Got thumbnail presigned URL:', thumbKey);

            const thumbUploadResponse = await fetch(thumbUrl, {
              method: 'PUT',
              body: thumbnail,
              headers: {
                'Content-Type': thumbnail.type,
              },
            });

            if (thumbUploadResponse.ok) {
              thumbnailKey = thumbKey;
              console.log('Thumbnail uploaded successfully:', thumbKey);
            } else {
              console.error('Thumbnail upload failed:', thumbUploadResponse.status, await thumbUploadResponse.text());
            }
          } else {
            const errorText = await thumbUrlResponse.text();
            console.error('Failed to get thumbnail presigned URL:', thumbUrlResponse.status, errorText);
          }
        } catch (thumbError) {
          console.error('Thumbnail upload error (non-fatal):', thumbError);
          // Continue with main file upload even if thumbnail fails
        }
      }

      console.log('Uploading main file...', {
        name: file.name,
        type: file.type,
        size: file.size
      });

      // 1. Get pre-signed URL for main file
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
        const errorText = await urlResponse.text();
        console.error('Failed to get presigned URL:', urlResponse.status, errorText);
        throw new Error(`Failed to get upload URL: ${errorText}`);
      }

      const { url, key, bucket } = await urlResponse.json();
      console.log('Got presigned URL:', key);

      // 2. Upload to S3
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('S3 upload failed:', uploadResponse.status, errorText);
        throw new Error(`Failed to upload file to S3: ${errorText}`);
      }

      console.log('File uploaded to S3 successfully');

      // 3. Record upload in database
      console.log('Recording upload in database...', {
        s3Key: key,
        s3Bucket: bucket,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        thumbnailKey: thumbnailKey,
      });

      const recordResponse = await fetch(`/api/jobs/${jobId}/uploads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          s3Key: key,
          s3Bucket: bucket,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          ...(thumbnailKey && { thumbnailKey }),
        }),
      });

      if (!recordResponse.ok) {
        const errorData = await recordResponse.json();
        console.error('Failed to record upload in database:', recordResponse.status, errorData);
        throw new Error(`Failed to record upload in database: ${JSON.stringify(errorData)}`);
      }

      console.log('Upload recorded in database successfully');

      const isVideo = file.type.startsWith('video/');
      alert(`${isVideo ? 'Video' : 'Photo'} uploaded successfully! ✅`);
      await loadJob(); // Reload to show uploads
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally {
      setUploading(false);
    }
  };

  // const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const files = Array.from(e.target.files || []);
  //   setSelectedFiles((prev) => [...prev, ...files]);
  // };

  // const removeFile = (index: number) => {
  //   setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  // };

  // const handleUpload = async () => {
  //   if (selectedFiles.length === 0) return;
  //
  //   setUploading(true);
  //   const newProgress: Record<number, number> = {};
  //   selectedFiles.forEach((_, i) => (newProgress[i] = 0));
  //   setUploadProgress(newProgress);
  //
  //   try {
  //     for (let i = 0; i < selectedFiles.length; i++) {
  //       const file = selectedFiles[i];
  //
  //       // 1. Get pre-signed URL
  //       const urlResponse = await fetch('/api/uploads/presigned-url', {
  //         method: 'POST',
  //         headers: { 'Content-Type': 'application/json' },
  //         body: JSON.stringify({
  //           jobId,
  //           filename: file.name,
  //           contentType: file.type,
  //           fileSize: file.size,
  //         }),
  //       });
  //
  //       if (!urlResponse.ok) {
  //         throw new Error('Failed to get upload URL');
  //       }
  //
  //       const { url, key, bucket } = await urlResponse.json();
  //
  //       // 2. Upload to S3
  //       setUploadProgress((prev) => ({ ...prev, [i]: 10 }));
  //
  //       const uploadResponse = await fetch(url, {
  //         method: 'PUT',
  //         body: file,
  //         headers: {
  //           'Content-Type': file.type,
  //         },
  //       });
  //
  //       if (!uploadResponse.ok) {
  //         throw new Error('Failed to upload file');
  //       }
  //
  //       setUploadProgress((prev) => ({ ...prev, [i]: 80 }));
  //
  //       // 3. Record upload in database
  //       await fetch(`/api/jobs/${jobId}/uploads`, {
  //         method: 'POST',
  //         headers: { 'Content-Type': 'application/json' },
  //         body: JSON.stringify({
  //           s3Key: key,
  //           s3Bucket: bucket,
  //           fileName: file.name,
  //           fileType: file.type,
  //           fileSize: file.size,
  //         }),
  //       });
  //
  //       setUploadProgress((prev) => ({ ...prev, [i]: 100 }));
  //     }
  //
  //     alert('All files uploaded successfully!');
  //     setSelectedFiles([]);
  //     setUploadProgress({});
  //     loadJob(); // Reload to show uploads
  //   } catch (error) {
  //     console.error('Upload failed:', error);
  //     alert('Upload failed. Please try again.');
  //   } finally {
  //     setUploading(false);
  //   }
  // };

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

  // const isRequester = currentUser.activeRole === 'REQUESTER';
  const isHelper = currentUser.activeRole === 'HELPER';

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

  const approveJob = async () => {
    if (!confirm('Approve this job and finalize payment? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}/approve`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('Job approved! ✅');
        await loadJob(); // Reload to update status
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to approve job');
      }
    } catch (error) {
      console.error('Approve failed:', error);
      alert('Failed to approve job. Please try again.');
    }
  };

  // Calculate time remaining for review (48 hours from submission)
  const getReviewDeadline = () => {
    if (!job?.submittedAt) return null;

    const submittedTime = new Date(job.submittedAt).getTime();
    const deadlineTime = submittedTime + (48 * 60 * 60 * 1000); // 48 hours
    const now = Date.now();
    const timeRemaining = deadlineTime - now;

    if (timeRemaining <= 0) {
      return { expired: true, hours: 0, minutes: 0 };
    }

    const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
    const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));

    return { expired: false, hours, minutes };
  };

  // Helper View
  if (isHelper) {
    return (
      <main className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="container-safe py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 hover:text-black flex-shrink-0"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold truncate">{job.title}</h1>
                <p className="text-xs sm:text-sm text-gray-600">Helper View</p>
              </div>
              <span className={`badge badge-${job.status.toLowerCase()} flex-shrink-0 text-xs`}>
                {job.status}
              </span>
            </div>
          </div>
        </header>

        <div className="container-safe py-8 max-w-2xl">
          {/* Upload Section - Hide after job is completed */}
          {job.status !== 'COMPLETED' && (
            <div className="card mb-6">
              <h2 className="text-xl font-bold mb-4">
                {captureMode === 'photo' ? '📸' : '🎥'} Capture Content
              </h2>

              {!cameraActive ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                {/* Mode Switcher */}
                <div className="flex gap-2 bg-gray-100 rounded-lg p-1 max-w-xs mx-auto mb-4">
                  <button
                    onClick={() => setCaptureMode('photo')}
                    className={`flex-1 px-4 py-2 rounded text-sm font-medium transition-all ${
                      captureMode === 'photo'
                        ? 'bg-white shadow-sm'
                        : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    📸 Photo
                  </button>
                  <button
                    onClick={() => setCaptureMode('video')}
                    className={`flex-1 px-4 py-2 rounded text-sm font-medium transition-all ${
                      captureMode === 'video'
                        ? 'bg-white shadow-sm'
                        : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    🎥 Video
                  </button>
                </div>

                <div className="w-16 h-16 bg-gold rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {captureMode === 'photo' ? (
                      <>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </>
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    )}
                  </svg>
                </div>
                <h3 className="text-lg font-bold mb-2">
                  Start {captureMode === 'photo' ? 'Camera' : 'Video Recording'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {captureMode === 'photo'
                    ? 'Photos are uploaded directly to secure cloud storage'
                    : 'Videos are uploaded directly to secure cloud storage'}
                </p>
                <button onClick={startCamera} className="btn btn-gold">
                  {captureMode === 'photo' ? '📸 Open Camera' : '🎥 Open Camera'}
                </button>
                <p className="text-xs text-gray-500 mt-4">
                  ✓ No {captureMode === 'photo' ? 'photos' : 'videos'} saved on your device<br />
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
                  {captureMode === 'photo' ? (
                    <button
                      onClick={capturePhoto}
                      disabled={uploading}
                      className="btn btn-gold flex-1"
                    >
                      📸 Capture Photo
                    </button>
                  ) : (
                    <>
                      {!isRecording ? (
                        <button
                          onClick={startRecording}
                          disabled={uploading}
                          className="btn btn-gold flex-1"
                        >
                          🔴 Start Recording
                        </button>
                      ) : (
                        <button
                          onClick={stopRecording}
                          className="btn btn-gold flex-1"
                        >
                          ⏹ Stop Recording ({Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')})
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={stopCamera}
                    className="btn btn-secondary"
                    disabled={isRecording}
                  >
                    ✕ Close
                  </button>
                </div>

                <p className="text-sm text-gray-500 mt-3 text-center">
                  {captureMode === 'photo'
                    ? 'Each photo uploads instantly to S3 (not saved locally)'
                    : isRecording
                    ? '🔴 Recording... Video will upload when you stop'
                    : 'Videos upload instantly to S3 (not saved locally)'}
                </p>
              </div>
            )}
            </div>
          )}

          {/* Uploaded Content - Hide after job is approved */}
          {job.uploads.length > 0 && job.status !== 'COMPLETED' && (
            <div className="card mb-6">
              <h2 className="text-xl font-bold mb-4">
                📸 Uploaded Content ({job.uploads.length})
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {job.uploads.map((upload, index) => (
                  <button
                    key={upload.id}
                    onClick={() => openMediaViewer(index)}
                    className="aspect-square bg-gray-100 rounded-lg overflow-hidden hover:ring-2 hover:ring-gold transition-all cursor-pointer relative"
                  >
                    {upload.fileType.startsWith('image/') ? (
                      <img
                        src={getS3Url(upload.s3Key)}
                        alt={upload.fileName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        {upload.thumbnailKey ? (
                          <img
                            src={getS3Url(upload.thumbnailKey)}
                            alt={upload.fileName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-black">
                            <svg className="w-16 h-16 text-gold mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-white text-xs">Video</span>
                          </div>
                        )}
                        {/* Play icon overlay for videos */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <svg className="w-12 h-12 text-white opacity-90" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </>
                    )}
                  </button>
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

              {job.status === 'IN_REVIEW' && (
                <div className="text-center py-4 bg-green-50 rounded-lg">
                  <p className="text-green-700 font-medium">✓ Submitted for review</p>
                  <p className="text-sm text-green-600 mt-1">Waiting for requester approval</p>
                </div>
              )}

              {job.status === 'COMPLETED' && (
                <div className="text-center py-4 bg-gold bg-opacity-10 rounded-lg">
                  <p className="text-gold font-medium">✓ Job Completed!</p>
                  <p className="text-sm text-gray-600 mt-1">Payment will be processed</p>
                  <p className="text-xs text-gray-500 mt-2">Content access has been transferred to requester</p>
                </div>
              )}
            </div>
          )}

          {/* Completed Job Message - Show when uploads are hidden */}
          {job.status === 'COMPLETED' && job.uploads.length > 0 && (
            <div className="card mb-6">
              <div className="text-center py-8">
                <svg className="w-16 h-16 mx-auto mb-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-bold mb-2">Job Approved & Completed</h3>
                <p className="text-gray-600 mb-1">The requester has approved your work</p>
                <p className="text-sm text-gray-500">Content is now in the requester&apos;s possession</p>
              </div>
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

        {/* Media Viewer Modal */}
        {viewerOpen && job.uploads.length > 0 && (
          <MediaViewerModal
            uploads={job.uploads}
            currentIndex={currentMediaIndex}
            onClose={closeMediaViewer}
            onPrevious={navigatePrevious}
            onNext={navigateNext}
            getS3Url={getS3Url}
            onDelete={deleteUpload}
            canDelete={job.status !== 'COMPLETED'}
          />
        )}
      </main>
    );
  }

  // Requester View
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container-safe py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-black flex-shrink-0"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold truncate">{job.title}</h1>
              <p className="text-xs sm:text-sm text-gray-600">Job Details</p>
            </div>
            <span className={`badge badge-${job.status.toLowerCase()} flex-shrink-0 text-xs`}>
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

            {/* Work in Progress Message */}
            {job.uploads.length > 0 && job.status !== 'IN_REVIEW' && job.status !== 'COMPLETED' && (
              <div className="card">
                <div className="text-center py-8">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <h3 className="text-lg font-bold mb-2">Content Being Captured</h3>
                  <p className="text-gray-600 mb-1">Helper is working on this job</p>
                  <p className="text-sm text-gray-500">Content will appear here once submitted for review</p>
                  <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gold bg-opacity-10 rounded-lg">
                    <div className="w-2 h-2 bg-gold rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-gold">{job.uploads.length} {job.uploads.length === 1 ? 'item' : 'items'} captured</span>
                  </div>
                </div>
              </div>
            )}

            {/* Review Deadline Banner - Only show during IN_REVIEW status */}
            {job.status === 'IN_REVIEW' && (() => {
              const deadline = getReviewDeadline();
              return (
                <div className={`card ${deadline?.expired ? 'bg-red-50 border-red-200' : 'bg-gold bg-opacity-10 border-gold'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg className={`w-6 h-6 ${deadline?.expired ? 'text-red-600' : 'text-gold'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <h3 className={`font-bold ${deadline?.expired ? 'text-red-900' : 'text-black'}`}>
                          {!deadline ? 'Ready to Review' : deadline.expired ? 'Review Period Expired' : 'Review Deadline'}
                        </h3>
                        <p className={`text-sm ${deadline?.expired ? 'text-red-700' : 'text-gray-600'}`}>
                          {!deadline
                            ? 'Review the submitted content below'
                            : deadline.expired
                            ? 'Please approve or contact support'
                            : `${deadline.hours}h ${deadline.minutes}m remaining to review`
                          }
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={approveJob}
                      className="btn btn-gold"
                    >
                      ✓ Approve Job
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Uploaded Content - Only show after Helper submits for review */}
            {job.uploads.length > 0 && (job.status === 'IN_REVIEW' || job.status === 'COMPLETED') && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">
                    Uploaded Content ({job.uploads.length})
                  </h3>
                  {job.status === 'IN_REVIEW' && (
                    <p className="text-sm text-gray-600">Review and delete unwanted items</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {job.uploads.map((upload, index) => (
                    <button
                      key={upload.id}
                      onClick={() => openMediaViewer(index)}
                      className="aspect-square bg-gray-100 rounded-lg overflow-hidden hover:ring-2 hover:ring-gold transition-all cursor-pointer relative"
                    >
                      {upload.fileType.startsWith('image/') ? (
                        <img
                          src={getS3Url(upload.s3Key)}
                          alt={upload.fileName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <>
                          {upload.thumbnailKey ? (
                            <img
                              src={getS3Url(upload.thumbnailKey)}
                              alt={upload.fileName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-black">
                              <svg className="w-16 h-16 text-gold mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-white text-xs">Video</span>
                            </div>
                          )}
                          {/* Play icon overlay for videos */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <svg className="w-12 h-12 text-white opacity-90" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </>
                      )}
                    </button>
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

      {/* Media Viewer Modal */}
      {viewerOpen && job.uploads.length > 0 && (
        <MediaViewerModal
          uploads={job.uploads}
          currentIndex={currentMediaIndex}
          onClose={closeMediaViewer}
          onPrevious={navigatePrevious}
          onNext={navigateNext}
          getS3Url={getS3Url}
          onDelete={deleteUpload}
          canDelete={job.status === 'IN_REVIEW'}
        />
      )}
    </main>
  );
}

// Media Viewer Modal Component
function MediaViewerModal({
  uploads,
  currentIndex,
  onClose,
  onPrevious,
  onNext,
  getS3Url,
  onDelete,
  canDelete,
}: {
  uploads: Array<{
    id: string;
    s3Key: string;
    fileName: string;
    fileType: string;
  }>;
  currentIndex: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  getS3Url: (key: string) => string;
  onDelete: (uploadId: string) => void;
  canDelete: boolean;
}) {
  const currentUpload = uploads[currentIndex];
  const isVideo = currentUpload.fileType.startsWith('video/');

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Top Right Buttons */}
      <div className="absolute top-4 right-4 z-60 flex gap-2">
        {canDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(currentUpload.id); }}
            className="w-10 h-10 bg-red-600 bg-opacity-80 hover:bg-opacity-100 rounded-full flex items-center justify-center text-white transition-all"
            title="Delete"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
        <button
          onClick={onClose}
          className="w-10 h-10 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center text-white transition-all"
          title="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Previous Button */}
      {uploads.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrevious(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-60 w-12 h-12 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center text-white transition-all"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Next Button */}
      {uploads.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-60 w-12 h-12 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center text-white transition-all"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Main Content */}
      <div
        className="max-w-7xl max-h-[90vh] w-full mx-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media Display */}
        <div className="flex-1 flex items-center justify-center mb-4">
          {isVideo ? (
            <video
              key={currentUpload.id}
              src={getS3Url(currentUpload.s3Key)}
              controls
              autoPlay
              className="max-w-full max-h-[70vh] rounded-lg"
            />
          ) : (
            <img
              src={getS3Url(currentUpload.s3Key)}
              alt={currentUpload.fileName}
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          )}
        </div>

        {/* File Info */}
        <div className="text-center text-white mb-4">
          <p className="text-sm opacity-80">{currentUpload.fileName}</p>
          <p className="text-xs opacity-60 mt-1">
            {currentIndex + 1} / {uploads.length}
          </p>
        </div>

        {/* Thumbnail Strip */}
        {uploads.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 justify-center">
            {uploads.map((upload, index) => (
              <button
                key={upload.id}
                onClick={() => onNext()}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all ${
                  index === currentIndex
                    ? 'ring-2 ring-gold opacity-100'
                    : 'opacity-50 hover:opacity-75'
                }`}
              >
                {upload.fileType.startsWith('image/') ? (
                  <img
                    src={getS3Url(upload.s3Key)}
                    alt={upload.fileName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-black flex items-center justify-center">
                    <svg className="w-6 h-6 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
