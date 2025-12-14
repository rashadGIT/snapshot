/**
 * Landing Page
 * Shows sign-in button and app description
 */

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="container-safe py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Snapspot</h1>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container-safe py-16 md:py-24">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Content Capture,
            <br />
            <span className="text-gold">On Demand</span>
          </h2>

          <p className="text-xl text-gray-600 mb-8">
            Connect Requesters with Helpers for real-time photo and video capture at events.
          </p>

          {/* Sign In Button */}
          <a
            href="/api/auth/login"
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </a>

          <p className="text-sm text-gray-500 mt-4">
            No credit card required • Free to start
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="container-safe py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-center mb-12">How It Works</h3>

          <div className="grid md:grid-cols-2 gap-8">
            {/* For Requesters */}
            <div className="card">
              <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h4 className="text-xl font-bold mb-2">For Requesters</h4>
              <ul className="space-y-2 text-gray-600">
                <li>✓ Create content capture jobs</li>
                <li>✓ Generate QR codes for events</li>
                <li>✓ Review and download uploads</li>
                <li>✓ Rate your Helpers</li>
              </ul>
            </div>

            {/* For Helpers */}
            <div className="card">
              <div className="w-12 h-12 bg-gold rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h4 className="text-xl font-bold mb-2">For Helpers</h4>
              <ul className="space-y-2 text-gray-600">
                <li>✓ Scan QR codes to join jobs</li>
                <li>✓ Capture photos and videos</li>
                <li>✓ Upload directly from your phone</li>
                <li>✓ Get rated and build reputation</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container-safe py-8 text-center text-gray-500">
        <p className="text-sm">© 2025 Snapspot. Built with Next.js and AWS.</p>
      </footer>
    </main>
  );
}
