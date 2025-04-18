import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, CircularProgress, Box, Typography, Paper } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import './Review.css';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const getScoreColor = (score) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FFC107';
    if (score >= 40) return '#FF9800';
    return '#F44336';
};

const Review = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [interviewData, setInterviewData] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const renderStatCard = (title, value, subtitle) => (
        <div className="stat-card">
            <Typography variant="h6">{title}</Typography>
            <Typography variant="h3">{value}</Typography>
            <Typography variant="subtitle1">{subtitle}</Typography>
        </div>
    );

    const renderScoreCards = (analysisData) => {
        if (!analysisData?.scores) return null;

        return [
            { 
                key: 'overall', 
                label: 'Overall', 
                value: analysisData.scores.overall_score || 0,
                detail: null
            },
            { 
                key: 'grammar', 
                label: 'Grammar', 
                value: analysisData.scores.grammar_score || 0,
                detail: analysisData.grammar_analysis ? `${analysisData.grammar_analysis.error_count || 0} errors` : '0 errors'
            },
            { 
                key: 'stop_words', 
                label: 'Stop Words', 
                value: analysisData.scores.stop_word_score || 0,
                detail: analysisData.stop_word_analysis ? `${analysisData.stop_word_analysis.stop_word_count || 0} found` : '0 found'
            },
            { 
                key: 'filler', 
                label: 'Filler Words', 
                value: analysisData.scores.filler_score || 0,
                detail: analysisData.filler_word_analysis ? `${analysisData.filler_word_analysis.filler_word_count || 0} found` : '0 found'
            },
            { 
                key: 'tone', 
                label: 'Tone', 
                value: analysisData.scores.tone_score || 0,
                detail: analysisData.tone_analysis ? 
                    (analysisData.tone_analysis.tone_categories || ['Neutral']).join(', ') : 
                    'Neutral'
            }
        ].map((item) => (
            <Box key={item.key} sx={{ 
                position: 'relative',
                width: 120,
                height: 120,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <CircularProgress 
                    variant="determinate" 
                    value={item.value} 
                    size={120}
                    thickness={4}
                    sx={{
                        color: getScoreColor(item.value),
                        position: 'absolute',
                        top: 0,
                        left: 0
                    }}
                />
                <Box sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center'
                }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        {item.value.toFixed(0)}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                        {item.label}
                    </Typography>
                    {item.detail && (
                        <Typography variant="caption" sx={{ fontSize: '0.6rem', mt: 0.5 }}>
                            {item.detail}
                        </Typography>
                    )}
                </Box>
            </Box>
        ));
    };

    const renderSkillChart = (statsData) => {
        if (!statsData?.skillStats) return null;
        
        return (
            <div className="chart-container">
                <Typography variant="h6" align="center">Answer Rate by Skill</Typography>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={Object.entries(statsData.skillStats).map(([skill, data]) => ({
                        name: skill,
                        value: data.percentage,
                        questions: data.questions,
                        answered: data.answered
                    }))}>
                        <XAxis dataKey="name" />
                        <YAxis unit="%" />
                        <Tooltip 
                            formatter={(value, name, props) => [
                                `${value}% (${props.payload.answered}/${props.payload.questions})`,
                                name
                            ]}
                        />
                        <Bar dataKey="value" fill="#8884d8">
                            {Object.entries(statsData.skillStats).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const renderPauseChart = (statsData) => {
        if (!statsData?.pausePercentage) return null;
        
        return (
            <div className="chart-container">
                <Typography variant="h6" align="center">Speaking vs Pauses</Typography>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={[
                                { name: 'Speaking', value: 100 - parseFloat(statsData.pausePercentage) || 0 },
                                { name: 'Pauses', value: parseFloat(statsData.pausePercentage) || 0 }
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                        >
                            <Cell key="cell-speaking" fill={COLORS[0]} />
                            <Cell key="cell-pauses" fill={COLORS[1]} />
                        </Pie>
                        <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const calculateStats = (data) => {
        if (!data) return;

        const userMessages = data.messages?.filter(msg => msg.type === 'user') || [];
        const questionsAsked = data.messages?.filter(msg => msg.type === 'bot' && msg.skill) || [];
        
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

        const skillStats = {};
        data.skills?.forEach(skill => {
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

    const performAnalysis = async (data) => {
        try {
            const responseText = data.messages
                .filter(msg => msg.type === 'user')
                .map(msg => msg.text)
                .join('\n\n')
                .trim();
    
            console.log("Text being analyzed (length):", responseText.length);
    
            if (!responseText) {
                throw new Error('No responses to analyze');
            }
    
            const payload = { 
                text: responseText,
                session_id: data.sessionId || 'unknown'  // Ensure we always pass at least 'unknown'
            };
            
            console.log("Sending analysis request with payload:", payload);
    
            const response = await fetch('http://localhost:5000/analyze-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
    
            if (!response.ok) {
                const errorText = await response.text();
                console.error("Server returned error:", errorText);
                throw new Error(`Analysis failed: ${response.status} - ${errorText}`);
            }
    
            const result = await response.json();
            console.log("Analysis API response:", result);
            
            if (result.status !== 'success' && !result.analysis) {
                throw new Error(result.message || 'Analysis failed with unknown error');
            }
    
            return result.analysis || result;
        } catch (err) {
            console.error('Analysis error:', err);
            throw err;
        }
    };

    const processInterviewData = async (data) => {
        try {
            let workingData = {...data};
            setInterviewData(workingData);
            calculateStats(workingData);
            
            // Save basic data immediately
            localStorage.setItem('currentInterview', JSON.stringify(workingData));
    
            // Check if we have enough text to analyze
            const responseText = workingData.messages
                ?.filter(msg => msg.type === 'user')
                ?.map(msg => msg.text)
                ?.join('\n\n')
                ?.trim() || '';
    
            if (responseText.split(/\s+/).length >= 5) {
                console.log("Performing new analysis on text length:", responseText.length);
                try {
                    const analysisResult = await performAnalysis(workingData);
                    console.log("Analysis completed successfully:", analysisResult);
                    
                    workingData = {
                        ...workingData,
                        analysis: analysisResult
                    };
                    
                    setInterviewData(workingData);
                    setAnalysis(analysisResult);
                    localStorage.setItem('currentInterview', JSON.stringify(workingData));
                    
                    // Only try to save to backend if we have a valid sessionId
                    if (workingData.sessionId && workingData.sessionId !== 'unknown') {
                        try {
                            await fetch('http://localhost:5000/complete-interview', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    session_id: workingData.sessionId,
                                    messages: workingData.messages,
                                    transcript: workingData.transcript,
                                    analysis: analysisResult
                                }),
                            });
                        } catch (saveError) {
                            console.error("Failed to save to backend:", saveError);
                        }
                    }
                } catch (analysisError) {
                    console.error("Analysis failed:", analysisError);
                    setError(`Analysis failed: ${analysisError.message}`);
                }
            } else {
                console.log("Text too short for analysis:", responseText);
                setError("Not enough response text to analyze");
            }
        } catch (err) {
            console.error('Error processing interview data:', err);
            setError(err.message || 'Failed to process interview data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);
                
                let interviewData = null;
                
                // Try to get data from multiple sources in order of preference
                if (location.state?.interviewData) {
                    console.log("Using interview data from navigation state");
                    interviewData = location.state.interviewData;
                } else {
                    // Try to get from localStorage
                    const savedInterview = localStorage.getItem('currentInterview');
                    const savedResults = localStorage.getItem('interviewResults');
                    
                    if (savedInterview) {
                        console.log("Using interview data from localStorage (currentInterview)");
                        interviewData = JSON.parse(savedInterview);
                    } else if (savedResults) {
                        console.log("Using interview data from localStorage (interviewResults)");
                        interviewData = JSON.parse(savedResults);
                    }
                }

                if (interviewData) {
                    await processInterviewData(interviewData);
                } else {
                    setError('No interview data found');
                    setLoading(false);
                }
            } catch (err) {
                console.error('Error loading interview data:', err);
                setError(err.message || 'Failed to load interview results');
                setLoading(false);
            }
        };

        fetchData();
    }, [location]);

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" flexDirection="column">
                <CircularProgress size={60} />
                <Typography variant="h6" sx={{ mt: 2 }}>
                    {interviewData && !analysis ? 'Analyzing your responses...' : 'Loading your interview results...'}
                </Typography>
            </Box>
        );
    }

    if (error) {
        return (
            <Box textAlign="center" mt={4}>
                <Typography variant="h5" gutterBottom>
                    {error}
                </Typography>
                <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={() => navigate('/')}
                    sx={{ mt: 2 }}
                >
                    Back to Home
                </Button>
                {interviewData && (
                    <Button 
                        variant="outlined" 
                        color="secondary" 
                        onClick={() => processInterviewData(interviewData)}
                        sx={{ mt: 2, ml: 2 }}
                    >
                        Retry
                    </Button>
                )}
            </Box>
        );
    }

    if (!interviewData) {
        return (
            <Box textAlign="center" mt={4}>
                <Typography variant="h5" gutterBottom>
                    No interview data found
                </Typography>
                <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={() => navigate('/upload')}
                    sx={{ mt: 2 }}
                >
                    Start New Interview
                </Button>
            </Box>
        );
    }

    return (
        <div className="review-container">
            <Typography variant="h4" gutterBottom>Interview Review</Typography>
            
            {/* Stats Overview */}
            <div className="stats-overview">
                {stats && renderStatCard("Questions Answered", `${stats.answeredQuestions}/${stats.totalQuestions}`, `(${stats.answerRate.toFixed(1)}%)`)}
                {stats && renderStatCard("Pause Percentage", `${stats.pausePercentage}%`, "of total interview time")}
                {analysis?.scores && renderStatCard("Overall Score", `${analysis.scores.overall_score.toFixed(1)}/100`, "Response Quality")}
            </div>

            {/* Analysis Section */}
            <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
                <Typography variant="h5" gutterBottom>Response Analysis</Typography>
                
                {/* Score Cards */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4, justifyContent: 'center' }}>
                    {renderScoreCards(analysis)}
                </Box>

                {/* Radar Chart */}
                {analysis?.scores && (
                    <Box sx={{ height: 300, mb: 4 }}>
                        <Typography variant="h6" align="center" gutterBottom>
                            Response Quality Breakdown
                        </Typography>
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                                { subject: 'Grammar', A: analysis.scores.grammar_score || 0, fullMark: 100 },
                                { subject: 'Stop Words', A: analysis.scores.stop_word_score || 0, fullMark: 100 },
                                { subject: 'Filler Words', A: analysis.scores.filler_score || 0, fullMark: 100 },
                                { subject: 'Tone', A: analysis.scores.tone_score || 0, fullMark: 100 },
                                { subject: 'Overall', A: analysis.scores.overall_score || 0, fullMark: 100 },
                            ]}>
                                <PolarGrid />
                                <PolarAngleAxis dataKey="subject" />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                                <Radar 
                                    name="Score" 
                                    dataKey="A" 
                                    stroke="#8884d8" 
                                    fill="#8884d8" 
                                    fillOpacity={0.6} 
                                />
                                <Tooltip formatter={(value) => [`${value}/100`, 'Score']} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </Box>
                )}

                {/* Improvement Suggestions */}
                {analysis?.improvement_suggestions?.length > 0 && (
                    <Box>
                        <Typography variant="h6" gutterBottom>Improvement Suggestions</Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {analysis.improvement_suggestions.map((suggestion, index) => (
                                <Paper 
                                    key={index} 
                                    elevation={2}
                                    sx={{
                                        p: 2,
                                        borderLeft: '4px solid',
                                        borderColor: 'primary.main',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 2
                                    }}
                                >
                                    <Box sx={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        bgcolor: 'primary.main',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        mt: '2px'
                                    }}>
                                        {index + 1}
                                    </Box>
                                    <Typography variant="body1">{suggestion}</Typography>
                                </Paper>
                            ))}
                        </Box>
                    </Box>
                )}
            </Paper>

            {/* Charts Section */}
            <div className="charts-section">
                {stats && renderSkillChart(stats)}
                {stats && renderPauseChart(stats)}
            </div>

            {/* Transcript Section */}
            <div className="transcript-section">
                <Typography variant="h6">Full Transcript</Typography>
                <div className="transcript-content">
                    {stats?.transcript?.split('\n').map((para, i) => (
                        <Typography key={i} paragraph>{para}</Typography>
                    ))}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
                <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={() => {
                        localStorage.removeItem('currentInterview');
                        localStorage.removeItem('interviewResults');
                        localStorage.removeItem('interviewProgress');
                        navigate('/upload');
                    }}
                    size="large"
                    sx={{ mt: 3 }}
                >
                    Start New Interview
                </Button>
            </div>
        </div>
    );
};

export default Review;
