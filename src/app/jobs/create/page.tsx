'use client';

/**
 * Create Job Page
 * Requester creates a new content capture job
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    eventTime: '',
    contentType: 'photos' as 'photos' | 'videos' | 'both',
    notes: '',
    priceTier: 'standard' as 'basic' | 'standard' | 'premium',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/jobs/${data.job.id}`);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create job');
        setLoading(false);
      }
    } catch (error) {
      console.error('Create job error:', error);
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
            <h1 className="text-2xl font-bold">Create New Job</h1>
          </div>
        </div>
      </header>

      {/* Form */}
      <div className="container-safe py-8">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <div className="card space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Job Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                minLength={5}
                maxLength={100}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input w-full"
                placeholder="e.g., Fashion Week After-Party Coverage"
              />
              <p className="text-sm text-gray-500 mt-1">Minimum 5 characters</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                minLength={10}
                maxLength={1000}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input w-full min-h-[120px]"
                placeholder="Describe what you need captured..."
              />
              <p className="text-sm text-gray-500 mt-1">Minimum 10 characters</p>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Location <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={200}
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="input w-full"
                placeholder="e.g., The Standard Hotel, NYC"
              />
            </div>

            {/* Event Time */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Event Date & Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={formData.eventTime}
                onChange={(e) => setFormData({ ...formData, eventTime: e.target.value })}
                className="input w-full"
              />
            </div>

            {/* Content Type */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Content Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['photos', 'videos', 'both'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, contentType: type })}
                    className={`btn ${
                      formData.contentType === type ? 'btn-primary' : 'btn-secondary'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Tier */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Price Tier <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['basic', 'standard', 'premium'] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setFormData({ ...formData, priceTier: tier })}
                    className={`btn ${
                      formData.priceTier === tier
                        ? tier === 'premium'
                          ? 'btn-gold'
                          : 'btn-primary'
                        : 'btn-secondary'
                    }`}
                  >
                    {tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                💰 Basic: $50 | Standard: $100 | Premium: $200 (UI only - no payment in POC)
              </p>
            </div>

            {/* Notes (Optional) */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Additional Notes <span className="text-gray-400">(Optional)</span>
              </label>
              <textarea
                maxLength={500}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input w-full min-h-[80px]"
                placeholder="Any special instructions for the Helper..."
              />
            </div>
          </div>

          {/* Submit */}
          <div className="mt-6 flex gap-4">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="btn btn-secondary flex-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={loading}
            >
              {loading ? 'Creating Job...' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
