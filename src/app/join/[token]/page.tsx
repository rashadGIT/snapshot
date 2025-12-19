'use client';

/**
 * QR Code Join Landing Page
 * Handles authentication flow and auto-joins Helper to job
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function JoinTokenPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const [status, setStatus] = useState<'checking' | 'needs_auth' | 'webview_blocked' | 'setting_role' | 'joining' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Detect if running in an embedded browser (webview)
  const isWebView = () => {
    const ua = navigator.userAgent || navigator.vendor;
    // Check for common in-app browsers
    return (
      ua.includes('Instagram') ||
      ua.includes('FBAN') || // Facebook
      ua.includes('FBAV') || // Facebook
      ua.includes('Twitter') ||
      ua.includes('Line') ||
      ua.includes('WebView') ||
      (ua.includes('iPhone') && !ua.includes('Safari')) ||
      (ua.includes('Android') && !ua.includes('Chrome'))
    );
  };

  useEffect(() => {
    // If in webview, show message to open in real browser
    if (isWebView()) {
      setStatus('webview_blocked');
      return;
    }
    handleJoinFlow();
  }, []);

  const handleJoinFlow = async () => {
    try {
      // Step 1: Check if user is authenticated
      const userResponse = await fetch('/api/auth/me');

      if (!userResponse.ok) {
        // Not logged in - store token in cookie and redirect to login
        setStatus('needs_auth');
        // Store token in cookie to retrieve after login
        document.cookie = `pending_join_token=${token}; path=/; max-age=600; SameSite=Lax`;
        window.location.href = '/api/auth/login';
        return;
      }

      const userData = await userResponse.json();
      const user = userData.user;

      // Step 2: If user has no activeRole, set to HELPER
      if (!user.activeRole) {
        setStatus('setting_role');
        const roleResponse = await fetch('/api/auth/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'HELPER' }),
        });

        if (!roleResponse.ok) {
          throw new Error('Failed to set role');
        }
      }

      // Step 3: Check if token is valid
      setStatus('joining');
      const checkResponse = await fetch('/api/jobs/check-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!checkResponse.ok) {
        const error = await checkResponse.json();
        setStatus('error');
        setErrorMessage(error.error || 'Invalid or expired QR code');
        return;
      }

      const checkData = await checkResponse.json();
      const jobId = checkData.jobId;

      // Step 4: Join the job
      const joinResponse = await fetch(`/api/jobs/${jobId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!joinResponse.ok) {
        const error = await joinResponse.json();
        setStatus('error');
        setErrorMessage(error.error || 'Failed to join job');
        return;
      }

      // Success! Redirect to job details
      router.push(`/jobs/${jobId}`);
    } catch (error) {
      console.error('Join flow error:', error);
      setStatus('error');
      setErrorMessage('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center">
        {status === 'checking' && (
          <>
            <div className="spinner w-12 h-12 mx-auto mb-4"></div>
            <h1 className="text-xl font-bold mb-2">Checking QR Code...</h1>
            <p className="text-gray-600">Please wait</p>
          </>
        )}

        {status === 'webview_blocked' && (
          <>
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-2">Open in Browser</h1>
            <p className="text-gray-600 mb-4">
              For security, please open this link in Safari or Chrome instead of this in-app browser.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
              <p className="text-sm text-gray-700 font-semibold mb-2">How to open in Safari/Chrome:</p>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Tap the three dots (•••) or share icon</li>
                <li>Select &quot;Open in Safari&quot; or &quot;Open in Chrome&quot;</li>
                <li>Come back here and scan the QR code again</li>
              </ol>
            </div>
            <div className="text-xs text-gray-500 mt-4">
              URL: {typeof window !== 'undefined' ? window.location.href : ''}
            </div>
          </>
        )}

        {status === 'needs_auth' && (
          <>
            <div className="w-16 h-16 bg-gold rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-2">Sign In Required</h1>
            <p className="text-gray-600 mb-4">Redirecting to sign in...</p>
          </>
        )}

        {status === 'setting_role' && (
          <>
            <div className="spinner w-12 h-12 mx-auto mb-4"></div>
            <h1 className="text-xl font-bold mb-2">Setting Up Your Account...</h1>
            <p className="text-gray-600">Configuring as Helper</p>
          </>
        )}

        {status === 'joining' && (
          <>
            <div className="spinner w-12 h-12 mx-auto mb-4"></div>
            <h1 className="text-xl font-bold mb-2">Joining Job...</h1>
            <p className="text-gray-600">Almost ready to capture content!</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-2 text-red-600">Unable to Join</h1>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="btn btn-primary w-full"
            >
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </main>
  );
}
