/**
 * App — root router for the Fault Tree Escape Room.
 *
 * Routes:
 *   /              → /join (redirect)
 *   /join          → Student join page
 *   /join/:code    → Join page with pre-filled game code
 *   /game/:code    → Student in-game view
 *   /escaped/:code → Escape success / leaderboard screen
 *   /teacher/login → Teacher login form
 *   /teacher/setup → One-time first-account setup
 *   /teacher       → Teacher dashboard (protected — requires session)
 *   /teacher/:code → Teacher dashboard for a specific game (protected)
 *
 * @license CC BY-NC-SA 4.0 — Simon Rundell / CodeMonkey Design
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import JoinGame          from './pages/JoinGame';
import StudentGame       from './pages/StudentGame';
import TeacherDashboard  from './pages/TeacherDashboard';
import TeacherLogin      from './pages/TeacherLogin';
import TeacherSetup      from './pages/TeacherSetup';
import EscapeSuccess     from './pages/EscapeSuccess';
import ProtectedTeacher  from './components/ProtectedTeacher';
import CMFloatAd         from './components/CMFloatAd';
import './index.css';

export default function App() {
    return (
        <>
        <BrowserRouter>
            <Routes>
                <Route path="/"              element={<Navigate to="/join" replace />} />
                <Route path="/join"          element={<JoinGame />} />
                <Route path="/join/:code"    element={<JoinGame />} />
                <Route path="/game/:code"    element={<StudentGame />} />
                <Route path="/escaped/:code" element={<EscapeSuccess />} />

                {/* Teacher auth */}
                <Route path="/teacher/login" element={<TeacherLogin />} />
                <Route path="/teacher/setup" element={<TeacherSetup />} />

                {/* Protected teacher routes */}
                <Route path="/teacher" element={
                    <ProtectedTeacher><TeacherDashboard /></ProtectedTeacher>
                } />
                <Route path="/teacher/:code" element={
                    <ProtectedTeacher><TeacherDashboard /></ProtectedTeacher>
                } />
            </Routes>
        </BrowserRouter>
        <CMFloatAd />
        </>
    );
}
