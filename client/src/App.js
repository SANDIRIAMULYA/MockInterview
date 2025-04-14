import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Welcome from './components/Welcome';
import Interview from './components/Interview';
import ResumeUpload from './components/ResumeUpload';
import Review from './components/Review'; // Import the Review component
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [sessionData, setSessionData] = useState(null);

  // Check for existing session on initial load
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedSession = localStorage.getItem('currentSession');
    
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse user data', e);
        localStorage.removeItem('user');
      }
    }
    
    if (storedSession) {
      setSessionData({ session_id: storedSession });
    }
  }, []);

  const handleSessionStart = (data) => {
    setSessionData(data);
    localStorage.setItem('currentSession', data.session_id);
  };

  const handleLogout = () => {
    setUser(null);
    setSessionData(null);
    localStorage.removeItem('user');
    localStorage.removeItem('currentSession');
    localStorage.removeItem('interviewResults'); // Clear review data on logout
  };

  // Protected route component
  const ProtectedRoute = ({ children }) => {
    if (!user) {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  return (
    <Router>
      <div className="App">
        <header>
          <h1>Mock Interview</h1>
          {user && (
            <div className="user-controls">
              <span>Welcome, {user.name}</span>
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </header>
        
        <main className="main-content">
          <Routes>
            <Route 
              path="/" 
              element={
                user ? (
                  <Navigate to="/upload" replace />
                ) : (
                  <Welcome setUser={setUser} />
                )
              } 
            />
            
            <Route
              path="/upload"
              element={
                <ProtectedRoute>
                  <ResumeUpload 
                    onSessionStart={handleSessionStart} 
                    existingSession={sessionData}
                  />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/interview"
              element={
                <ProtectedRoute>
                  {sessionData ? (
                    <Interview sessionData={sessionData} />
                  ) : (
                    <Navigate to="/upload" replace />
                  )}
                </ProtectedRoute>
              }
            />

            {/* New Review Route */}
            <Route
              path="/review"
              element={
                <ProtectedRoute>
                  <Review />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;