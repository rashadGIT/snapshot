'use client';

/**
 * Join Job Page
 * Helper enters QR token or short code to join a job
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinJobPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    setLoading(true);

    try {
      // First, check if token is valid
      const checkResponse = await fetch(`/api/jobs/check-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: token.trim() }),
      });

      const checkData = await checkResponse.json();

      if (!checkData.valid) {
        alert(checkData.reason || 'Invalid or expired token');
        setLoading(false);
        return;
      }

      // Token is valid, now join the job
      const joinResponse = await fetch(`/api/jobs/${checkData.jobId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: token.trim() }),
      });

      if (joinResponse.ok) {
        router.push(`/jobs/${checkData.jobId}`);
      } else {
        const error = await joinResponse.json();
        alert(error.error || 'Failed to join job');
        setLoading(false);
      }
    } catch (error) {
      console.error('Join error:', error);
      alert('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

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
            <h1 className="text-2xl font-bold">Join Job</h1>
          </div>
        </div>
      </header>

      <div className="container-safe py-8">
        <div className="max-w-md mx-auto">
          {/* QR Scanner Placeholder */}
          <div className="card mb-6">
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2">QR Scanner</h3>
              <p className="text-gray-600 text-sm mb-4">
                Camera access required to scan QR codes
              </p>
              <button
                className="btn btn-secondary text-sm"
                onClick={() => alert('QR scanner coming soon! Use backup code below for now.')}
              >
                Enable Camera
              </button>
            </div>
          </div>

          {/* Manual Entry */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Or Enter Code Manually</h2>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  QR Token or 6-Digit Code
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter token or code (e.g., 123456)"
                  className="input w-full text-center text-lg font-mono tracking-wider"
                  disabled={loading}
                  autoFocus
                />
                <p className="text-sm text-gray-500 mt-2">
                  Get this from the Requester's QR code screen
                </p>
              </div>

              <button
                type="submit"
                disabled={!token.trim() || loading}
                className={`btn w-full ${
                  token.trim() ? 'btn-gold' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {loading ? 'Joining Job...' : 'Join Job'}
              </button>
            </form>
          </div>

          {/* Test Code Hint */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              💡 <strong>Testing?</strong> Use the seed data short code: <code className="font-mono bg-blue-100 px-2 py-1 rounded">123456</code>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
