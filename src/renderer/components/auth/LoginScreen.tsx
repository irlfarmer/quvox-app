'use client'

import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import quvoxLogo from '../../../assets/quvox.png';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        if (!displayName) {
          throw new Error('Display name is required');
        }
        await signUp(email, password, displayName);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError(null);
    setEmail('');
    setPassword('');
    setDisplayName('');
  };

  const openExternalLink = (url: string) => {
    window.open(`https://quvox.app${url}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-card rounded-xl p-8 border border-border">
        <div className="flex flex-col items-center mb-8">
          <img src={quvoxLogo} alt="Quvox Logo" className="h-16 w-auto mb-4" />
          <h1 className="text-[2rem] font-normal text-accent mb-2">Welcome to QUVOX</h1>
          <p className="text-muted-foreground text-[1.125rem] leading-[1.33] font-light">
            Your crowdsourced platform for UI inspiration
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display Name"
                className="auth-input w-full bg-background text-foreground rounded-xl px-6 py-4 text-[1.125rem] leading-[1.33] focus:outline-none placeholder:text-muted-foreground font-light border border-border focus:border-accent/50 transition-colors"
                required={isSignUp}
              />
            </div>
          )}

          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="auth-input w-full bg-background text-foreground rounded-xl px-6 py-4 text-[1.125rem] leading-[1.33] focus:outline-none placeholder:text-muted-foreground font-light border border-border focus:border-accent/50 transition-colors"
              required
            />
          </div>

          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="auth-input w-full bg-background text-foreground rounded-xl px-6 py-4 text-[1.125rem] leading-[1.33] focus:outline-none placeholder:text-muted-foreground font-light border border-border focus:border-accent/50 transition-colors"
              required
            />
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-light">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="auth-button w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl px-6 py-4 text-[1.125rem] leading-[1.33] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-light"
          >
            {loading ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Create Account' : 'Continue')}
          </button>

          <div className="text-center text-sm text-muted-foreground">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={toggleMode}
              className="text-accent hover:text-accent/90 transition-colors bg-transparent border-none p-0 font-light"
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            By continuing, you agree to Quvox's{' '}
            <button
              type="button"
              onClick={() => openExternalLink('/terms')}
              className="text-accent hover:text-accent/90 transition-colors bg-transparent border-none p-0"
            >
              Terms of Service
            </button>{' '}
            and{' '}
            <button
              type="button"
              onClick={() => openExternalLink('/privacy')}
              className="text-accent hover:text-accent/90 transition-colors bg-transparent border-none p-0"
            >
              Privacy Policy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 