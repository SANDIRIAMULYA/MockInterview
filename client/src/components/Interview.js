import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Interview = ({ session }) => {
    const [recording, setRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(0);

    useEffect(() => {
        if (navigator.mediaDevices) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    const recorder = new MediaRecorder(stream);
                    recorder.ondataavailable = handleDataAvailable;
                    setMediaRecorder(recorder);
                });
        }
    }, []);

    const handleDataAvailable = async (e) => {
        const audioFile = new File([e.data], 'recording.webm');
        const formData = new FormData();
        formData.append('audio', audioFile);
        formData.append('session_id', session.session_id);

        try {
            await axios.post('http://localhost:5000/process-audio', formData);
        } catch (error) {
            console.error('Audio processing error:', error);
        }
    };

    const startRecording = () => {
        mediaRecorder.start(1000);
        setRecording(true);
    };

    const stopRecording = () => {
        mediaRecorder.stop();
        setRecording(false);
    };

    return (
        <div className="interview-container">
            <h2>Mock Interview</h2>
            <div className="question-list">
                {Object.entries(session.questions).map(([skill, questions]) => (
                    <div key={skill} className="skill-section">
                        <h3>{skill}</h3>
                        {questions.map((q, i) => (
                            <div key={i} className="question">{q}</div>
                        ))}
                    </div>
                ))}
            </div>
            <div className="recording-controls">
                <button onClick={recording ? stopRecording : startRecording}>
                    {recording ? 'Stop Recording' : 'Start Recording'}
                </button>
            </div>
        </div>
    );
};

export default Interview;
