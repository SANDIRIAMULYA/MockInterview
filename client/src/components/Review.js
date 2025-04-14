import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, CircularProgress, Box, Typography } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import './Review.css';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const Review = () => {
    const navigate = useNavigate();
    const [interviewData, setInterviewData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        const results = localStorage.getItem('interviewResults');
        if (results) {
            const data = JSON.parse(results);
            setInterviewData(data);
            calculateStats(data);
        } else {
            navigate('/');
        }
        setLoading(false);
    }, [navigate]);

    const calculateStats = (data) => {
        if (!data) return;

        // Calculate questions answered
        const userMessages = data.messages.filter(msg => msg.type === 'user');
        const questionsAsked = data.messages.filter(msg => msg.type === 'bot' && msg.skill);
        
        // Calculate pause percentage from transcript
        let totalPauseTime = 0;
        let totalAudioTime = 0;
        
        if (data.transcript?.pauses) {
            data.transcript.pauses.forEach(pause => {
                totalPauseTime += (pause.end - pause.start);
            });
            
            if (data.transcript.segments?.length > 0) {
                totalAudioTime = data.transcript.segments[data.transcript.segments.length - 1].end;
            }
        }
        
        const pausePercentage = totalAudioTime > 0 ? (totalPauseTime / totalAudioTime) * 100 : 0;

        // Calculate skill distribution
        const skillStats = {};
        data.skills.forEach(skill => {
            const skillQuestions = questionsAsked.filter(q => q.skill === skill).length;
            const skillAnswers = userMessages.filter((msg, i) => {
                return i > 0 && data.messages[i-1].skill === skill;
            }).length;
            
            skillStats[skill] = {
                questions: skillQuestions,
                answered: skillAnswers,
                percentage: skillQuestions > 0 ? (skillAnswers / skillQuestions) * 100 : 0
            };
        });

        setStats({
            totalQuestions: questionsAsked.length,
            answeredQuestions: userMessages.length,
            answerRate: questionsAsked.length > 0 ? (userMessages.length / questionsAsked.length) * 100 : 0,
            pausePercentage: pausePercentage.toFixed(2),
            skillStats,
            pauses: data.transcript?.pauses || [],
            transcript: data.transcript?.text || "No transcript available"
        });
    };

    const handleNewInterview = () => {
        navigate('/upload');
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
                <CircularProgress />
            </Box>
        );
    }

    if (!interviewData || !stats) {
        return (
            <Box textAlign="center" mt={4}>
                <Typography variant="h5">No interview data found</Typography>
                <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={() => navigate('/')}
                    style={{ marginTop: '20px' }}
                >
                    Back to Home
                </Button>
            </Box>
        );
    }

    // Prepare data for charts
    const skillData = Object.entries(stats.skillStats).map(([skill, data]) => ({
        name: skill,
        value: data.percentage,
        questions: data.questions,
        answered: data.answered
    }));

    const pauseData = [
        { name: 'Speaking', value: 100 - parseFloat(stats.pausePercentage) },
        { name: 'Pauses', value: parseFloat(stats.pausePercentage) }
    ];

    return (
        <div className="review-container">
            <Typography variant="h4" gutterBottom>Interview Review</Typography>
            
            <div className="stats-overview">
                <div className="stat-card">
                    <Typography variant="h6">Questions Answered</Typography>
                    <Typography variant="h3">
                        {stats.answeredQuestions}/{stats.totalQuestions}
                    </Typography>
                    <Typography variant="subtitle1">
                        ({stats.answerRate.toFixed(1)}%)
                    </Typography>
                </div>
                
                <div className="stat-card">
                    <Typography variant="h6">Pause Percentage</Typography>
                    <Typography variant="h3">
                        {stats.pausePercentage}%
                    </Typography>
                    <Typography variant="subtitle1">
                        of total interview time
                    </Typography>
                </div>
            </div>

            <div className="charts-section">
                <div className="chart-container">
                    <Typography variant="h6" align="center">Answer Rate by Skill</Typography>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={skillData}>
                            <XAxis dataKey="name" />
                            <YAxis unit="%" />
                            <Tooltip 
                                formatter={(value, name, props) => [
                                    `${value}% (${props.payload.answered}/${props.payload.questions})`,
                                    name
                                ]}
                            />
                            <Bar dataKey="value" fill="#8884d8">
                                {skillData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-container">
                    <Typography variant="h6" align="center">Speaking vs Pauses</Typography>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={pauseData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                // label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                            >
                                {pauseData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip 
                                formatter={(value, name, props) => [
                                    `${value}%`,
                                    name
                                ]}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="transcript-section">
                <Typography variant="h6">Full Transcript</Typography>
                <div className="transcript-content">
                    {stats.transcript.split('\n').map((para, i) => (
                        <Typography key={i} paragraph>{para}</Typography>
                    ))}
                </div>
            </div>

            <div className="action-buttons">
                <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={handleNewInterview}
                    size="large"
                >
                    Start New Interview
                </Button>
            </div>
        </div>
    );
};

export default Review;