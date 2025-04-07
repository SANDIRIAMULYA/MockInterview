import React, { useState } from 'react';
import axios from 'axios';
import './abc.css';

const ResumeUpload = ({ onSessionStart }) => {
    const [file, setFile] = useState(null);
    const [skills, setSkills] = useState([]); // State to store extracted skills
    const [loading, setLoading] = useState(false); // State to handle loading state

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) {
            alert("Please upload a resume file.");
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        setLoading(true); // Start loading
        try {
            const response = await axios.post('http://localhost:5000/upload-resume', formData);
            setSkills(response.data.skills); // Set the extracted skills
            onSessionStart(response.data); // Pass data to parent component
        } catch (error) {
            console.error('Upload error:', error);
            alert("Failed to upload resume. Please try again.");
        } finally {
            setLoading(false); // Stop loading
        }
    };

    return (
        <div className="upload-container">
            <h2>Upload Your Resume</h2>
            <form onSubmit={handleUpload}>
                <input 
                    type="file" 
                    accept=".pdf" 
                    onChange={(e) => setFile(e.target.files[0])} 
                    disabled={loading}
                />
                <button type="submit" disabled={loading}>
                    {loading ? "Processing..." : "Start Interview"}
                </button>
            </form>

            {/* Display extracted skills */}
            {skills.length > 0 && (
                <div className="skills-container">
                    <h3>Your Skills:</h3>
                    <div className="skills-list">
                        {skills.map((skill, index) => (
                            <div key={index} className="skill-item">
                                {skill}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResumeUpload;