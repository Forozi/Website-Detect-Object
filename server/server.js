const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors'); 
const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(cors());

const PYTHON_SCRIPT_PATH = path.join(__dirname, 'yolov9', 'tracker.py');
const OUTPUT_DIR = path.join(__dirname, 'output');
app.get('/api/videos', (req, res) => {
    // Đảm bảo thư mục output tồn tại
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        return res.json([]);
    }

    // Đọc tất cả các file trong thư mục output
    fs.readdir(OUTPUT_DIR, (err, files) => {
        if (err) {
            console.error("Error reading output directory:", err);
            return res.status(500).json({ error: 'Could not list files' });
        }

        // Lọc chỉ lấy các file video (ví dụ: .mp4)
        const videoFiles = files
            .filter(file => file.endsWith('.mp4'))
            .map(file => ({
                name: file,
                // Trả về URL tương đối mà frontend có thể dùng
                url: `/output/${file}` 
            }));
        
        res.json(videoFiles);
    });
});
app.post('/api/track', upload.single('video'), (req, res) => {
    if (!req.file) return res.status(400).send('No video uploaded.');

    const inputPath = req.file.path;
    const trackingClass = req.body.trackingClass;
    const confThreshold = req.body.confThreshold; 
    const occludeTime = req.body.occludeTime;

    const outputFilename = `tracked_${Date.now()}.mp4`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    
    if (!fs.existsSync(path.join(__dirname, 'output'))) {
        fs.mkdirSync(path.join(__dirname, 'output'));
    }

    const pythonProcess = spawn('python', [
        PYTHON_SCRIPT_PATH,
        inputPath, 
        outputPath, 
        confThreshold, 
        trackingClass, 
        occludeTime 
    ]);

    let pythonOutput = '';
    pythonProcess.stdout.on('data', (data) => {
        pythonOutput += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python Error: ${data.toString()}`);
    });

    pythonProcess.on('close', (code) => {
        if (code === 0) {
            res.json({
                success: true,
                videoUrl: `/output/${outputFilename}`
            });
        } else {
            res.status(500).json({ success: false, error: 'Tracking failed', details: pythonOutput });
        }
        fs.unlinkSync(inputPath);
    });
});

app.use('/output', express.static(OUTPUT_DIR)); 

app.listen(3000, () => console.log('Server running on port 3000'));