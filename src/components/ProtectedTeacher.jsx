/**
 * ProtectedTeacher — wraps any route that requires a teacher session.
 *
 * On mount it calls the auth check endpoint. While waiting it shows a
 * neutral loading state. If the session is invalid it redirects to
 * /teacher/login; otherwise it renders children.
 *
 * @license CC BY-NC-SA 4.0 — Simon Rundell / CodeMonkey Design
 */
import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { checkAuth } from '../api/gameApi';

export default function ProtectedTeacher({ children }) {
    // 'checking' | 'ok' | 'denied'
    const [status, setStatus] = useState('checking');

    useEffect(() => {
        checkAuth()
            .then(data => setStatus(data.loggedIn ? 'ok' : 'denied'))
            .catch(() => setStatus('denied'));
    }, []);

    if (status === 'checking') {
        return <div className="auth-checking">Verifying credentials…</div>;
    }
    if (status === 'denied') {
        return <Navigate to="/teacher/login" replace />;
    }
    return children;
}
