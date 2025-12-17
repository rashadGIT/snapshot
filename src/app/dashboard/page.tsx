'use client';

/**
 * Dashboard Page
 * Role-based dashboard showing jobs for Requesters and Helpers
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string | null;
  roles: ('REQUESTER' | 'HELPER')[];
  activeRole: 'REQUESTER' | 'HELPER' | null;
}

interface Job {
  id: string;
  title: string;
  location: string;
  eventTime: string;
  status: string;
  contentType: string;
  priceTier: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadUserAndJobs();
  }, []);

  const loadUserAndJobs = async () => {
    try {
      // Get current user
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) {
        router.push('/');
        return;
      }

      const userData = await userRes.json();
      setUser(userData.user);

      // Get jobs
      const jobsRes = await fetch('/api/jobs');
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData.jobs || []);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    window.location.href = '/api/auth/logout';
  };

  const switchRole = async (newRole: 'REQUESTER' | 'HELPER') => {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeRole: newRole }),
      });

      if (response.ok) {
        // Reload dashboard with new role
        await loadUserAndJobs();
      } else {
        alert('Failed to switch role');
      }
    } catch (error) {
      console.error('Role switch failed:', error);
      alert('Failed to switch role');
    }
  };

  const addRole = async (role: 'REQUESTER' | 'HELPER') => {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      if (response.ok) {
        await loadUserAndJobs();
        alert(`${role} role added! You can now switch to it.`);
      } else {
        alert('Failed to add role');
      }
    } catch (error) {
      console.error('Add role failed:', error);
      alert('Failed to add role');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner w-12 h-12"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container-safe py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Snapspot</h1>
              <p className="text-sm text-gray-600">
                {user.activeRole === 'REQUESTER' ? 'Requester' : 'Helper'} Dashboard
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Role Switcher */}
              {user.roles.length > 1 && (
                <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => switchRole('REQUESTER')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                      user.activeRole === 'REQUESTER'
                        ? 'bg-white shadow-sm'
                        : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    Requester
                  </button>
                  <button
                    onClick={() => switchRole('HELPER')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                      user.activeRole === 'HELPER'
                        ? 'bg-white shadow-sm'
                        : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    Helper
                  </button>
                </div>
              )}

              {/* Add Other Role */}
              {user.roles.length === 1 && (
                <button
                  onClick={() => addRole(user.activeRole === 'REQUESTER' ? 'HELPER' : 'REQUESTER')}
                  className="text-sm text-gold hover:underline"
                >
                  + Become {user.activeRole === 'REQUESTER' ? 'Helper' : 'Requester'}
                </button>
              )}

              <span className="text-sm text-gray-600">{user.email}</span>
              <button onClick={handleLogout} className="btn btn-secondary text-sm">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="container-safe py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">
            {user.activeRole === 'REQUESTER' ? 'My Jobs' : 'Available Jobs'}
          </h2>
          {user.activeRole === 'REQUESTER' && (
            <button
              onClick={() => router.push('/jobs/create')}
              className="btn btn-primary"
            >
              + Create Job
            </button>
          )}
          {user.activeRole === 'HELPER' && (
            <button
              onClick={() => router.push('/jobs/join')}
              className="btn btn-gold"
            >
              Scan QR Code
            </button>
          )}
        </div>

        {/* Jobs List */}
        {jobs.length === 0 ? (
          <div className="card text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">No jobs yet</h3>
            <p className="text-gray-600 mb-4">
              {user.roles.includes('REQUESTER')
                ? "Create your first content capture job to get started"
                : "Scan a QR code to join your first job"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                onClick={() => router.push(`/jobs/${job.id}`)}
                className="card hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold">{job.title}</h3>
                      <span className={`badge badge-${job.status.toLowerCase()}`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {job.location}
                      </p>
                      <p className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {new Date(job.eventTime).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-sm font-medium mb-2">
                      {job.contentType}
                    </div>
                    <p className="text-sm text-gray-600 capitalize">{job.priceTier} tier</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
