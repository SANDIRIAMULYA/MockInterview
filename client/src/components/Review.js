import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, CircularProgress, Box, Typography, Paper, Grid } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import './Review.css';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const getScoreColor = (score) => {
    if (score >= 80) return '#4CAF50'; // Green
    if (score >= 60) return '#FFC107'; // Amber
    if (score >= 40) return '#FF9800'; // Orange
    return '#F44336'; // Red
};

const Review = () => {
    const navigate = useNavigate();
    const [interviewData, setInterviewData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [analysis, setAnalysis] = useState(null);

    useEffect(() => {
        const results = localStorage.getItem('interviewResults');
        if (results) {
            const data = JSON.parse(results);
            setInterviewData(data);
            calculateStats(data);
            
            // Check if we have analysis data in the results
            if (data.analysis) {
                setAnalysis(data.analysis);
            } else {
                // If not, try to analyze the transcript
                analyzeTranscript(data);
            }
        } else {
            navigate('/');
        }
        setLoading(false);
    }, [navigate]);

    const analyzeTranscript = async (data) => {
        try {
            // Combine all user messages into a single text
            const responseText = data.messages
                .filter(msg => msg.type === 'user')
                .map(msg => msg.text)
                .join(' ');
    
            console.log('Text being sent for analysis:', responseText); // Debug log
    
            if (!responseText) {
                console.log('No response text to analyze');
                return;
            }
    
            const response = await fetch('http://localhost:5000/analyze-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: responseText })
            });
    
            console.log('Analysis response status:', response.status); // Debug log
    
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Analysis failed with response:', errorText);
                throw new Error('Analysis failed');
            }
    
            const result = await response.json();
            console.log('Analysis results received:', result); // Debug log
            
            setAnalysis(result);
            
            // Update localStorage with the analysis results
            const updatedResults = {
                ...data,
                analysis: result
            };
            localStorage.setItem('interviewResults', JSON.stringify(updatedResults));
        } catch (error) {
            console.error('Analysis error:', error);
        }
    };

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

    // Prepare data for analysis radar chart
    const analysisData = analysis ? [
        { subject: 'Grammar', A: analysis.scores?.grammar_score || 0, fullMark: 100 },
        { subject: 'Stop Words', A: analysis.scores?.stop_word_score || 0, fullMark: 100 },
        { subject: 'Filler Words', A: analysis.scores?.filler_score || 0, fullMark: 100 },
        { subject: 'Tone', A: analysis.scores?.tone_score || 0, fullMark: 100 },
        { subject: 'Overall', A: analysis.scores?.overall_score || 0, fullMark: 100 },
    ] : [];

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

                {analysis?.scores && (
                    <div className="stat-card">
                        <Typography variant="h6">Overall Score</Typography>
                        <Typography variant="h3">
                            {analysis.scores.overall_score.toFixed(1)}/100
                        </Typography>
                        <Typography variant="subtitle1">
                            Response Quality
                        </Typography>
                    </div>
                )}
            </div>

            {/* Analysis Section */}
            {analysis && (
                <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
                    <Typography variant="h5" gutterBottom>Response Analysis</Typography>
                    
                    {/* Score Cards with Progress Rings */}
                    <Box sx={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: 3, 
                        mb: 4,
                        justifyContent: 'center'
                    }}>
                        {[
                            { key: 'overall', label: 'Overall', value: analysis.scores.overall_score },
                            { key: 'grammar', label: 'Grammar', value: analysis.scores.grammar_score, 
                              detail: `${analysis.grammar_analysis?.error_count || 0} errors` },
                            { key: 'stop_words', label: 'Stop Words', value: analysis.scores.stop_word_score,
                              detail: `${analysis.stop_word_analysis?.stop_word_count || 0} found` },
                            { key: 'filler', label: 'Filler Words', value: analysis.scores.filler_score,
                              detail: `${analysis.filler_word_analysis?.filler_word_count || 0} found` },
                            { key: 'tone', label: 'Tone', value: analysis.scores.tone_score,
                              detail: analysis.tone_analysis?.tone_categories?.join(', ') || 'Neutral' },
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
                                <Box sx={{ 
                                    position: 'relative',
                                    width: '100%',
                                    height: '100%'
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
                                        <Typography variant="caption" sx={{ 
                                            fontSize: '0.7rem',
                                            color: 'text.secondary'
                                        }}>
                                            {item.label}
                                        </Typography>
                                        {item.detail && (
                                            <Typography variant="caption" sx={{ 
                                                fontSize: '0.6rem',
                                                color: 'text.secondary',
                                                mt: 0.5
                                            }}>
                                                {item.detail}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            </Box>
                        ))}
                    </Box>

                    {/* Radar Chart */}
                    <Box sx={{ height: 300, mb: 4 }}>
                        <Typography variant="h6" align="center" gutterBottom>
                            Response Quality Breakdown
                        </Typography>
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={analysisData}>
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
                                <Tooltip 
                                    formatter={(value) => [`${value}/100`, 'Score']}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    </Box>

                    {/* Improvement Suggestions as Cards */}
                    {analysis.improvement_suggestions?.length > 0 && (
                        <Box>
                            <Typography variant="h6" gutterBottom>Improvement Suggestions</Typography>
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2
                            }}>
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
            )}

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
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
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