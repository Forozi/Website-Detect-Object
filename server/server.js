const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors'); 
const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(cors());

const OUTPUT_DIR = path.join(__dirname, 'output');

app.get('/api/videos', (req, res) => {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        return res.json([]);
    }

    fs.readdir(OUTPUT_DIR, (err, files) => {
        if (err) {
            console.error("Error reading output directory:", err);
            return res.status(500).json({ error: 'Could not list files' });
        }

        const videoFiles = files
            .filter(file => file.endsWith('.mp4') || file.endsWith('.webm'))
            .map(file => ({
                name: file,
                url: `/output/${file}` 
            }));
        
        res.json(videoFiles);
    });
});

app.post('/api/track', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No video uploaded.');  
    } 

    const inputPath = path.resolve(req.file.path);   

    const originalName = req.file.originalname; 
    const confThreshold = req.body.confThreshold;
    const occludeTime = req.body.occludeTime;
    // const trackingClass = req.body.trackingClass;

    const vehicleType = req.body.vehicleType; // Ví dụ: 'ambulance', 'car', 'bus'

    // 1. Lấy tên file gốc và bỏ đuôi .mp4
    // originalName = "snowy (2).mp4" -> nameWithoutExt = "snowy (2)"
    const nameWithoutExt = path.parse(originalName).name; 

    const modelName = vehicleType === 'ambulance' ? 'yolov9-custom' : 'yolov9-t';

    // 2. Tạo tên file output theo format: "TênVideo_Model_Confidence_Occlusion.mp4"
    const outputFilename = `${nameWithoutExt}_${modelName}_CONF=${confThreshold}_OCCL=${occludeTime}.mp4`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    console.log("Processing Video...");
    console.log("Input:", inputPath);
    console.log("Output:", outputPath);

    const pythonProcess = spawn('python', [
        'tracker.py',
        inputPath, 
        outputPath, 
        confThreshold, 
        vehicleType, 
        occludeTime 
    ], {
        cwd: path.join(__dirname, 'yolov9') 
    });

    let pythonOutput = '';
    pythonProcess.stdout.on('data', (data) => {
        const str = data.toString();
        pythonOutput += str;
        console.log(`Python Log: ${str}`); // In log ra terminal để debug
    });

    pythonProcess.stderr.on('data', (data) => {
        const str = data.toString();
        console.error(`Python Error: ${str}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`Child process exited with code ${code}`);
        
        if (fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
        }

        if (code === 0) {
            res.json({
                success: true,
                videoUrl: `/output/${outputFilename}`
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Tracking process failed.', 
                details: pythonOutput 
            });
        }
    });
});

app.use('/output', express.static(OUTPUT_DIR)); 

app.listen(3000, () => console.log('Server running on port 3000'));