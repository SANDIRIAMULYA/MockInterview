import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Interview.css';

const Interview = () => {
    const navigate = useNavigate();
    const [sessionData, setSessionData] = useState(() => {
        const savedSession = localStorage.getItem('interviewSession');
        return savedSession ? JSON.parse(savedSession) : null;
    });

    const [questionsBySkill, setQuestionsBySkill] = useState({});
    const [currentSkillIndex, setCurrentSkillIndex] = useState(0);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [interviewStarted, setInterviewStarted] = useState(false);
    const [messages, setMessages] = useState([]);
    const [isRecording, setIsRecording] = useState(false);
    const [userAnswer, setUserAnswer] = useState('');
    const [interviewCompleted, setInterviewCompleted] = useState(false);
    const [skills, setSkills] = useState([]);

    // Restore session on mount
    useEffect(() => {
        const savedSession = localStorage.getItem('interviewSession');
        const savedProgress = localStorage.getItem('interviewProgress');

        if (savedSession) {
            const session = JSON.parse(savedSession);
            const progress = savedProgress ? JSON.parse(savedProgress) : null;
            handleSessionStart(session, progress);
        }
    }, []);

    // Save progress when key values change
    useEffect(() => {
        if (interviewStarted) {
            const progress = {
                currentSkillIndex,
                currentQIndex,
                messages,
            };
            localStorage.setItem('interviewProgress', JSON.stringify(progress));
        }
    }, [currentSkillIndex, currentQIndex, messages, interviewStarted]);

    const handleSessionStart = (data, progress = null) => {
        setSessionData(data);
        setSkills(data.skills);
        setQuestionsBySkill(data.questions || {});
        setInterviewStarted(true);

        if (progress) {
            setCurrentSkillIndex(progress.currentSkillIndex);
            setCurrentQIndex(progress.currentQIndex);
            setMessages(progress.messages);
        } else {
            startInterview(data.questions, data.skills);
        }
    };

    const startInterview = (questions, skills) => {
        if (!questions || !skills || skills.length === 0) return;

        const firstSkill = skills[0];
        const firstQuestion = questions[firstSkill]?.[0];

        if (!firstQuestion) return;

        setMessages([{
            type: 'bot',
            text: firstQuestion,
            skill: firstSkill,
            timestamp: new Date().toLocaleTimeString()
        }]);
    };

    const handleNextQuestion = () => {
        if (isRecording) {
            alert('Please stop recording before proceeding');
            return;
        }

        const skillKeys = Object.keys(questionsBySkill);
        const currentSkill = skillKeys[currentSkillIndex];
        const questionsForSkill = questionsBySkill[currentSkill];

        if (currentQIndex < questionsForSkill.length - 1) {
            const nextQIndex = currentQIndex + 1;
            setCurrentQIndex(nextQIndex);
            addBotMessage(questionsForSkill[nextQIndex], currentSkill);
        } else if (currentSkillIndex < skillKeys.length - 1) {
            const nextSkillIndex = currentSkillIndex + 1;
            const nextSkill = skillKeys[nextSkillIndex];
            const nextSkillQuestions = questionsBySkill[nextSkill];

            setCurrentSkillIndex(nextSkillIndex);
            setCurrentQIndex(0);
            addBotMessage(nextSkillQuestions[0], nextSkill);
        } else {
            setInterviewCompleted(true);
            addBotMessage("You've completed the mock interview. Great job!");
        }
    };

    const addBotMessage = (text, skill = null) => {
        const message = {
            type: 'bot',
            text,
            skill,
            timestamp: new Date().toLocaleTimeString()
        };
        setMessages(prev => [...prev, message]);
    };

    const addUserMessage = (text) => {
        setMessages(prev => [...prev, {
            type: 'user',
            text,
            timestamp: new Date().toLocaleTimeString()
        }]);
    };

    const toggleRecording = () => {
        if (isRecording) {
            setIsRecording(false);
            if (userAnswer.trim()) {
                addUserMessage(userAnswer);
            } else {
                addUserMessage("[Audio response]");
            }
            setUserAnswer('');
        } else {
            setIsRecording(true);
            setUserAnswer('');
        }
    };

    const handleSkip = () => {
        if (isRecording) toggleRecording();
        handleNextQuestion();
    };

    const handleEndInterview = () => {
        setInterviewCompleted(true);
        addBotMessage("Interview ended. Thank you for your participation!");
    };

    const handleNewInterview = () => {
        localStorage.removeItem('interviewSession');
        localStorage.removeItem('interviewProgress');
        navigate('/upload');
    };

    return (
        <div className="interview-container">
            {!interviewStarted ? (
                <div className="loading-screen">
                    <p>Loading interview session...</p>
                    <button onClick={() => navigate('/upload')} className="back-btn">
                        Back to Resume Upload
                    </button>
                </div>
            ) : (
                <div className="interview-interface">
                    <div className="interview-header">
                        <h2>Mock Interview</h2>
                        <div className="progress-indicator">
                            <span>Skill {currentSkillIndex + 1} of {skills.length}</span>
                            <span>Question {currentQIndex + 1} of {questionsBySkill[skills[currentSkillIndex]]?.length || 0}</span>
                        </div>
                        <div className="skill-tags">
                            {skills.map((skill, index) => (
                                <span
                                    key={skill}
                                    className={`skill-tag ${index === currentSkillIndex ? 'active' : ''}`}
                                >
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="conversation-view">
                        <div className="message-history">
                            {messages.map((msg, index) => (
                                <div key={index} className={`message-bubble ${msg.type}`}>
                                    <div className="message-header">
                                        <span className="sender">{msg.type === 'bot' ? 'Interviewer' : 'You'}</span>
                                        <span className="timestamp">{msg.timestamp}</span>
                                    </div>
                                    {msg.skill && <div className="skill-label">{msg.skill}</div>}
                                    <div className="message-text">{msg.text}</div>
                                </div>
                            ))}
                        </div>

                        {isRecording && (
                            <div className="recording-section">
                                <div className="recording-indicator">
                                    <div className="pulse-dot"></div>
                                    <span>Recording your answer...</span>
                                </div>
                                <textarea
                                    value={userAnswer}
                                    onChange={(e) => setUserAnswer(e.target.value)}
                                    placeholder="Or type your answer here instead..."
                                    className="answer-input"
                                />
                            </div>
                        )}
                    </div>

                    <div className="control-panel">
                        {!interviewCompleted ? (
                            <div className="controls-row">
                                <button
                                    className={`control-btn record-btn ${isRecording ? 'active' : ''}`}
                                    onClick={toggleRecording}
                                >
                                    {isRecording ? (
                                        <>
                                            <span className="icon">●</span> Stop Recording
                                        </>
                                    ) : (
                                        <>
                                            <span className="icon">●</span> Record Answer
                                        </>
                                    )}
                                </button>
                                <button
                                    className="control-btn next-btn"
                                    onClick={handleNextQuestion}
                                    disabled={isRecording}
                                >
                                    Next Question
                                </button>
                                <button
                                    className="control-btn skip-btn"
                                    onClick={handleSkip}
                                >
                                    Skip Question
                                </button>
                                <button
                                    className="control-btn end-btn"
                                    onClick={handleEndInterview}
                                >
                                    End Interview
                                </button>
                            </div>
                        ) : (
                            <div className="completion-screen">
                                <h3>Interview Completed!</h3>
                                <p>You've answered all the questions.</p>
                                <div className="completion-buttons">
                                    <button
                                        className="review-btn"
                                        onClick={() => navigate('/review')}
                                    >
                                        Review Answers
                                    </button>
                                    <button
                                        className="new-interview-btn"
                                        onClick={handleNewInterview}
                                    >
                                        Start New Interview
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Interview;
