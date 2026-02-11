/**
 * Kortix Offscreen Document
 * 
 * Handles high-performance video encoding using WebCodecs.
 */

console.log('[Kortix Offscreen] Document loaded');

let encoder: VideoEncoder | null = null;
let stream: MediaStream | null = null;
let reader: ReadableStreamDefaultReader<VideoFrame> | null = null;
let frameCount = 0;
let currentUrl = '';
let currentTitle = '';

// Handle messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_STREAMING') {
        console.log('[Kortix Offscreen] Starting stream with ID:', message.streamId);
        currentUrl = message.url || '';
        currentTitle = message.title || '';
        startCapture(message.streamId);
        sendResponse({ success: true });
    }

    if (message.type === 'UPDATE_METADATA') {
        currentUrl = message.url || currentUrl;
        currentTitle = message.title || currentTitle;
        sendResponse({ success: true });
    }

    if (message.type === 'STOP_STREAMING') {
        stopCapture();
        sendResponse({ success: true });
    }
    return true;
});

async function startCapture(streamId: string) {
    try {
        // Clean up previous stream if any
        stopCapture();

        stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId,
                    maxWidth: 1440,
                    maxHeight: 900,
                    maxFrameRate: 30
                }
            } as any
        });

        const videoTrack = stream.getVideoTracks()[0];
        console.log('[Kortix Offscreen] MediaStream obtained:', videoTrack.label);

        // Initialize Encoder
        setupEncoder();

        // Process frames
        const processor = new (window as any).MediaStreamTrackProcessor({ track: videoTrack });
        reader = processor.readable.getReader();

        readFrames();

    } catch (error) {
        console.error('[Kortix Offscreen] Failed to start capture:', error);
    }
}

function setupEncoder() {
    encoder = new VideoEncoder({
        output: (chunk, metadata) => {
            handleEncodedChunk(chunk, metadata);
        },
        error: (e) => {
            console.error('[Kortix Offscreen] VideoEncoder error:', e);
        }
    });

    const config: VideoEncoderConfig = {
        codec: 'avc1.42E01E', // Baseline profile for low latency
        width: 1440, // Match debugger
        height: 900, // Match debugger
        bitrate: 2_000_000, // 2 Mbps
        framerate: 30,
        latencyMode: 'realtime',
        avc: { format: 'annexb' } // Use Annex B for easier relaying to MediaSource
    };

    encoder.configure(config);
}

async function readFrames() {
    if (!reader || !encoder) return;

    try {
        while (true) {
            const { done, value: frame } = await reader.read();
            if (done) break;

            if (encoder.encodeQueueSize > 5) {
                // Too many frames in flight, drop this one to keep latency low
                frame.close();
                continue;
            }

            // Encode the frame
            // Force a keyframe every 60 frames (2 seconds at 30fps)
            const keyFrame = (frameCount % 60 === 0);
            encoder.encode(frame, { keyFrame });
            frame.close();
            frameCount++;
        }
    } catch (e) {
        console.error('[Kortix Offscreen] Error reading frames:', e);
    }
}

function handleEncodedChunk(chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) {
    const buffer = new Uint8Array(chunk.byteLength);
    chunk.copyTo(buffer);

    // Forward binary data to background
    const message: any = {
        type: 'VIDEO_CHUNK',
        data: buffer.buffer, // Send ArrayBuffer
        isKeyFrame: chunk.type === 'key',
        timestamp: chunk.timestamp,
        metadata: metadata
    };

    // Include tab metadata on keyframes to keep frontend UI in sync
    if (chunk.type === 'key' && stream) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
            // We can't get URL/Title directly from MediaStreamTrack,
            // but we can pass them from the START_STREAMING message if we store them.
            // For now, background script will attach them when relaying if needed,
            // or we can just send them every N frames.
            message.url = currentUrl;
            message.title = currentTitle;
        }
    }

    chrome.runtime.sendMessage(message);
}

function stopCapture() {
    if (reader) {
        reader.cancel();
        reader = null;
    }

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }

    if (encoder) {
        if (encoder.state !== 'closed') {
            encoder.close();
        }
        encoder = null;
    }

    frameCount = 0;
    console.log('[Kortix Offscreen] Capture stopped');
}
