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
  const [status, setStatus] = useState<'checking' | 'needs_auth' | 'setting_role' | 'joining' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
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

      // Step 2: If user has no role, set to HELPER
      if (!user.role) {
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
