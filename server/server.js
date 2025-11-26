const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors'); 
const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(cors());

// Định nghĩa thư mục Output tuyệt đối ngay từ đầu
const OUTPUT_DIR = path.join(__dirname, 'output');

app.get('/api/videos', (req, res) => {

    console.log("--- DEBUG: API GET VIDEOS ---");
    console.log("Scanning Directory (OUTPUT_DIR): ", OUTPUT_DIR);

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
            .filter(file => file.endsWith('.mp4') || file.endsWith('.webm')) // Hỗ trợ cả webm
            .map(file => ({
                name: file,
                url: `/output/${file}` 
            }));
        
        res.json(videoFiles);
    });
});

app.post('/api/track', upload.single('video'), (req, res) => {
    if (!req.file) return res.status(400).send('No video uploaded.');

    // --- KHẮC PHỤC 1: Chuyển input thành đường dẫn TUYỆT ĐỐI ---
    // Để Python dù đứng ở đâu cũng tìm thấy file
    const inputPath = path.resolve(req.file.path); 

    const trackingClass = req.body.trackingClass;
    const confThreshold = req.body.confThreshold; 
    const occludeTime = req.body.occludeTime;

    // --- LƯU Ý: Nếu bạn dùng code Python sửa codec là 'mp4v' hay 'avc1' thì để đuôi .mp4
    // Nếu bạn dùng codec 'vp80' thì đổi thành .webm
    const outputFilename = `tracked_${Date.now()}.mp4`;
    
    // --- KHẮC PHỤC 2: Chuyển output thành đường dẫn TUYỆT ĐỐI ---
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    console.log("Processing Video...");
    console.log("Input:", inputPath);
    console.log("Output:", outputPath);

    // --- KHẮC PHỤC 3: Thiết lập thư mục làm việc (cwd) ---
    const pythonProcess = spawn('python', [
        'tracker.py', // Chỉ cần tên file vì cwd đã trỏ vào folder yolov9
        inputPath, 
        outputPath, 
        confThreshold, 
        trackingClass, 
        occludeTime 
    ], {
        // QUAN TRỌNG NHẤT: Bắt Python chạy từ trong thư mục yolov9
        // Điều này giúp nó tìm thấy file openh264.dll và các file model khác
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
        // Không cộng vào pythonOutput vì stderr thường chứa log tiến trình (tqdm)
    });

    pythonProcess.on('close', (code) => {
        console.log(`Child process exited with code ${code}`);
        
        // Xóa file upload tạm bất kể thành công hay thất bại
        if (fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
        }

        if (code === 0) {
            res.json({
                success: true,
                videoUrl: `/output/${outputFilename}`
            });
        } else {
            // Trả về lỗi chi tiết để hiển thị ở Frontend nếu cần
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