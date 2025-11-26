import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css'; 

const BACKEND_URL = 'http://localhost:3000/api/track';
const VIDEOS_URL = 'http://localhost:3000/api/videos';
const BASE_HOST = 'http://localhost:3000';

function App() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [trackingClass, setTrackingClass] = useState('2');
    const [confThreshold, setConfThreshold] = useState(0.5);
    const [occludeTime, setOccludeTime] = useState(1.0);
    const [trackedVideoUrl, setTrackedVideoUrl] = useState(null);
    const [videoList, setVideoList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [startTime, setStartTime] = useState(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [completionMessage, setCompletionMessage] = useState(null);
    const [error, setError] = useState(null);

    const fileInputRef = useRef(null);
    
    const classOptions = [
        { label: 'Car', value: '2' },
        { label: 'Bus', value: '5' },
        { label: 'Motorbike', value: '3' },
    ];

    // --- LOGIC FUNCTIONS ---
    const fetchVideoList = async () => {
        try {
            const response = await axios.get(VIDEOS_URL);
            setVideoList(response.data.reverse());

            console.log("Frontend received:", response.data); // <--- Thêm dòng này để soi
        } catch (error) {
            console.error("Failed to fetch video list:", error);
        }
    };
    
    useEffect(() => {
        fetchVideoList();
        let timerInterval;
        if (loading && startTime) {
            timerInterval = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        } else if (!loading) {
            clearInterval(timerInterval);
        }
        return () => clearInterval(timerInterval);
    }, [loading, startTime]);

    const handleFileChange = (event) => {
      const file = event.target.files[0];
      if (file && file.type.startsWith('video/')) {
          setSelectedFile(file);
          setPreviewUrl(URL.createObjectURL(file)); 
          setTrackedVideoUrl(null);
          setCompletionMessage(null);
          setError(null);
      } else {
          alert("Please select a valid video file.");
      }
    };

    const handleRemoveVideo = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl); 
        setSelectedFile(null);
        setPreviewUrl(null);
        setTrackedVideoUrl(null); 
        setCompletionMessage(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = null;
    };

    const handleProcessVideo = async () => {
        if (!selectedFile) return;
        setLoading(true);
        const apiCallStartTime = Date.now(); 
        setStartTime(apiCallStartTime); 
        setElapsedTime(0);
        setError(null);
        setCompletionMessage(null);
        setTrackedVideoUrl(null); 

        const formData = new FormData();
        formData.append('video', selectedFile);
        formData.append('trackingClass', trackingClass);
        formData.append('confThreshold', confThreshold.toFixed(2));
        formData.append('occludeTime', occludeTime.toFixed(1));

        try {
            const response = await axios.post(BACKEND_URL, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const finalElapsedTime = ((Date.now() - apiCallStartTime) / 1000).toFixed(2);

            if (response.data.success) {
                setTrackedVideoUrl(`${BASE_HOST}${response.data.videoUrl}`);
                setCompletionMessage(`Completed in ${finalElapsedTime}s.`);
                fetchVideoList(); 
            } else {
                setError(response.data.error || 'Failed.');
                setCompletionMessage('Processing failed.');
            }
        } catch (err) {
            setError("Connection error.");
            setCompletionMessage('Connection failed.');
            console.error("Maybe connection error: ", err)
        } finally {
            setLoading(false);
            setStartTime(null);
        }
    };

    const handleSelectExistingVideo = (url) => {
        setTrackedVideoUrl(url); 
        setCompletionMessage(`Viewing history.`);
        setError(null);
    }

    const renderInputArea = () => (
        <div className="input-area-wrapper" onClick={() => fileInputRef.current.click()}>
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="video/mp4" 
                style={{ display: 'none' }} 
            />
            {previewUrl ? (
                <video 
                    src={previewUrl} 
                    controls 
                    className="video-player"
                    onClick={(e) => e.stopPropagation()} 
                />
            ) : (
                <div className="placeholder-text">
                    Import a video
                </div>
            )}
        </div>
    );

    // --- MAIN RENDER ---
    return (
        <div className="container">
            
            {/* --- 1. SIDEBAR (CONTROLS) --- */}
            <div className="sidebar">
                <h1>Control Panel</h1>
                
                {/* Object Selection (Vertical) */}
                <div className="control-group">
                    <label>Target Object</label>
                    <div className="button-group">
                        {classOptions.map(option => (
                            <button
                                key={option.value}
                                className={trackingClass === option.value ? 'active' : ''}
                                onClick={() => setTrackingClass(option.value)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Threshold */}
                <div className="control-group">
                    <label>Confidence <span className="value-display">{confThreshold.toFixed(2)}</span></label>
                    <input 
                        type="range" min="0.1" max="0.9" step="0.05" 
                        value={confThreshold} 
                        onChange={(e) => setConfThreshold(parseFloat(e.target.value))} 
                    />
                </div>

                {/* Occlusion */}
                <div className="control-group">
                    <label>Occlusion (s)</label>
                    <input 
                        type="number" min="0.5" max="5" step="0.1" 
                        value={occludeTime} 
                        onChange={(e) => setOccludeTime(parseFloat(e.target.value))} 
                    />
                </div>

                {/* Action Buttons */}
                <div className="control-group" style={{border: 'none'}}>
                    {selectedFile && (
                        <button className="remove-video-button" onClick={handleRemoveVideo} disabled={loading}>
                            Clear
                        </button>
                    )}
                    <button className="process-button" onClick={handleProcessVideo} disabled={loading || !selectedFile}>
                        {loading ? 'Running...' : 'Start'}
                    </button>

                    {loading && <div className="status-timer">⏱ {elapsedTime}s</div>}
                    {completionMessage && <div className={`notification ${error ? 'error-message' : 'success-message'}`}>{completionMessage}</div>}
                    {error && <div className="error-message">{error}</div>}
                </div>
            </div>

            {/* --- 2. MAIN CONTENT AREA (RIGHT) --- */}
            <div className="main-content">
                
                {/* A. VIDEOS ROW */}
                <div className="layout-video-row">
                    <div className="video-box">
                        <h2>Input</h2>
                        <div className="video-content-area">
                            {renderInputArea()}
                        </div>
                    </div>

                    <div className="video-box">
                        <h2>Output</h2>
                        <div className="video-content-area" style={{ cursor: 'default' }}>
                            {trackedVideoUrl ? (
                                <video controls className="tracked-video" src={trackedVideoUrl} />
                            ) : (
                                <div className="placeholder-text" style={{borderStyle: 'dotted'}}>Waiting for output...</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* B. VIDEO LIST (Below Videos) */}
                <div className="video-list-container">
                    <h3>📚 Processing History</h3>
                    <ul className="video-list-ul">
                        {videoList.length === 0 ? (
                            <li style={{color: '#777', justifyContent: 'center'}}>No history available</li>
                        ) : (
                            videoList.map((video) => (
                                <li key={video.name} onClick={() => handleSelectExistingVideo(`${BASE_HOST}${video.url}`)}>
                                    <span>🎬 {video.name}</span>
                                    <span style={{color: '#888'}}>Replay ▶</span>
                                </li>
                            ))
                        )}
                    </ul>
                </div>

            </div>
        </div>
    );
}

export default App;