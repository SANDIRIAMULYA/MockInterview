import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Interview.css';
import { Button } from '@mui/material';

const Interview = () => {
    const navigate = useNavigate();
    const [sessionData, setSessionData] = useState(null);
    const [questionsBySkill, setQuestionsBySkill] = useState({});
    const [currentSkillIndex, setCurrentSkillIndex] = useState(0);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [interviewStarted, setInterviewStarted] = useState(false);
    const [messages, setMessages] = useState([]);
    const [isRecording, setIsRecording] = useState(false);
    const [interviewCompleted, setInterviewCompleted] = useState(false);
    const [skills, setSkills] = useState([]);
    const [transcript, setTranscript] = useState(null);
    const [recordingError, setRecordingError] = useState(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const mediaStreamRef = useRef(null);

    useEffect(() => {
        const savedSession = localStorage.getItem('interviewSession');
        if (savedSession) {
            const session = JSON.parse(savedSession);
            initializeInterview(session);
        }

        return () => {
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    useEffect(() => {
        // Automatically move to next question when transcript is received
        if (transcript && !interviewCompleted) {
            const timer = setTimeout(() => {
                handleNextQuestion();
            }, 1500); // 1.5 second delay before next question

            return () => clearTimeout(timer);
        }
    }, [transcript]);

    const initializeInterview = (sessionData) => {
        const formattedQuestions = {};
        for (const skill in sessionData.questions) {
            formattedQuestions[skill] = sessionData.questions[skill].map(q => {
                if (typeof q === 'object' && q.question) {
                    return q.question;
                }
                return q;
            });
        }

        setSessionData(sessionData);
        setSkills(sessionData.skills);
        setQuestionsBySkill(formattedQuestions);
        setMessages([]);
        setCurrentSkillIndex(0);
        setCurrentQIndex(0);
        setTranscript(null);
        setInterviewStarted(true);
        setInterviewCompleted(false);
        setRecordingError(null);

        const firstSkill = sessionData.skills[0];
        const firstQuestion = formattedQuestions[firstSkill]?.[0];
        
        if (firstQuestion) {
            setMessages([{
                type: 'bot',
                text: firstQuestion,
                skill: firstSkill,
                timestamp: new Date().toLocaleTimeString()
            }]);
        }
    };

    const handleNextQuestion = () => {
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
            completeInterview();
        }
    };

    const addBotMessage = (text, skill = null) => {
        const messageText = typeof text === 'object' ? text.question || 'Invalid question format' : text;
        
        const message = {
            type: 'bot',
            text: messageText,
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
                
                if (mediaRecorderRef.current?.state !== 'inactive') {
                    mediaRecorderRef.current.stop();
                }

                await new Promise(resolve => {
                    mediaRecorderRef.current.onstop = resolve;
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

                    if (!response.ok) throw new Error(`Server error: ${response.status}`);
                    
                    const result = await response.json();
                    if (result.error) throw new Error(result.error);

                    setTranscript(result);
                    
                    const answerText = result.text || '[Audio response]';
                    addUserMessage(answerText);
                } else {
                    addUserMessage('[No audio recorded]');
                }
            } catch (error) {
                console.error('Recording error:', error);
                setRecordingError('Failed to process recording');
                addUserMessage('[Recording error]');
            } finally {
                audioChunksRef.current = [];
                cleanupMediaStream();
            }
        } else {
            // Start recording
            try {
                if (!navigator.mediaDevices?.getUserMedia) {
                    throw new Error('Audio not supported');
                }

                setRecordingError(null);
                audioChunksRef.current = [];
                
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 16000
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
                    console.error('Recorder error:', e.error);
                    setRecordingError('Recording failed');
                    setIsRecording(false);
                };

                mediaRecorder.start(1000);
                setIsRecording(true);
            } catch (error) {
                console.error('Recording start error:', error);
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

    const completeInterview = async () => {
        setInterviewCompleted(true);
        addBotMessage("Interview completed. Thank you!");
        
        // Combine all user responses for analysis
        const responseText = messages
            .filter(msg => msg.type === 'user')
            .map(msg => msg.text)
            .join(' ');
    
        let analysisResults = null;
        
        if (responseText) {
            try {
                const response = await fetch('http://localhost:5000/analyze-text', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ text: responseText })
                });
    
                if (response.ok) {
                    analysisResults = await response.json();
                }
            } catch (error) {
                console.error('Analysis error:', error);
            }
        }
    
        const interviewResults = {
            sessionId: sessionData._id,
            skills,
            questions: questionsBySkill,
            messages,
            transcript,
            analysis: analysisResults,  // Add analysis results here
            date: new Date().toISOString()
        };
        
        localStorage.setItem('interviewResults', JSON.stringify(interviewResults));
        localStorage.removeItem('interviewProgress');
    };

    const handleEndInterview = () => {
        if (isRecording) {
            toggleRecording().then(completeInterview);
        } else {
            completeInterview();
        }
    };

    const handleNewInterview = () => {
        localStorage.removeItem('interviewSession');
        localStorage.removeItem('interviewProgress');
        localStorage.removeItem('interviewResults');
        navigate('/upload');
    };

    const handleSkip = () => {
        if (isRecording) {
            toggleRecording().then(handleNextQuestion);
        } else {
            handleNextQuestion();
        }
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
                                    <div className="message-text">
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {isRecording && (
                            <div className="recording-section">
                                <div className="recording-indicator">
                                    <div className="pulse-dot"></div>
                                    <span>Recording your answer...</span>
                                </div>
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