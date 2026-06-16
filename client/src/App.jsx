import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';

const API_BASE_URL = 'http://localhost:5001/api';

export default function App() {
  // Authentication & Session States
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('coldcheck_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [showLogin, setShowLogin] = useState(false);
  const [activePod, setActivePod] = useState(null);
  const [podMembers, setPodMembers] = useState([]);
  const [currentScreen, setCurrentScreen] = useState('dashboard'); // login, dashboard, question, waiting, reveal, stats, pod_settings
  
  // Daily Question state
  const [dailyQuestion, setDailyQuestion] = useState(null);
  const [myAnswerInput, setMyAnswerInput] = useState('');
  const [myReasoningInput, setMyReasoningInput] = useState('');
  const [myConfidenceInput, setMyConfidenceInput] = useState(null); // low, medium, high
  
  // Form Inputs
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isSignupRequired, setIsSignupRequired] = useState(false);
  const [podNameInput, setPodNameInput] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  
  // Custom Question Form
  const [customQuestionText, setCustomQuestionText] = useState('');
  const [customQuestionCategory, setCustomQuestionCategory] = useState('general reasoning');
  const [pendingQuestions, setPendingQuestions] = useState([]);
  
  // Calibration / Stats
  const [calibrationData, setCalibrationData] = useState(null);
  
  // Loading & Error States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch active pod and members
  const fetchActivePod = async (userId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/pods/active?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch pod details.');
      const data = await response.json();
      setActivePod(data.pod);
      setPodMembers(data.members || []);
      return data.pod;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  // Fetch daily question state
  const fetchDailyQuestion = async (podId, userId) => {
    if (!podId || !userId) return;
    try {
      setIsLoading(true);
      setErrorMsg('');
      const response = await fetch(`${API_BASE_URL}/daily-question?podId=${podId}&userId=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch daily question.');
      const data = await response.json();
      setDailyQuestion(data);
      
      // If user has already answered, pre-populate or set screen
      if (data.hasAnswered) {
        setMyAnswerInput(data.myAnswer?.answer || '');
        setMyReasoningInput(data.myAnswer?.reasoning || '');
        setMyConfidenceInput(data.myAnswer?.confidence || null);
        
        if (data.unlocked) {
          setCurrentScreen('reveal');
        } else {
          setCurrentScreen('waiting');
        }
      } else {
        // Clear inputs for fresh question
        setMyAnswerInput('');
        setMyReasoningInput('');
        setMyConfidenceInput(null);
        setCurrentScreen('question');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch stats / calibration
  const fetchCalibrationStats = async (userId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/stats/calibration?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch stats.');
      const data = await response.json();
      setCalibrationData(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch pending questions for moderation
  const fetchPendingQuestions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/questions/pending`);
      if (!response.ok) throw new Error('Failed to fetch pending questions.');
      const data = await response.json();
      setPendingQuestions(data.pending || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Log in or Sign up
  const handleAuth = async (e) => {
    e.preventDefault();
    if (!emailInput) {
      setErrorMsg('Email is required.');
      return;
    }
    try {
      setIsLoading(true);
      setErrorMsg('');
      const response = await fetch(`${API_BASE_URL}/auth/login-or-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, name: nameInput })
      });
      
      const data = await response.json();
      if (!response.ok) {
        if (data.isSignupRequired) {
          setIsSignupRequired(true);
          setErrorMsg('This email is not registered yet. Enter your nickname to sign up.');
        } else {
          throw new Error(data.error || 'Authentication failed.');
        }
        return;
      }
      
      const user = data.user;
      setCurrentUser(user);
      localStorage.setItem('coldcheck_user', JSON.stringify(user));
      
      // Reset auth form
      setEmailInput('');
      setNameInput('');
      setIsSignupRequired(false);
      
      // Fetch user's pod
      const pod = await fetchActivePod(user.id);
      setCurrentScreen('dashboard');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('coldcheck_user');
    setCurrentUser(null);
    setActivePod(null);
    setPodMembers([]);
    setDailyQuestion(null);
    setCurrentScreen('login');
  };

  // Create a pod
  const handleCreatePod = async (e) => {
    e.preventDefault();
    if (!podNameInput) return;
    try {
      setIsLoading(true);
      setErrorMsg('');
      const response = await fetch(`${API_BASE_URL}/pods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: podNameInput, userId: currentUser.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create pod.');
      
      setSuccessMsg(`Pod "${data.pod.name}" created!`);
      setPodNameInput('');
      await fetchActivePod(currentUser.id);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Join a pod
  const handleJoinPod = async (e) => {
    e.preventDefault();
    if (!inviteCodeInput) return;
    try {
      setIsLoading(true);
      setErrorMsg('');
      const response = await fetch(`${API_BASE_URL}/pods/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCodeInput, userId: currentUser.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to join pod.');
      
      setSuccessMsg(`Joined pod successfully!`);
      setInviteCodeInput('');
      await fetchActivePod(currentUser.id);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Leave pod
  const handleLeavePod = async () => {
    if (!activePod) return;
    if (!window.confirm(`Are you sure you want to leave ${activePod.name}?`)) return;
    try {
      setIsLoading(true);
      setErrorMsg('');
      const response = await fetch(`${API_BASE_URL}/pods/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ podId: activePod.id, userId: currentUser.id })
      });
      if (!response.ok) throw new Error('Failed to leave pod.');
      
      setActivePod(null);
      setPodMembers([]);
      setDailyQuestion(null);
      setCurrentScreen('dashboard');
      setSuccessMsg('You left the pod.');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Answer
  const handleSubmitAnswer = async () => {
    if (!dailyQuestion || !currentUser) return;
    if (myReasoningInput.trim().length < 12) {
      setErrorMsg('Reasoning must be at least 12 characters.');
      return;
    }
    if (!myConfidenceInput) {
      setErrorMsg('Please select a confidence level.');
      return;
    }
    try {
      setIsLoading(true);
      setErrorMsg('');
      const response = await fetch(`${API_BASE_URL}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyQuestionId: dailyQuestion.dailyQuestionId,
          userId: currentUser.id,
          answer: myAnswerInput,
          reasoning: myReasoningInput,
          confidence: myConfidenceInput
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to submit answer.');
      
      // Reload daily question to reflect locking state
      await fetchDailyQuestion(activePod.id, currentUser.id);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Reactions on peers' answers
  const handleReaction = async (answerId, type) => {
    try {
      const response = await fetch(`${API_BASE_URL}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answerId,
          userId: currentUser.id,
          reactionType: type
        })
      });
      if (!response.ok) throw new Error('Failed to register reaction.');
      
      // Reload question answers
      await fetchDailyQuestion(activePod.id, currentUser.id);
    } catch (err) {
      console.error(err);
    }
  };

  // Submit custom question
  const handleSubmitCustomQuestion = async (e) => {
    e.preventDefault();
    if (!customQuestionText) return;
    try {
      setIsLoading(true);
      setErrorMsg('');
      const response = await fetch(`${API_BASE_URL}/questions/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: customQuestionCategory,
          text: customQuestionText,
          userId: currentUser.id
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to submit question.');
      
      setSuccessMsg('Question submitted to pod queue!');
      setCustomQuestionText('');
      await fetchPendingQuestions();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Vote on custom question
  const handleVoteQuestion = async (questionId, voteType) => {
    try {
      const response = await fetch(`${API_BASE_URL}/questions/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          userId: currentUser.id,
          voteType
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to submit vote.');
      
      setSuccessMsg(data.message);
      await fetchPendingQuestions();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // Toggle category opt-ins
  const handleCategoryToggle = async (cat) => {
    if (!activePod || !currentUser) return;
    const member = podMembers.find(m => m.user_id === currentUser.id);
    if (!member) return;
    
    let currentCats = [...(member.selected_categories || [])];
    if (currentCats.includes(cat)) {
      currentCats = currentCats.filter(c => c !== cat);
    } else {
      currentCats.push(cat);
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/pods/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podId: activePod.id,
          userId: currentUser.id,
          categories: currentCats
        })
      });
      if (!response.ok) throw new Error('Failed to update categories.');
      
      // Refresh pod members
      await fetchActivePod(currentUser.id);
    } catch (err) {
      console.error(err);
    }
  };

  // DEVELOPER SIMULATION HELPERS
  const devLoginAs = async (email, name) => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const response = await fetch(`${API_BASE_URL}/auth/login-or-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      const user = data.user;
      setCurrentUser(user);
      localStorage.setItem('coldcheck_user', JSON.stringify(user));
      
      // Auto-join first pod if not in one
      const pod = await fetchActivePod(user.id);
      
      if (!pod && activePod) {
        // Auto join active pod that was viewed
        await fetch(`${API_BASE_URL}/pods/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteCode: activePod.invite_code, userId: user.id })
        });
        await fetchActivePod(user.id);
      }
      
      // Reset forms
      setEmailInput('');
      setNameInput('');
      setIsSignupRequired(false);
      
      setCurrentScreen('dashboard');
      setSuccessMsg(`Logged in as ${user.name}`);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const devSimulateAnswers = async () => {
    if (!activePod || !dailyQuestion) return;
    try {
      setIsLoading(true);
      setErrorMsg('');
      const response = await fetch(`${API_BASE_URL}/dev/simulate-answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podId: activePod.id,
          dailyQuestionId: dailyQuestion.dailyQuestionId
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      setSuccessMsg(data.message);
      // Reload daily question
      await fetchDailyQuestion(activePod.id, currentUser.id);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Init checks
  useEffect(() => {
    if (currentUser) {
      fetchActivePod(currentUser.id);
    } else {
      setCurrentScreen('login');
    }
  }, []);

  // Auto clear alerts
  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Load screen data
  useEffect(() => {
    if (currentUser && activePod) {
      if (currentScreen === 'stats') {
        fetchCalibrationStats(currentUser.id);
      } else if (currentScreen === 'pod_settings') {
        fetchPendingQuestions();
      } else if (currentScreen === 'dashboard') {
        fetchActivePod(currentUser.id);
      }
    }
  }, [currentScreen]);

  return <LandingPage />;
}

function UnusedAppLayout() {
  return (
    <div className="app-container">
      {/* Dev Console Banner */}
      {currentUser && (
        <div style={{
          backgroundColor: '#0F0F0F',
          border: '1px dashed #333',
          padding: '8px 12px',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '390px',
          fontSize: '11px',
          marginBottom: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          color: '#888'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🛠️ DEV PANEL: <strong>{currentUser.name}</strong></span>
            <button onClick={handleLogout} style={{
              background: 'none', border: 'none', color: '#E8533D', cursor: 'pointer', fontSize: '11px'
            }}>Logout</button>
          </div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <span style={{ alignSelf: 'center' }}>Switch:</span>
            <button onClick={() => devLoginAs('priya@pod.com', 'Priya')} style={{
              background: '#222', border: 'none', borderRadius: '4px', padding: '2px 6px', color: '#ccc', cursor: 'pointer'
            }}>Priya</button>
            <button onClick={() => devLoginAs('marcus@pod.com', 'Marcus')} style={{
              background: '#222', border: 'none', borderRadius: '4px', padding: '2px 6px', color: '#ccc', cursor: 'pointer'
            }}>Marcus</button>
            <button onClick={() => devLoginAs('dana@pod.com', 'Dana')} style={{
              background: '#222', border: 'none', borderRadius: '4px', padding: '2px 6px', color: '#ccc', cursor: 'pointer'
            }}>Dana</button>
          </div>
          {activePod && dailyQuestion && !dailyQuestion.unlocked && (
            <button onClick={devSimulateAnswers} style={{
              backgroundColor: 'rgba(122, 139, 122, 0.15)', border: '1px solid #7A8B7A', borderRadius: '6px',
              padding: '4px', color: '#9CB89C', cursor: 'pointer', fontWeight: 'bold'
            }}>
              ⚡ Simulate other pod members answering
            </button>
          )}
        </div>
      )}

      {/* Main device mockup frame */}
      <div className="phone-mockup">
        {/* Notch decoration */}
        <div className="top-status-bar">
          <div className="notch" />
        </div>

        {/* Global Toast Alert */}
        {errorMsg && (
          <div style={{
            position: 'absolute', top: '40px', left: '16px', right: '16px',
            backgroundColor: 'rgba(232, 83, 61, 0.95)', color: '#1A1A1A',
            padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: '500',
            zIndex: 1000, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}>
            {errorMsg}
          </div>
        )}
        
        {successMsg && (
          <div style={{
            position: 'absolute', top: '40px', left: '16px', right: '16px',
            backgroundColor: 'rgba(122, 139, 122, 0.95)', color: '#1A1A1A',
            padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: '500',
            zIndex: 1000, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}>
            {successMsg}
          </div>
        )}

        <div className="screen-body">
          {isLoading && (
            <div style={{
              position: 'absolute', inset: 0, backgroundColor: 'rgba(26,26,26,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99
            }}>
              <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
            </div>
          )}

          {/* SCREEN: LOGIN */}
          {currentScreen === 'login' && (
            <div style={{ padding: '40px 28px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <span style={{ fontSize: '48px' }}>❄️</span>
                <h1 className="text-serif" style={{ fontSize: '36px', color: '#FAF6F0', marginTop: '12px' }}>ColdCheck</h1>
                <p style={{ color: '#C9C2B8', fontSize: '13px', marginTop: '8px', letterSpacing: '0.5px' }}>
                  ONE ARGUMENT A DAY. NO AI CRUTCHES.
                </p>
              </div>

              <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ color: '#C9C2B8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="input-underlined"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="you@domain.com"
                    required
                  />
                </div>

                {isSignupRequired && (
                  <div>
                    <label style={{ color: '#C9C2B8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>
                      Nickname
                    </label>
                    <input
                      type="text"
                      className="input-underlined"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Priya"
                      required
                    />
                  </div>
                )}

                <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>
                  {isSignupRequired ? 'Create Account' : 'Sign In'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '18px' }}>
                <span 
                  onClick={() => {
                    setIsSignupRequired(false);
                    setShowLogin(false);
                  }} 
                  style={{ color: '#C9C2B8', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}
                >
                  ← Back to Waitlist
                </span>
              </div>

              <div style={{ marginTop: '30px', borderTop: '1px solid rgba(250,246,240,0.08)', paddingTop: '20px', textAlign: 'center' }}>
                <p style={{ color: '#888', fontSize: '12px', marginBottom: '12px' }}>Or test with quick simulator accounts:</p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button onClick={() => devLoginAs('priya@pod.com', 'Priya')} style={{
                    padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(250,246,240,0.15)', background: 'transparent',
                    color: '#FAF6F0', fontSize: '12px', cursor: 'pointer'
                  }}>Priya</button>
                  <button onClick={() => devLoginAs('marcus@pod.com', 'Marcus')} style={{
                    padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(250,246,240,0.15)', background: 'transparent',
                    color: '#FAF6F0', fontSize: '12px', cursor: 'pointer'
                  }}>Marcus</button>
                  <button onClick={() => devLoginAs('dana@pod.com', 'Dana')} style={{
                    padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(250,246,240,0.15)', background: 'transparent',
                    color: '#FAF6F0', fontSize: '12px', cursor: 'pointer'
                  }}>Dana</button>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN: DASHBOARD */}
          {currentScreen === 'dashboard' && currentUser && (
            <div style={{ padding: '24px 24px', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 className="text-serif" style={{ fontSize: '24px' }}>Hi, {currentUser.name}</h2>
                  <span style={{ color: '#888', fontSize: '12px' }}>{activePod ? activePod.name : 'No active pod'}</span>
                </div>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', backgroundColor: currentUser.color,
                  color: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 'bold', fontSize: '16px', fontFamily: 'var(--font-serif)'
                }}>
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
              </div>

              {!activePod ? (
                // NO POD VIEW: CREATE OR JOIN
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', margin: 'auto 0' }}>
                  <div style={{ backgroundColor: 'rgba(250,246,240,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <h3 className="text-serif" style={{ fontSize: '18px', marginBottom: '12px', color: '#FAF6F0' }}>Create a Pod</h3>
                    <p style={{ color: '#888', fontSize: '12px', marginBottom: '16px' }}>Invite 3-7 friends to reason together daily.</p>
                    <form onSubmit={handleCreatePod} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <input
                        type="text"
                        className="input-underlined"
                        placeholder="Pod Name (e.g. Brain Trust)"
                        value={podNameInput}
                        onChange={(e) => setPodNameInput(e.target.value)}
                        required
                      />
                      <button type="submit" className="btn-primary" style={{ padding: '12px' }}>Create</button>
                    </form>
                  </div>

                  <div style={{ backgroundColor: 'rgba(250,246,240,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <h3 className="text-serif" style={{ fontSize: '18px', marginBottom: '12px', color: '#FAF6F0' }}>Join a Pod</h3>
                    <p style={{ color: '#888', fontSize: '12px', marginBottom: '16px' }}>Enter the 6-character code sent by your friend.</p>
                    <form onSubmit={handleJoinPod} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <input
                        type="text"
                        className="input-underlined"
                        placeholder="Invite Code (e.g. X1Y2Z3)"
                        value={inviteCodeInput}
                        onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                        maxLength={6}
                        required
                      />
                      <button type="submit" className="btn-primary" style={{ padding: '12px' }}>Join</button>
                    </form>
                  </div>
                </div>
              ) : (
                // HAS POD VIEW
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                  {/* Daily question callout */}
                  <div style={{
                    backgroundColor: 'rgba(250, 246, 240, 0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '20px',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: '16px',
                    marginTop: '20px'
                  }}>
                    <span style={{ fontSize: '32px' }}>✉️</span>
                    <div>
                      <h4 className="text-serif" style={{ fontSize: '20px', marginBottom: '6px' }}>Today's Question is Ready</h4>
                      <p style={{ color: '#C9C2B8', fontSize: '13px', lineHeight: '1.4' }}>
                        Take a few minutes to think, answer in your own words, and explain why.
                      </p>
                    </div>
                    <button
                      onClick={() => fetchDailyQuestion(activePod.id, currentUser.id)}
                      className="btn-primary"
                      style={{ padding: '14px 28px', width: 'auto' }}
                    >
                      Open Question
                    </button>
                  </div>

                  {/* Pod members list */}
                  <div style={{ marginTop: '16px' }}>
                    <h4 style={{ color: '#FAF6F0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
                      Your Pod ({podMembers.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {podMembers.map(m => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'rgba(250,246,240,0.02)', borderRadius: '10px', border: '1px solid rgba(250,246,240,0.04)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '28px', height: '28px', borderRadius: '50%', backgroundColor: m.user_color,
                              color: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 'bold', fontSize: '12px', fontFamily: 'var(--font-serif)'
                            }}>
                              {m.user_initial}
                            </div>
                            <span style={{ fontSize: '13px', color: '#FAF6F0' }}>
                              {m.user_name} {m.user_id === currentUser.id && '(You)'}
                            </span>
                          </div>
                          
                          {/* 5-day streak preview */}
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {(m.streak_history || []).slice(-5).map((answered, i) => (
                              <div
                                key={i}
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  backgroundColor: answered === true ? '#7A8B7A' : answered === false ? 'rgba(250,246,240,0.1)' : 'rgba(250,246,240,0.03)',
                                  border: answered === false ? '1px solid rgba(250,246,240,0.2)' : 'none'
                                }}
                                title={answered === true ? 'Answered' : answered === false ? 'Missed' : 'No question'}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{
                    marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderTop: '1px solid var(--border-color)', paddingTop: '16px'
                  }}>
                    <div>
                      <span style={{ color: '#888', fontSize: '11px', display: 'block' }}>Invite Code</span>
                      <span
                        onClick={() => {
                          navigator.clipboard.writeText(activePod.invite_code);
                          setSuccessMsg('Invite code copied!');
                        }}
                        style={{ color: '#FAF6F0', fontSize: '15px', fontWeight: 'bold', letterSpacing: '1px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {activePod.invite_code} 📋
                      </span>
                    </div>

                    <button
                      onClick={() => setCurrentScreen('pod_settings')}
                      style={{
                        background: 'none', border: 'none', color: '#C9C2B8', fontSize: '12px', cursor: 'pointer'
                      }}
                    >
                      Pod Settings ⚙️
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SCREEN: QUESTION */}
          {currentScreen === 'question' && dailyQuestion && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 28px 28px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', marginBottom: '28px' }}>
                <button
                  onClick={() => setCurrentScreen('dashboard')}
                  style={{ background: 'none', border: 'none', color: '#C9C2B8', fontSize: '18px', cursor: 'pointer' }}
                >
                  ←
                </button>
                <div style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {dailyQuestion.category} · today
                </div>
                <div style={{ width: '18px' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%', backgroundColor: dailyQuestion.asker.color,
                  color: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 'bold', fontSize: '13px', fontFamily: 'var(--font-serif)'
                }}>
                  {dailyQuestion.asker.initial}
                </div>
                <div>
                  <div style={{ color: '#FAF6F0', fontSize: '13px', fontWeight: '600' }}>
                    {dailyQuestion.asker.name} asked the pod
                  </div>
                </div>
              </div>

              <div className="text-serif" style={{ fontSize: '26px', lineHeight: '1.35', color: '#FAF6F0', marginBottom: '32px' }}>
                {dailyQuestion.text}
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ color: '#C9C2B8', fontSize: '11px', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Your answer
                </div>
                <input
                  value={myAnswerInput}
                  onChange={(e) => setMyAnswerInput(e.target.value)}
                  placeholder="Short answer, no overthinking the wording"
                  className="input-underlined"
                  disabled={dailyQuestion.hasAnswered}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ color: '#C9C2B8', fontSize: '11px', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Why
                </div>
                <textarea
                  value={myReasoningInput}
                  onChange={(e) => setMyReasoningInput(e.target.value)}
                  placeholder="The reasoning is the part that counts. A sentence or two."
                  rows={3}
                  className="textarea-boxed"
                  disabled={dailyQuestion.hasAnswered}
                />
                {!dailyQuestion.hasAnswered && (
                  <div style={{ textAlign: 'right', fontSize: '10px', color: myReasoningInput.trim().length >= 12 ? '#7A8B7A' : '#888', marginTop: '4px' }}>
                    {myReasoningInput.trim().length}/12 chars minimum
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 28 }}>
                <div style={{ color: '#C9C2B8', fontSize: '11px', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  How sure are you
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['low', 'medium', 'high'].map((level) => {
                    const active = myConfidenceInput === level;
                    return (
                      <button
                        key={level}
                        onClick={() => !dailyQuestion.hasAnswered && setMyConfidenceInput(level)}
                        style={{
                          flex: 1,
                          padding: '10px 0',
                          borderRadius: '10px',
                          border: active ? '1px solid #E8533D' : '1px solid rgba(250,246,240,0.15)',
                          background: active ? 'rgba(232,83,61,0.14)' : 'transparent',
                          color: active ? '#E8533D' : '#C9C2B8',
                          fontSize: 13,
                          cursor: dailyQuestion.hasAnswered ? 'default' : 'pointer',
                          textTransform: 'capitalize',
                          outline: 'none'
                        }}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>

              {!dailyQuestion.hasAnswered ? (
                <button
                  onClick={handleSubmitAnswer}
                  disabled={myAnswerInput.trim().length === 0 || myReasoningInput.trim().length < 12 || !myConfidenceInput}
                  className="btn-primary"
                  style={{ marginTop: 'auto' }}
                >
                  Send to the pod
                </button>
              ) : (
                <button
                  onClick={() => setCurrentScreen('waiting')}
                  className="btn-primary"
                  style={{ marginTop: 'auto', backgroundColor: '#7A8B7A', color: '#1A1A1A' }}
                >
                  View Pod Status
                </button>
              )}
              
              <div style={{ textAlign: 'center', color: '#888', fontSize: '11px', marginTop: 10 }}>
                You'll see everyone else's once you've answered
              </div>
            </div>
          )}

          {/* SCREEN: WAITING */}
          {currentScreen === 'waiting' && dailyQuestion && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 36px', textAlign: 'center' }}>
              <button
                onClick={() => setCurrentScreen('dashboard')}
                style={{ position: 'absolute', top: '12px', left: '16px', background: 'none', border: 'none', color: '#C9C2B8', fontSize: '18px', cursor: 'pointer' }}
              >
                ←
              </button>

              <div style={{ display: 'flex', marginBottom: '24px', justifyContent: 'center' }}>
                {(dailyQuestion.answersStatus || []).map((m, i) => (
                  <div
                    key={m.userId}
                    style={{
                      marginLeft: i === 0 ? 0 : -8,
                      position: 'relative',
                      opacity: m.answered ? 1 : 0.4,
                      transition: 'opacity 0.3s'
                    }}
                  >
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '50%', backgroundColor: m.userColor,
                      color: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 'bold', fontSize: '15px', fontFamily: 'var(--font-serif)',
                      border: m.answered ? '2px solid #7A8B7A' : '2px dashed rgba(250,246,240,0.3)'
                    }}>
                      {m.userInitial}
                    </div>
                    {m.answered && (
                      <div style={{
                        position: 'absolute', bottom: '-2px', right: '-2px',
                        backgroundColor: '#7A8B7A', width: '14px', height: '14px',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#1A1A1A', fontSize: '8px', fontWeight: 'bold'
                      }}>
                        ✓
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <h3 className="text-serif" style={{ color: '#FAF6F0', fontSize: '20px', marginBottom: '10px' }}>
                {dailyQuestion.totalMembers - dailyQuestion.answeredCount === 0 
                  ? 'Done. Unlocking answers...' 
                  : `Waiting for ${dailyQuestion.totalMembers - dailyQuestion.answeredCount} more`}
              </h3>
              
              <p style={{ color: '#C9C2B8', fontSize: '13px', lineHeight: '1.5', marginBottom: '36px' }}>
                {dailyQuestion.answersStatus.filter(m => !m.answered).map(m => m.userName).join(' and ')} haven't answered yet. 
                Everyone's reasoning unlocks once the whole pod is in.
              </p>

              <button
                onClick={() => fetchDailyQuestion(activePod.id, currentUser.id)}
                className="btn-secondary"
                style={{ marginBottom: '12px' }}
              >
                Check status 🔄
              </button>

              <div style={{ fontSize: '11px', color: '#888' }}>
                Question expires: {new Date(dailyQuestion.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}

          {/* SCREEN: REVEAL */}
          {currentScreen === 'reveal' && dailyQuestion && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Question summary header */}
              <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => setCurrentScreen('dashboard')}
                  style={{ background: 'none', border: 'none', color: '#C9C2B8', fontSize: '18px', cursor: 'pointer' }}
                >
                  ←
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#FAF6F0', fontSize: '13px', fontWeight: '600' }}>Everyone answered</div>
                  <div style={{ color: '#888', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dailyQuestion.text}
                  </div>
                </div>
              </div>

              {/* Answers feed */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 32px' }}>
                {/* 1. OWN ANSWER (top, quiet, no reactions) */}
                {dailyQuestion.myAnswer && (
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', opacity: 0.8 }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '50%', backgroundColor: currentUser.color,
                      color: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 'bold', fontSize: '13px', fontFamily: 'var(--font-serif)', flexShrink: 0
                    }}>
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#FAF6F0', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                        You · <span style={{ color: '#7A8B7A' }}>{dailyQuestion.myAnswer.answer}</span>
                      </div>
                      <div style={{ color: '#C9C2B8', fontSize: '13.5px', lineHeight: '1.45', background: 'rgba(250,246,240,0.02)', padding: '10px 12px', borderRadius: '10px' }}>
                        {dailyQuestion.myAnswer.reasoning}
                      </div>
                      <div style={{ color: '#888', fontSize: '10px', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Confidence: {dailyQuestion.myAnswer.confidence}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. PEER ANSWERS (with reactions) */}
                {(dailyQuestion.answers || []).filter(a => a.user_id !== currentUser.id).map((ans) => {
                  // Find if we have reacted
                  const myRx = (ans.reactions || []).find(r => r.userId === currentUser.id);
                  const activeReaction = myRx ? myRx.reactionType : null;

                  // Reaction counters
                  const countByRx = {
                    'changed my view': 0,
                    'solid reasoning': 0,
                    'didn\'t hold up': 0
                  };
                  (ans.reactions || []).forEach(r => {
                    if (countByRx[r.reactionType] !== undefined) {
                      countByRx[r.reactionType]++;
                    }
                  });

                  return (
                    <div key={ans.id} style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
                      <div style={{
                        width: '34px', height: '34px', borderRadius: '50%', backgroundColor: ans.userColor,
                        color: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold', fontSize: '13px', fontFamily: 'var(--font-serif)', flexShrink: 0
                      }}>
                        {ans.userInitial}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#FAF6F0', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                          {ans.userName} · <span style={{ color: '#E8533D' }}>{ans.answer}</span>
                        </div>
                        <div style={{ color: '#FAF6F0', fontSize: '13.5px', lineHeight: '1.45', background: 'rgba(250,246,240,0.04)', padding: '10px 12px', borderRadius: '10px' }}>
                          {ans.reasoning}
                        </div>
                        
                        {/* Reaction buttons */}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                          {['changed my view', 'solid reasoning', 'didn\'t hold up'].map(r => {
                            const active = activeReaction === r;
                            const count = countByRx[r] || 0;
                            
                            // Style bases
                            let border = '1px solid rgba(250,246,240,0.1)';
                            let bg = 'transparent';
                            let color = '#888';
                            
                            if (active) {
                              if (r === 'didn\'t hold up') {
                                border = '1px solid #E8533D';
                                bg = 'rgba(232,83,61,0.12)';
                                color = '#E8533D';
                              } else {
                                border = '1px solid #7A8B7A';
                                bg = 'rgba(122,139,122,0.16)';
                                color = '#9CB89C';
                              }
                            } else if (count > 0) {
                              // Someone else reacted
                              border = '1px dashed rgba(250,246,240,0.15)';
                              color = '#FAF6F0';
                            }

                            return (
                              <button
                                key={r}
                                onClick={() => handleReaction(ans.id, r)}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '20px',
                                  border,
                                  background: bg,
                                  color,
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  outline: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.2s'
                                }}
                              >
                                {r}
                                {count > 0 && <span style={{ fontWeight: 'bold' }}>{count}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SCREEN: STATS / CALIBRATION */}
          {currentScreen === 'stats' && currentUser && (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 className="text-serif" style={{ fontSize: '24px' }}>Calibration</h2>
                <span style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase' }}>Private</span>
              </div>

              {calibrationData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Calibration metric */}
                  <div style={{
                    backgroundColor: 'rgba(250,246,240,0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '20px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#FAF6F0', fontFamily: 'var(--font-serif)' }}>
                      {calibrationData.calibrationPercent !== null ? `${calibrationData.calibrationPercent}%` : '--'}
                    </div>
                    <div style={{ color: '#C9C2B8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: '4px', marginBottom: '12px' }}>
                      Calibration Accuracy
                    </div>
                    <p style={{ color: '#888', fontSize: '12px', lineHeight: '1.4' }}>
                      {calibrationData.calibrationStatus}
                    </p>
                  </div>

                  {/* Stated confidence explanation */}
                  <div style={{ fontSize: '12px', color: '#888', lineHeight: '1.4' }}>
                    💡 <strong>Brier Calibration:</strong> Measures how well your confidence ratings align with peer feedback over time. 
                    Being 100% calibrated means when you rate a response with 'high' confidence, peers almost always find it solid, 
                    and when you say 'low', they agree it is weak.
                  </div>

                  {/* History List */}
                  <div>
                    <h3 style={{ color: '#FAF6F0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
                      Your Answer History ({calibrationData.history?.length || 0})
                    </h3>
                    
                    {calibrationData.history?.length === 0 ? (
                      <p style={{ color: '#666', fontSize: '12px' }}>You haven't answered any questions yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {calibrationData.history.map((h) => (
                          <div key={h.answerId} style={{ padding: '14px', backgroundColor: 'rgba(250,246,240,0.01)', borderRadius: '12px', border: '1px solid rgba(250,246,240,0.03)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888', marginBottom: '4px' }}>
                              <span>{h.category} · {h.dateStr}</span>
                              <span style={{ textTransform: 'uppercase', fontWeight: 'bold', color: h.confidence === 'high' ? '#E8533D' : '#C9C2B8' }}>
                                {h.confidence} confidence
                              </span>
                            </div>
                            <div className="text-serif" style={{ fontSize: '14px', color: '#FAF6F0', marginBottom: '6px' }}>
                              "{h.questionText}"
                            </div>
                            <div style={{ color: '#C9C2B8', fontSize: '12px', marginBottom: '8px' }}>
                              <strong>Answer:</strong> {h.answer}
                            </div>
                            {/* Reactions received */}
                            {h.reactions.length > 0 ? (
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {h.reactions.map((rx, idx) => (
                                  <span key={idx} style={{
                                    fontSize: '9.5px', padding: '2px 6px', borderRadius: '10px',
                                    backgroundColor: rx.type === 'didn\'t hold up' ? 'rgba(232,83,61,0.08)' : 'rgba(122,139,122,0.12)',
                                    color: rx.type === 'didn\'t hold up' ? '#E8533D' : '#9CB89C',
                                    border: `1px solid ${rx.type === 'didn\'t hold up' ? 'rgba(232,83,61,0.15)' : 'rgba(122,139,122,0.2)'}`
                                  }}>
                                    {rx.type}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: '10px', color: '#555' }}>No reactions received yet</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SCREEN: POD SETTINGS */}
          {currentScreen === 'pod_settings' && activePod && (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <button
                  onClick={() => setCurrentScreen('dashboard')}
                  style={{ background: 'none', border: 'none', color: '#C9C2B8', fontSize: '18px', cursor: 'pointer' }}
                >
                  ←
                </button>
                <h2 className="text-serif" style={{ fontSize: '24px' }}>Pod Settings</h2>
              </div>

              {/* Category selector */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ color: '#FAF6F0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
                  My Question Categories
                </h3>
                <p style={{ color: '#888', fontSize: '12px', marginBottom: '12px' }}>
                  The daily question will be drawn from categories selected by at least one member.
                </p>
                
                {currentUser && podMembers.find(m => m.user_id === currentUser.id) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {['relationships', 'finance', 'tech & AI', 'work/career', 'ethics & values', 'general reasoning'].map(cat => {
                      const member = podMembers.find(m => m.user_id === currentUser.id);
                      const isSelected = (member.selected_categories || []).includes(cat);
                      return (
                        <label
                          key={cat}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 14px', backgroundColor: isSelected ? 'rgba(232,83,61,0.05)' : 'rgba(250,246,240,0.01)',
                            borderRadius: '10px', border: `1px solid ${isSelected ? 'rgba(232,83,61,0.2)' : 'rgba(250,246,240,0.04)'}`,
                            fontSize: '13px', color: isSelected ? '#FAF6F0' : '#C9C2B8', cursor: 'pointer'
                          }}
                        >
                          <span style={{ textTransform: 'capitalize' }}>{cat}</span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleCategoryToggle(cat)}
                            style={{ accentColor: '#E8533D', cursor: 'pointer' }}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Submit Question */}
              <div style={{ marginBottom: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                <h3 style={{ color: '#FAF6F0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
                  Submit Question
                </h3>
                <p style={{ color: '#888', fontSize: '12px', marginBottom: '12px' }}>
                  Suggest a new question for rotation. Requires 2 upvotes to enter.
                </p>
                <form onSubmit={handleSubmitCustomQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <select
                    value={customQuestionCategory}
                    onChange={(e) => setCustomQuestionCategory(e.target.value)}
                    style={{
                      background: 'rgba(250,246,240,0.04)', border: '1px solid var(--border-color)',
                      color: '#FAF6F0', padding: '10px', borderRadius: '8px', fontSize: '13px', outline: 'none'
                    }}
                  >
                    {['relationships', 'finance', 'tech & AI', 'work/career', 'ethics & values', 'general reasoning'].map(cat => (
                      <option key={cat} value={cat} style={{ background: '#1A1A1A', textTransform: 'capitalize' }}>{cat}</option>
                    ))}
                  </select>
                  <textarea
                    rows={2}
                    className="textarea-boxed"
                    placeholder="e.g. Would you rather have $50,000 today..."
                    value={customQuestionText}
                    onChange={(e) => setCustomQuestionText(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn-primary" style={{ padding: '10px' }}>Submit Question</button>
                </form>
              </div>

              {/* Moderation Queue */}
              {pendingQuestions.length > 0 && (
                <div style={{ marginBottom: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                  <h3 style={{ color: '#FAF6F0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
                    Moderation Queue ({pendingQuestions.length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {pendingQuestions.map((q) => {
                      const hasVoted = q.voted_by?.includes(currentUser.id);
                      return (
                        <div key={q.id} style={{ padding: '12px', backgroundColor: 'rgba(250,246,240,0.02)', borderRadius: '10px', border: '1px solid rgba(250,246,240,0.04)' }}>
                          <span style={{ fontSize: '9px', textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: '4px' }}>{q.category}</span>
                          <p style={{ fontSize: '12px', color: '#C9C2B8', marginBottom: '8px' }}>"{q.text}"</p>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              disabled={hasVoted}
                              onClick={() => handleVoteQuestion(q.id, 'upvote')}
                              style={{
                                padding: '4px 8px', borderRadius: '6px', border: '1px solid #7A8B7A',
                                background: hasVoted ? 'transparent' : 'rgba(122,139,122,0.1)',
                                color: '#9CB89C', fontSize: '10px', cursor: hasVoted ? 'default' : 'pointer'
                              }}
                            >
                              Upvote ({q.upvotes || 0})
                            </button>
                            <button
                              disabled={hasVoted}
                              onClick={() => handleVoteQuestion(q.id, 'report')}
                              style={{
                                padding: '4px 8px', borderRadius: '6px', border: '1px solid #E8533D',
                                background: hasVoted ? 'transparent' : 'rgba(232,83,61,0.1)',
                                color: '#E8533D', fontSize: '10px', cursor: hasVoted ? 'default' : 'pointer'
                              }}
                            >
                              Report ({q.reports || 0})
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Leave Pod Button */}
              <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button
                  onClick={handleLeavePod}
                  className="btn-primary"
                  style={{ backgroundColor: 'transparent', border: '1px solid #E8533D', color: '#E8533D' }}
                >
                  Leave Pod
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Global Navigation Bottom Bar (Only visible when logged in & has pod) */}
        {currentUser && activePod && currentScreen !== 'login' && currentScreen !== 'question' && currentScreen !== 'waiting' && (
          <nav className="bottom-nav">
            <button
              onClick={() => setCurrentScreen('dashboard')}
              className={`nav-item ${currentScreen === 'dashboard' ? 'active' : ''}`}
            >
              <span className="nav-icon">❄️</span>
              <span>Daily Check</span>
            </button>

            <button
              onClick={() => setCurrentScreen('stats')}
              className={`nav-item ${currentScreen === 'stats' ? 'active' : ''}`}
            >
              <span className="nav-icon">📊</span>
              <span>Calibration</span>
            </button>

            <button
              onClick={() => setCurrentScreen('pod_settings')}
              className={`nav-item ${currentScreen === 'pod_settings' ? 'active' : ''}`}
            >
              <span className="nav-icon">⚙️</span>
              <span>Settings</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
