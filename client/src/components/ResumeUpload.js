import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FaUpload, FaFileAlt } from 'react-icons/fa';
import './ResumeUpload.css';

const ResumeUpload = ({ onSessionStart }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [sessionData, setSessionData] = useState(null);
    const navigate = useNavigate();

    // Load session data on component mount
    useEffect(() => {
        const loadSessionData = () => {
            const savedSession = localStorage.getItem('interviewSession');
            if (savedSession) {
                try {
                    setSessionData(JSON.parse(savedSession));
                } catch (e) {
                    console.error('Failed to parse session data', e);
                    localStorage.removeItem('interviewSession');
                }
            }
        };

        loadSessionData();
    }, []);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        if (!allowedTypes.includes(selectedFile.type)) {
            setError('Please upload a PDF or Word document');
            return;
        }

        if (selectedFile.size > 5 * 1024 * 1024) {
            setError('File size should be less than 5MB');
            return;
        }

        setFile(selectedFile);
        setError('');
        setUploadProgress(0);
    };

    const extractQuestionsFromSkills = (skills) => {
        const questionsBySkill = {};
        skills.forEach(skill => {
            questionsBySkill[skill] = [
                `Tell me about your experience with ${skill}`,
                `What challenges have you faced while working with ${skill}?`,
                `How would you rate your proficiency in ${skill}?`
            ];
        });
        return questionsBySkill;
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) {
            setError("Please select a file to upload");
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('Authentication token missing');

            const config = {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    );
                    setUploadProgress(percentCompleted);
                }
            };

            const response = await axios.post(
                'http://localhost:5000/upload-resume',
                formData,
                config
            );

            if (!response.data?.skills) {
                throw new Error('No skills extracted from resume');
            }

            const extractedSkills = response.data.skills;
            const questionsBySkill = extractQuestionsFromSkills(extractedSkills);
            const sessionId = response.data.session_id || `session_${Date.now()}`;

            const newSessionData = {
                skills: extractedSkills,
                questions: questionsBySkill,
                session_id: sessionId,
                resumeFile: file.name
            };

            localStorage.setItem('interviewSession', JSON.stringify(newSessionData));
            setSessionData(newSessionData);
            onSessionStart(newSessionData);
            navigate('/interview');
        } catch (error) {
            console.error('Upload error:', error);
            let errorMsg = 'Failed to process resume. Please try again.';

            if (error.response) {
                if (error.response.status === 401) {
                    errorMsg = 'Session expired. Please login again.';
                    localStorage.removeItem('token');
                    navigate('/');
                } else if (error.response.data?.error) {
                    errorMsg = error.response.data.error;
                }
            } else if (error.message) {
                errorMsg = error.message;
            }

            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleContinueInterview = () => {
        if (!sessionData) {
            setError('No session data available');
            return;
        }
        onSessionStart(sessionData);
        navigate('/interview');
    };

    const handleNewUpload = () => {
        localStorage.removeItem('interviewSession');
        setSessionData(null);
        setFile(null);
        setUploadProgress(0);
    };

    return (
        <div className="resume-upload-container">
            {/* Resume Upload Section */}
            <div className="upload-section">
                <h2>Upload Your Resume</h2>
                <p>We'll analyze your resume to create a personalized mock interview</p>

                {sessionData ? (
                    <div className="session-options">
                        <div className="existing-session">
                            <p><FaFileAlt /> Resume already uploaded for this session.</p>
                            <p><strong>File:</strong> {sessionData.resumeFile}</p>
                            <div className="skills-list">
                                <h4>Identified Skills:</h4>
                                {sessionData.skills.map((skill, index) => (
                                    <span key={index} className="skill-tag">{skill}</span>
                                ))}
                            </div>
                        </div>
                        <div className="action-buttons">
                            <button 
                                onClick={handleContinueInterview}
                                className="btn primary-btn"
                            >
                                Continue Interview
                            </button>
                            <button 
                                onClick={handleNewUpload}
                                className="btn secondary-btn"
                            >
                                Upload New Resume
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleUpload} className="upload-form">
                        <div className="file-input-container">
                            <input
                                type="file"
                                id="resume-upload"
                                accept=".pdf,.doc,.docx"
                                onChange={handleFileChange}
                                disabled={loading}
                            />
                            <label htmlFor="resume-upload" className={file ? 'file-selected' : ''}>
                                {file ? (
                                    <>
                                        <span className="file-name">{file.name}</span>
                                        <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                    </>
                                ) : (
                                    <>
                                        <FaUpload className="upload-icon" />
                                        <span>Choose File (PDF or Word)</span>
                                    </>
                                )}
                            </label>
                        </div>

                        {uploadProgress > 0 && uploadProgress < 100 && (
                            <div className="progress-container">
                                <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                                <span className="progress-text">{uploadProgress}%</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !file}
                            className={`btn upload-btn ${loading ? 'loading' : ''}`}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner"></span>
                                    {uploadProgress === 100 ? 'Processing...' : 'Uploading...'}
                                </>
                            ) : (
                                'Upload & Analyze Resume'
                            )}
                        </button>
                    </form>
                )}

                {error && (
                    <div className="error-message">
                        <p>{error}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResumeUpload;