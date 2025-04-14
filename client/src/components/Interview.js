import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Interview.css';
import { Button } from '@mui/material';

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
    const [transcript, setTranscript] = useState(null);
    const [recordingError, setRecordingError] = useState(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const mediaStreamRef = useRef(null);

    useEffect(() => {
        const savedSession = localStorage.getItem('interviewSession');
        const savedProgress = localStorage.getItem('interviewProgress');

        if (savedSession) {
            const session = JSON.parse(savedSession);
            const progress = savedProgress ? JSON.parse(savedProgress) : null;
            handleSessionStart(session, progress);
        }

        // Cleanup on unmount
        return () => {
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

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

    const toggleRecording = async () => {
        if (isRecording) {
            // Stop recording
            try {
                setIsRecording(false);
                setRecordingError(null);
                
                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                    mediaRecorderRef.current.stop();
                }

                // Wait for final data to be available
                await new Promise(resolve => {
                    if (mediaRecorderRef.current) {
                        mediaRecorderRef.current.onstop = resolve;
                    } else {
                        resolve();
                    }
                });

                if (audioChunksRef.current.length > 0) {
                    const audioBlob = new Blob(audioChunksRef.current, { 
                        type: 'audio/webm;codecs=opus' 
                    });
                    
                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'recording.webm');

                    const response = await fetch('http://localhost:5000/transcribe', {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        throw new Error(`Server responded with ${response.status}`);
                    }

                    const result = await response.json();
                    
                    if (result.error) {
                        throw new Error(result.error);
                    }

                    setTranscript(result);
                    
                    if (userAnswer.trim()) {
                        addUserMessage(userAnswer.trim());
                    } else if (result.text) {
                        addUserMessage(result.text);
                    } else {
                        addUserMessage('[Audio response]');
                    }
                } else {
                    addUserMessage('[No audio recorded]');
                }
            } catch (error) {
                console.error('Error processing recording:', error);
                setRecordingError('Failed to process recording. Please try again.');
                addUserMessage('[Error processing audio]');
            } finally {
                setUserAnswer('');
                audioChunksRef.current = [];
                cleanupMediaStream();
            }
        } else {
            // Start recording
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error('Audio recording not supported in this browser');
                }

                setRecordingError(null);
                audioChunksRef.current = [];
                
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 16000,
                        channelCount: 1
                    }
                });
                
                mediaStreamRef.current = stream;
                
                const options = { mimeType: 'audio/webm;codecs=opus' };
                const mediaRecorder = new MediaRecorder(stream, options);
                mediaRecorderRef.current = mediaRecorder;

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        audioChunksRef.current.push(e.data);
                    }
                };

                mediaRecorder.onerror = (e) => {
                    console.error('MediaRecorder error:', e.error);
                    setRecordingError('Recording error occurred');
                    setIsRecording(false);
                    cleanupMediaStream();
                };

                mediaRecorder.start(1000); // Collect data every second
                setIsRecording(true);
            } catch (error) {
                console.error('Error starting recording:', error);
                setRecordingError(error.message);
                setIsRecording(false);
                cleanupMediaStream();
            }
        }
    };

    const cleanupMediaStream = () => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        mediaRecorderRef.current = null;
    };

    const handleSkip = () => {
        if (isRecording) {
            toggleRecording().then(() => {
                handleNextQuestion();
            });
        } else {
            handleNextQuestion();
        }
    };

    // Add this to your handleEndInterview function in Interview.js
const handleEndInterview = () => {
    if (isRecording) {
        toggleRecording().then(() => {
            setInterviewCompleted(true);
            addBotMessage("Interview ended. Thank you for your participation!");
            
            // Save interview results for review
            const interviewResults = {
                sessionId: sessionData._id,
                skills,
                questions: questionsBySkill,
                messages,
                transcript,
                date: new Date().toISOString()
            };
            localStorage.setItem('interviewResults', JSON.stringify(interviewResults));
        });
    } else {
        setInterviewCompleted(true);
        addBotMessage("Interview ended. Thank you for your participation!");
        
        // Save interview results for review
        const interviewResults = {
            sessionId: sessionData._id,
            skills,
            questions: questionsBySkill,
            messages,
            transcript,
            date: new Date().toISOString()
        };
        localStorage.setItem('interviewResults', JSON.stringify(interviewResults));
    }
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

                        {recordingError && (
                            <div className="error-message">
                                {recordingError}
                            </div>
                        )}

                        {transcript && (
                            <div className="transcript-section">
                                <h3>Transcript:</h3>
                                <p>{transcript.text || 'No transcript available'}</p>
                            </div>
                        )}
                    </div>

                    <div className="control-panel">
                        {!interviewCompleted ? (
                            <div className="controls-row">
                                <Button 
                                    onClick={toggleRecording}
                                    variant="contained"
                                    color={isRecording ? "secondary" : "primary"}
                                >
                                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                                </Button>
                                <Button 
                                    onClick={handleNextQuestion} 
                                    disabled={isRecording}
                                    variant="contained"
                                >
                                    Next Question
                                </Button>
                                <Button 
                                    onClick={handleSkip}
                                    variant="outlined"
                                >
                                    Skip Question
                                </Button>
                                <Button 
                                    onClick={handleEndInterview}
                                    variant="outlined"
                                    color="error"
                                >
                                    End Interview
                                </Button>
                            </div>
                        ) : (
                            <div className="completion-screen">
                                <h3>Interview Completed!</h3>
                                <p>You've answered all the questions.</p>
                                <div className="completion-buttons">
                                    <Button 
                                        onClick={() => navigate('/review')}
                                        variant="contained"
                                    >
                                        Review Answers
                                    </Button>
                                    <Button 
                                        onClick={handleNewInterview}
                                        variant="contained"
                                    >
                                        Start New Interview
                                    </Button>
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