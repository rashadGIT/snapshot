'use client';

/**
 * Role Selection Page
 * Users select Requester or Helper role after first login
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RoleSelectionPage() {
  const [selectedRole, setSelectedRole] = useState<'REQUESTER' | 'HELPER' | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!selectedRole) return;

    setLoading(true);

    try {
      const response = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: selectedRole }),
      });

      if (response.ok) {
        router.push('/dashboard');
      } else {
        alert('Failed to set role. Please try again.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Role selection error:', error);
      alert('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome to Snapspot!</h1>
          <p className="text-gray-600">Choose how you&apos;d like to use Snapspot</p>
        </div>

        {/* Role Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Requester Card */}
          <button
            onClick={() => setSelectedRole('REQUESTER')}
            className={`card text-left transition-all ${
              selectedRole === 'REQUESTER'
                ? 'ring-4 ring-black shadow-xl'
                : 'hover:shadow-lg'
            }`}
          >
            <div className="w-16 h-16 bg-black rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-gold"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>

            <h3 className="text-xl font-bold mb-2">I&apos;m a Requester</h3>
            <p className="text-gray-600 mb-4">
              I need someone to capture photos and videos at my events
            </p>

            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-gold mt-0.5">✓</span>
                <span>Post content capture jobs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold mt-0.5">✓</span>
                <span>Generate QR codes for events</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold mt-0.5">✓</span>
                <span>Review and download all content</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold mt-0.5">✓</span>
                <span>Own all content rights</span>
              </li>
            </ul>

            {selectedRole === 'REQUESTER' && (
              <div className="mt-4 p-3 bg-black text-white rounded-lg text-center font-medium">
                Selected
              </div>
            )}
          </button>

          {/* Helper Card */}
          <button
            onClick={() => setSelectedRole('HELPER')}
            className={`card text-left transition-all ${
              selectedRole === 'HELPER' ? 'ring-4 ring-gold shadow-xl' : 'hover:shadow-lg'
            }`}
          >
            <div className="w-16 h-16 bg-gold rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>

            <h3 className="text-xl font-bold mb-2">I'm a Helper</h3>
            <p className="text-gray-600 mb-4">
              I want to capture content at events and get paid
            </p>

            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-gold mt-0.5">✓</span>
                <span>Scan QR codes to join jobs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold mt-0.5">✓</span>
                <span>Capture photos and videos</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold mt-0.5">✓</span>
                <span>Upload from your phone instantly</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold mt-0.5">✓</span>
                <span>Build your reputation with ratings</span>
              </li>
            </ul>

            {selectedRole === 'HELPER' && (
              <div className="mt-4 p-3 bg-gold text-black rounded-lg text-center font-medium">
                Selected
              </div>
            )}
          </button>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleSubmit}
          disabled={!selectedRole || loading}
          className={`btn w-full ${
            selectedRole === 'REQUESTER'
              ? 'btn-primary'
              : selectedRole === 'HELPER'
              ? 'btn-gold'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {loading ? 'Setting up your account...' : 'Continue to Dashboard'}
        </button>

        {/* Note */}
        <p className="text-center text-sm text-gray-500 mt-4">
          You can't change your role later, so choose carefully!
        </p>
      </div>
    </main>
  );
}
