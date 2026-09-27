import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Unlock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import WebThreads from '../components/WebThreads.jsx';

export default function LoginPage() {
  const { loginWithPassword } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [inputError, setInputError] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!password.trim() || loading || inputError) return;
    setLoading(true);
    setIsUnlocking(true);
    try {
      await loginWithPassword(password);
      setTimeout(() => {
        navigate('/');
      }, 420);
    } catch {
      setIsUnlocking(false);
      setLoading(false);
      setPassword(''); // remove the wrong password
      setInputError(true); // display alert directly in input field
      inputRef.current?.focus();

      // Clear alert after 1 second so user can immediately type again
      setTimeout(() => {
        setInputError(false);
      }, 1000);
    }
  };

  return (
    <div className="auth-bg" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* ── WebThreads Background ── */}
      <WebThreads
        color1="#5227ff"
        color2="#ff9ffc"
        color3="#ffffff"
        speed={0.2}
        threadCount={6}
        frequency={5.0}
        spread={0.18}
        taper={1.0}
        position={0.5}
        fanMode="center"
        glow={0.02}
        falloff={0.6}
        thickness={1.1}
        brightness={0.6}
        opacity={1.0}
        mirror={true}
        shimmer={false}
        grain={true}
        grainIntensity={0.05}
        mouseInteraction={false}
        mouseStrength={0.3}
      />

      {/* ── Seamless Password Entry (No Card, Single Input, 1 Enter Button) ── */}
      <div className="minimal-auth-wrapper">
        <form className="minimal-auth-form" onSubmit={handleSubmit}>
          <div className={`minimal-auth-bar ${inputError ? 'minimal-auth-bar-error' : ''}`}>
            <div className={`liquid-glass-icon lock-icon-wrapper ${isUnlocking ? 'lock-icon-unlocked' : ''}`}>
              {isUnlocking ? (
                <Unlock size={14} className="liquid-glass-svg" color="#a7f3d0" />
              ) : (
                <Lock size={14} className="liquid-glass-svg" color="#ffffff" />
              )}
            </div>

            <input
              ref={inputRef}
              id="login-password"
              type={showPw && !inputError ? 'text' : 'password'}
              className={`minimal-auth-input ${inputError ? 'minimal-auth-input-error' : ''}`}
              placeholder={inputError ? 'Incorrect password!' : 'Enter password...'}
              autoFocus
              value={inputError ? '' : password}
              onChange={(e) => {
                if (inputError) setInputError(false);
                setPassword(e.target.value);
              }}
              disabled={loading}
              autoComplete="current-password"
            />

            <button
              type="button"
              onClick={() => setShowPw((p) => !p)}
              className="liquid-glass-icon liquid-glass-btn"
              title={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? (
                <EyeOff size={14} className="liquid-glass-svg" color="#ffffff" />
              ) : (
                <Eye size={14} className="liquid-glass-svg" color="#ffffff" />
              )}
            </button>

            <button
              type="submit"
              className="box start-btn"
              disabled={loading || !password || inputError}
            >
              <span className="text">{loading ? 'Entering…' : 'Enter'}</span>
              <div className="btn-icon">
                <svg
                  className="svg"
                  viewBox="0 0 1024 1024"
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M779.180132 473.232045 322.354755 16.406668c-21.413706-21.413706-56.121182-21.413706-77.534887 0-21.413706 21.413706-21.413706 56.122205 0 77.534887l418.057421 418.057421L244.819868 930.057421c-21.413706 21.413706-21.413706 56.122205 0 77.534887 10.706853 10.706853 24.759917 16.059767 38.767955 16.059767s28.061103-5.353938 38.767955-16.059767L779.180132 550.767955C800.593837 529.35425 800.593837 494.64575 779.180132 473.232045z" />
                </svg>
              </div>
              <div className="circle-overlay"></div>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



