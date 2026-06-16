import React, { useState } from 'react';

export default function LandingPage({ onSignInClick }) {
  const [heroEmail, setHeroEmail] = useState('');
  const [heroStatus, setHeroStatus] = useState({ state: 'idle', message: '' }); // idle, loading, success, error
  
  const [bottomEmail, setBottomEmail] = useState('');
  const [bottomStatus, setBottomStatus] = useState({ state: 'idle', message: '' }); // idle, loading, success, error

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleWaitlistSubmit = async (email, setStatus, setEmailField) => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setStatus({ state: 'error', message: 'Email address is required.' });
      return;
    }
    if (!validateEmail(cleanEmail)) {
      setStatus({ state: 'error', message: 'Please enter a valid email address.' });
      return;
    }

    try {
      setStatus({ state: 'loading', message: '' });
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }

      setStatus({ state: 'success', message: data.message });
      setEmailField('');
    } catch (err) {
      setStatus({ state: 'error', message: err.message });
    }
  };

  return (
    <div className="landing-wrapper">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-logo">
          Cold<span>Check</span>
        </div>
        <div className="landing-nav-right">
          Coming soon · <span style={{ color: '#5A5A5A', cursor: 'default' }}>Sign In</span>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-eyebrow">One question. Your answer first.</div>
        <h1 className="landing-hero-headline text-serif" style={{ marginBottom: '16px' }}>
          You are AI's bitch.
        </h1>
        <p style={{
          color: '#E8533D',
          fontSize: '13px',
          fontWeight: '600',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          marginBottom: '32px',
          fontFamily: 'var(--font-sans)'
        }}>
          Prove us wrong.
        </p>
        <p className="landing-hero-sub text-muted">
          ColdCheck sends your pod one question. You answer before you see anyone else's. 
          No AI. No algorithm. Just you, your reasoning, and three friends who'll push back.
        </p>

        {heroStatus.state !== 'success' ? (
          <>
            <div className="landing-waitlist-form">
              <input 
                type="email" 
                className="landing-waitlist-input" 
                placeholder="your@email.com"
                value={heroEmail}
                onChange={(e) => setHeroEmail(e.target.value)}
                style={{
                  borderColor: heroStatus.state === 'error' ? 'rgba(232,83,61,0.6)' : ''
                }}
              />
              <button 
                className="landing-waitlist-btn" 
                onClick={() => handleWaitlistSubmit(heroEmail, setHeroStatus, setHeroEmail)}
                disabled={heroStatus.state === 'loading'}
              >
                {heroStatus.state === 'loading' ? 'Joining...' : 'Join the waitlist'}
              </button>
            </div>
            {heroStatus.state === 'error' && (
              <p style={{ color: '#E8533D', fontSize: '12px', marginBottom: '12px', marginTop: '-8px' }}>
                {heroStatus.message}
              </p>
            )}
            <p className="landing-form-note">No spam. We'll only email you when it matters.</p>
          </>
        ) : (
          <div className="landing-success-msg">
            <strong>You're in.</strong> We'll be in touch when your spot opens up.
            <span style={{ color: '#5A5A5A', fontSize: '12px', marginTop: '6px', display: 'block' }}>
              Share with a friend to move up the list.
            </span>
          </div>
        )}
      </section>

      {/* Divider */}
      <div className="landing-divider"></div>

      {/* How It Works */}
      <section className="landing-mechanic">
        <p className="landing-mechanic-label">How it works</p>
        <div className="landing-steps">
          <div className="landing-step">
            <div className="landing-step-num">01</div>
            <h3 className="landing-step-title">You get the question</h3>
            <p className="landing-step-desc">
              One question drops each day. A finance dilemma. A moral puzzle. A call you've been avoiding. Something worth actually thinking about.
            </p>
          </div>
          <div className="landing-step">
            <div className="landing-step-num">02</div>
            <h3 className="landing-step-title">Answer blind</h3>
            <p className="landing-step-desc">
              Write your answer and your reasoning before seeing anyone else's. No previews. No hints. Just your honest take.
            </p>
          </div>
          <div className="landing-step">
            <div className="landing-step-num">03</div>
            <h3 className="landing-step-title">The pod reveals</h3>
            <p className="landing-step-desc">
              Once everyone answers, the pod unlocks. See everyone's reasoning. React. Push back. See whether your own thinking survives.
            </p>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="landing-why">
        <div className="landing-why-inner">
          <p className="landing-why-quote">
            "We have AI to answer everything.<br />
            We have nowhere left to <em>be wrong.</em>"
          </p>
          <p className="landing-why-body">
            ColdCheck is built on the belief that the most useful thing you can do with a hard question 
            is sit with it yourself first. Your reasoning is the product. Not the answer.
          </p>
        </div>
      </section>

      {/* Pod Preview */}
      <section className="landing-pod-preview">
        <p className="landing-pod-label">What a pod looks like</p>
        <div className="landing-pod-card">
          <div className="landing-pod-question">
            Would you rather have $50,000 today, or $5,000 a year for the next 20 years?
          </div>
          <div className="landing-pod-answers">
            {/* Kavan */}
            <div className="landing-pod-answer">
              <div className="landing-pod-avatar" style={{ background: '#C9C2B8', color: '#111110' }}>K</div>
              <div className="landing-pod-answer-text">
                <div className="landing-pod-answer-name">Kavan · high confidence</div>
                <div className="landing-pod-answer-verdict">The $50,000 now</div>
                <p className="landing-pod-answer-reason">
                  Money today is worth more than money later. If I can't beat a 0% real return by investing $50k over 20 years I have bigger problems than this question.
                </p>
                <div className="landing-reaction-tags">
                  <span className="landing-tag active-green">solid reasoning</span>
                  <span className="landing-tag">changed my view</span>
                </div>
              </div>
            </div>

            {/* Sujith */}
            <div className="landing-pod-answer">
              <div className="landing-pod-avatar" style={{ background: '#7A8B7A', color: '#111110' }}>S</div>
              <div className="landing-pod-answer-text">
                <div className="landing-pod-answer-name">Sujith · medium confidence</div>
                <div className="landing-pod-answer-verdict">The $5,000 a year</div>
                <p className="landing-pod-answer-reason">
                  Inflation eats lump sums faster than people expect. And I know myself — I'd spend the $50k within two years on nothing memorable.
                </p>
                <div className="landing-reaction-tags">
                  <span className="landing-tag active-red">didn't hold up</span>
                </div>
              </div>
            </div>

            {/* Smruti */}
            <div className="landing-pod-answer">
              <div className="landing-pod-avatar" style={{ background: '#7E99B3', color: '#111110' }}>S</div>
              <div className="landing-pod-answer-text">
                <div className="landing-pod-answer-name">Smruti · low confidence</div>
                <div className="landing-pod-answer-verdict">Depends on my age</div>
                <p className="landing-pod-answer-reason">
                  Twenty years is a different bet at 25 than at 65.
                </p>
                <div className="landing-reaction-tags">
                  <span className="landing-tag">solid reasoning</span>
                  <span className="landing-tag">changed my view</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="landing-bottom-cta">
        <h2 className="landing-bottom-hl serif">Your turn to think.</h2>
        <p className="landing-bottom-sub">Join the waitlist. We'll let you know when ColdCheck is ready.</p>

        {bottomStatus.state !== 'success' ? (
          <>
            <div className="landing-waitlist-form">
              <input 
                type="email" 
                className="landing-waitlist-input" 
                placeholder="your@email.com"
                value={bottomEmail}
                onChange={(e) => setBottomEmail(e.target.value)}
                style={{
                  borderColor: bottomStatus.state === 'error' ? 'rgba(232,83,61,0.6)' : ''
                }}
              />
              <button 
                className="landing-waitlist-btn" 
                onClick={() => handleWaitlistSubmit(bottomEmail, setBottomStatus, setBottomEmail)}
                disabled={bottomStatus.state === 'loading'}
              >
                {bottomStatus.state === 'loading' ? 'Joining...' : 'Join the waitlist'}
              </button>
            </div>
            {bottomStatus.state === 'error' && (
              <p style={{ color: '#E8533D', fontSize: '12px', marginBottom: '12px', marginTop: '-8px' }}>
                {bottomStatus.message}
              </p>
            )}
            <p className="landing-form-note">No spam. We'll only email you when it matters.</p>
          </>
        ) : (
          <div className="landing-success-msg" style={{ margin: '0 auto' }}>
            <strong>You're in.</strong> We'll be in touch when your spot opens up.
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-logo">ColdCheck</div>
        <div className="landing-footer-note">
          © 2026 · Built by a first-time founder who had an opinion
        </div>
      </footer>
    </div>
  );
}
