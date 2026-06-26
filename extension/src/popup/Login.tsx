import React, { useState } from 'react';
import { loginUser, registerUser } from '../services/api.js';
import { setAuthToken, setAuthUser } from '../services/indexeddb.js';
import { User } from '../types/index.js';

interface LoginProps {
  onAuthSuccess: (token: string, user: User, hasResume: boolean) => void;
}

export const Login: React.FC<LoginProps> = ({ onAuthSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        const response = await registerUser(email, password);
        const { token, user } = response;
        await setAuthToken(token);
        await setAuthUser(user);
        onAuthSuccess(token, user, false);
      } else {
        const response = await loginUser(email, password);
        const { token, user } = response;
        await setAuthToken(token);
        await setAuthUser(user);
        onAuthSuccess(token, user, response.user.hasResume);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: '40px' }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>
          {isRegister ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          {isRegister ? 'Sign up to track job applications' : 'Log in to sync your job applications'}
        </p>
      </div>

      {error && (
        <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
          <span>⚠️ {error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            className="input-field"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className="input-field"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '10px' }} disabled={loading}>
          {loading ? 'Processing...' : isRegister ? 'Register' : 'Log In'}
        </button>
      </form>

      <div className="auth-switch">
        {isRegister ? 'Already have an account? ' : "Don't have an account? "}
        <span onClick={() => { setIsRegister(!isRegister); setError(''); }}>
          {isRegister ? 'Log In' : 'Sign Up'}
        </span>
      </div>
    </div>
  );
};
