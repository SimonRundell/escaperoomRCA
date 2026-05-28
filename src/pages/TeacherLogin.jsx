/**
 * TeacherLogin — username/password form that authenticates against auth.php.
 * On success redirects to /teacher. Links to /teacher/setup if no account exists yet.
 *
 * @license CC BY-NC-SA 4.0 — Simon Rundell / CodeMonkey Design
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginTeacher } from '../api/gameApi';

export default function TeacherLogin() {
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error,    setError]    = useState(null);
    const [busy,     setBusy]     = useState(false);

    /** @param {React.FormEvent} e */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            await loginTeacher(username, password);
            navigate('/teacher');
        } catch (err) {
            setError(err.response?.data?.error ?? 'Login failed. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h1>Teacher Login</h1>
                <p className="auth-subtitle">Fault Tree Escape Room — Control Panel</p>

                <form onSubmit={handleSubmit} className="auth-form">
                    <label htmlFor="username">Username</label>
                    <input
                        id="username"
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        required
                        disabled={busy}
                    />

                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        disabled={busy}
                    />

                    {error && <p className="auth-error" role="alert">{error}</p>}

                    <button type="submit" className="btn btn-primary" disabled={busy}>
                        {busy ? 'Signing in…' : 'Sign In'}
                    </button>
                </form>

                <p className="auth-footer">
                    No account yet?{' '}
                    <Link to="/teacher/setup">Create the first teacher account</Link>
                </p>
            </div>
        </div>
    );
}
