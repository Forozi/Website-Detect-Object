import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css'; 

const BACKEND_URL = 'http://localhost:3000/api/track';
const VIDEOS_URL = 'http://localhost:3000/api/videos';
const BASE_HOST = 'http://localhost:3000'; // Dùng để xây dựng URL video

function App() {
    // --- State Management ---
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [trackingClass, setTrackingClass] = useState('2');
    const [confThreshold, setConfThreshold] = useState(0.5);
    const [occludeTime, setOccludeTime] = useState(1.0);
    const [trackedVideoUrl, setTrackedVideoUrl] = useState(null);
    const [videoList, setVideoList] = useState([]);

    // Timer States
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

    // --- LOGIC: FETCH VIDEO LIST ---
    const fetchVideoList = async () => {
        try {
            const response = await axios.get(VIDEOS_URL);
            setVideoList(response.data.reverse());
        } catch (error) {
            console.error("Failed to fetch video list:", error);
        }
    };
    
    // --- EFFECT: INITIAL LOAD & TIMER LOGIC ---
    useEffect(() => {
        fetchVideoList(); // FETCH VIDEO LIST ON COMPONENT MOUNT

        let timerInterval;
        if (loading && startTime) {
            timerInterval = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        } else if (!loading) {
            clearInterval(timerInterval);
        }
        return () => clearInterval(timerInterval);
    }, [loading, startTime]); // Dependencies: loading and startTime

    // --- Handlers ---
    const handleFileChange = (event) => {
      const file = event.target.files[0];
      if (file && file.type.startsWith('video/')) {
          setSelectedFile(file);
          // Quan trọng: Tạo URL mới cho preview
          setPreviewUrl(URL.createObjectURL(file)); 
          setTrackedVideoUrl(null);
          setCompletionMessage(null);
          setError(null);
      } else {
          setSelectedFile(null);
          setPreviewUrl(null);
          alert("Please select a valid video file.");
      }
    };
    const handleRemoveVideo = () => {
        // Thu hồi URL tạm thời của video preview để giải phóng bộ nhớ
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl); 
        }
        
        // Reset tất cả các trạng thái liên quan đến input
        setSelectedFile(null);
        setPreviewUrl(null);
        setTrackedVideoUrl(null); // Xóa video output cũ (nếu có)
        setCompletionMessage(null);
        setError(null);
        
        // Đảm bảo input file element được reset để có thể chọn lại cùng một file
        if (fileInputRef.current) {
            fileInputRef.current.value = null;
        }
    };
    // 1. Handles file selection
    // const handleFileChange = (event) => {
    //     const file = event.target.files[0];
    //     if (file && file.type.startsWith('video/')) {
    //         setSelectedFile(file);
    //         setPreviewUrl(URL.createObjectURL(file));
    //         setTrackedVideoUrl(null);
    //         setCompletionMessage(null);
    //         setError(null);
    //     } else {
    //         setSelectedFile(null);
    //         setPreviewUrl(null);
    //         alert("Please select a valid video file.");
    //     }
    // };

    // 2. Handles form submission and API call
    const handleProcessVideo = async () => {
        if (!selectedFile) {
            alert("Please upload a video file first.");
            return;
        }

        setLoading(true);
        
        // Ghi lại thời điểm BẮT ĐẦU API call (thời gian thực, không phải state)
        const apiCallStartTime = Date.now(); 
        
        // Khởi động các state hiển thị (dùng cho đồng hồ đếm ngược)
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

            // Tính toán thời gian đã trôi qua chính xác dựa trên thời điểm API kết thúc
            const finalElapsedTime = ((Date.now() - apiCallStartTime) / 1000).toFixed(2);

            if (response.data.success) {
                setTrackedVideoUrl(`${BASE_HOST}${response.data.videoUrl}`);
                
                // Sử dụng thời gian đã tính chính xác
                setCompletionMessage(`Processing completed successfully in ${finalElapsedTime} seconds.`);
                fetchVideoList(); // Cập nhật danh sách video
            } else {
                setError(response.data.error || 'Tracking process failed.');
                setCompletionMessage('Processing failed.');
            }
        } catch (err) {
            console.error("API Error:", err);
            setError("Could not connect to the backend server (Node.js/Python).");
            setCompletionMessage('Connection failed.');
        } finally {
            setLoading(false);
            setStartTime(null); // Dừng đồng hồ đếm ngược
        }
    };

    // 3. Handles selection of an existing output video
    const handleSelectExistingVideo = (url) => {
        setTrackedVideoUrl(url); 
        setCompletionMessage(`Hiển thị video đã chọn từ thư mục Output.`);
        setError(null);
    }

    // --- UI Component: RENDER INPUT AREA ---
    const renderInputArea = () => (
        <div 
            className="video-input-area" 
            onClick={() => fileInputRef.current.click()}
        >
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
                    // Ngăn chặn video click mở lại dialog chọn file
                    onClick={(e) => e.stopPropagation()} 
                />
            ) : (
                <div className="placeholder-text">
                    Click to Upload Video (MP4)
                </div>
            )}
        </div>
    );

    // --- UI: MAIN RENDER ---
    return (
        <div className="container">
            <h1>DeepSORT Multi-Object Tracker</h1>

            <div className="main-content-compare">
                {/* Cột 1: CONTROLS PANEL */}
                <div className="controls-panel">
                    <h2>Tracking Controls</h2>

                    {/* 1. Object Selection Buttons */}
                    <div className="control-group">
                        <label>Target Object:</label>
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

                    {/* 2. Confidence Threshold Slider */}
                    <div className="control-group slider-group">
                        <label>Conf Threshold: <span>{confThreshold.toFixed(2)}</span></label>
                        <input 
                            type="range" 
                            min="0.1" 
                            max="0.9" 
                            step="0.05" 
                            value={confThreshold} 
                            onChange={(e) => setConfThreshold(parseFloat(e.target.value))} 
                        />
                    </div>

                    {/* 3. Occlude Time Input */}
                    <div className="control-group slider-group">
                        <label>Occlusion Time (s): <span>{occludeTime.toFixed(1)}</span></label>
                        <input 
                            type="number" 
                            min="0.5" 
                            max="5" 
                            step="0.1" 
                            value={occludeTime} 
                            onChange={(e) => setOccludeTime(parseFloat(e.target.value))} 
                            placeholder="Seconds"
                        />
                        <small>Auto-calculates DeepSORT MAX_AGE.</small>
                    </div>

                    {/* 4. Process Status & Timer */}
                    <div className="control-group">
                        {loading && (
                            <div className="status-timer">
                                Đang xử lý... Thời gian: **{elapsedTime} giây**
                            </div>
                        )}
                        {completionMessage && (
                            <div className={`notification ${error ? 'error-message' : 'success-message'}`}>
                                {completionMessage}
                            </div>
                        )}
                    </div>
                    {/* 4. XÓA VIDEO BUTTON (NEW) */}
                    {selectedFile && (
                        <button 
                            className="remove-video-button"
                            onClick={handleRemoveVideo}
                            disabled={loading}
                        >
                            Xóa Video Input Hiện tại
                        </button>
                    )}
                    {/* 5. Process Button */}
                    <button 
                        className="process-button"
                        onClick={handleProcessVideo} 
                        disabled={loading || !selectedFile}
                    >
                        {loading ? 'PROCESSING VIDEO...' : 'START TRACKING PROCESS'}
                    </button>

                    {error && <div className="error-message">Error: {error}</div>}
                </div>

                {/* Cột 2: VIDEO DISPLAY AND OUTPUT AREA */}
                <div className="video-and-output-area">
                    
                    {/* Hàng 1: OUTPUT (LEFT) và INPUT (RIGHT) - Dùng chung một container flex */}
                    <div className="comparison-row"> 
                        
                        {/* 1. OUTPUT VIDEO (LEFT) */}
                        <div className="output-playback-box"> 
                            <h2>Tracked Video Output</h2>
                            {trackedVideoUrl ? (
                                <video controls className="tracked-video" src={trackedVideoUrl}>
                                    Trình duyệt của bạn không hỗ trợ phát video.
                                </video>
                            ) : (
                                <div className="video-placeholder">Chưa có video đầu ra được chọn</div>
                            )}
                        </div>
                        
                        {/* 2. INPUT VIDEO (RIGHT) */}
                        <div className="input-preview-box-compare">
                            <h2>Input Video Preview</h2>
                            {renderInputArea()}
                        </div>
                    </div>
                    
                    {/* Hàng 2: VIDEO LIST (Phải nằm dưới 2 video trên) */}
                    <div className="video-list-row">
                        <div className="video-list-box-full">
                            <h3>Videos đã Xử lý</h3>
                            {videoList.length === 0 ? (
                                <p>Chưa có video nào được xử lý.</p>
                            ) : (
                                <ul>
                                    {videoList.map((video) => (
                                        <li 
                                            key={video.name} 
                                            onClick={() => handleSelectExistingVideo(`${BASE_HOST}${video.url}`)}
                                        >
                                            {video.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}

export default App;