import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Welcome from './components/Welcome';
import ResumeUpload from './components/ResumeUpload';
import Interview from './components/Interview';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);

  return (
    <Router>
      <div className="App">
        <header>
          <h1>MockInsight</h1>
        </header>
        <Routes>
          <Route path="/" element={<Welcome setUser={setUser} />} />
          <Route
            path="/upload"
            element={
              user ? (
                <ResumeUpload onSessionStart={setSession} />
              ) : (
                <div>Please log in to continue.</div>
              )
            }
          />
          <Route
            path="/interview"
            element={
              session ? (
                <Interview session={session} />
              ) : (
                <div>Please start a session first.</div>
              )
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;