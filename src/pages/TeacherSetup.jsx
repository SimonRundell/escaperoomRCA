/**
 * TeacherSetup — one-time form to create the first teacher account.
 * The API blocks this endpoint once any teacher exists, so it is safe
 * to leave the route in place.
 *
 * @license CC BY-NC-SA 4.0 — Simon Rundell / CodeMonkey Design
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { setupTeacher } from '../api/gameApi';

export default function TeacherSetup() {
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirm,  setConfirm]  = useState('');
    const [error,    setError]    = useState(null);
    const [busy,     setBusy]     = useState(false);

    /** @param {React.FormEvent} e */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (password !== confirm) {
            setError('Passwords do not match');
            return;
        }

        setBusy(true);
        try {
            await setupTeacher(username, password);
            navigate('/teacher/login');
        } catch (err) {
            setError(err.response?.data?.error ?? 'Setup failed. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h1>Create Teacher Account</h1>
                <p className="auth-subtitle">
                    This form is only available before the first account is created.
                </p>

                <form onSubmit={handleSubmit} className="auth-form">
                    <label htmlFor="username">Username</label>
                    <input
                        id="username"
                        type="text"
                        autoComplete="username"
                        minLength={3}
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        required
                        disabled={busy}
                    />

                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        disabled={busy}
                    />

                    <label htmlFor="confirm">Confirm Password</label>
                    <input
                        id="confirm"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        required
                        disabled={busy}
                    />

                    {error && <p className="auth-error" role="alert">{error}</p>}

                    <button type="submit" className="btn btn-primary" disabled={busy}>
                        {busy ? 'Creating…' : 'Create Account'}
                    </button>
                </form>

                <p className="auth-footer">
                    Already have an account?{' '}
                    <Link to="/teacher/login">Sign in</Link>
                </p>
            </div>
        </div>
    );
}
