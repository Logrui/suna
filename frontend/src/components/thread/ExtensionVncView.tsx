'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Monitor, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExtensionVncViewProps {
    browserId: string;
    className?: string;
    /** Callback for when new metadata (URL, Title) is received from the stream */
    onMetadata?: (metadata: { url?: string; title?: string }) => void;
    /** Callback for connection status changes */
    onConnectionChange?: (isConnected: boolean) => void;
    isLiveMode?: boolean;
}

export function ExtensionVncView({ browserId, className, onMetadata, onConnectionChange }: ExtensionVncViewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [fps, setFps] = useState(0);
    const [isUserControlled, setIsUserControlled] = useState(false);
    const frameCountRef = useRef(0);
    const lastFpsUpdateRef = useRef(Date.now());
    const wsRef = useRef<WebSocket | null>(null);

    // Interaction helper
    const sendInteraction = useCallback((type: string, data: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'interaction',
                params: {
                    type,
                    ...data
                }
            }));
        }
    }, []);

    // WebSocket Connection
    useEffect(() => {
        if (!browserId) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
        const host = backendUrl.replace(/^https?:\/\//, '') || window.location.host;
        const wsUrl = `${protocol}//${host}/ws/browser/${browserId}/stream`;

        console.log(`[ExtensionVncView] Connecting to ${wsUrl}`);

        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
            console.log('[ExtensionVncView] Connected');
            setIsConnected(true);
            onConnectionChange?.(true);
            setIsLoading(false);
            setError(null);
        };

        const pingInterval = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'ping' }));
            }
        }, 25000);

        const decoderRef = { current: null as VideoDecoder | null };

        socket.onmessage = async (event) => {
            try {
                const message = JSON.parse(event.data);

                if (message.type === 'video_frame') {
                    if (message.url || message.title) {
                        onMetadata?.({ url: message.url, title: message.title });
                    }

                    const base64Data = message.data;
                    const isKeyFrame = message.is_keyframe;
                    const timestamp = message.timestamp;

                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }

                    if (!decoderRef.current || (isKeyFrame && decoderRef.current.state === 'closed')) {
                        decoderRef.current = new VideoDecoder({
                            output: (frame) => {
                                const canvas = canvasRef.current;
                                if (canvas) {
                                    const ctx = canvas.getContext('2d');
                                    if (ctx) {
                                        if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
                                            canvas.width = frame.displayWidth;
                                            canvas.height = frame.displayHeight;
                                        }
                                        ctx.drawImage(frame, 0, 0);

                                        // Track Accurate FPS
                                        const now = Date.now();
                                        frameCountRef.current++;
                                        const delta = now - lastFpsUpdateRef.current;
                                        if (delta >= 1000) {
                                            const currentFps = Math.round((frameCountRef.current * 1000) / delta);
                                            setFps(currentFps);
                                            frameCountRef.current = 0;
                                            lastFpsUpdateRef.current = now;
                                        }
                                    }
                                }
                                frame.close();
                            },
                            error: (e) => {
                                console.error('[ExtensionVncView] VideoDecoder error:', e);
                            }
                        });

                        decoderRef.current.configure({
                            codec: 'avc1.42E01E',
                            optimizeForLatency: true
                        });
                    }

                    if (decoderRef.current.state === 'configured') {
                        const chunk = new EncodedVideoChunk({
                            type: isKeyFrame ? 'key' : 'delta',
                            timestamp: timestamp,
                            data: bytes
                        });
                        decoderRef.current.decode(chunk);
                    }

                    if (isLoading) setIsLoading(false);
                }
                else if (message.type === 'stream_chunk') {
                    if (message.url || message.title) {
                        onMetadata?.({ url: message.url, title: message.title });
                    }

                    if (message.screenshot_base64) {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = canvasRef.current;
                            if (canvas) {
                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                    if (canvas.width !== img.width || canvas.height !== img.height) {
                                        canvas.width = img.width;
                                        canvas.height = img.height;
                                    }
                                    ctx.drawImage(img, 0, 0);

                                    // Track Accurate FPS
                                    const now = Date.now();
                                    frameCountRef.current++;
                                    const delta = now - lastFpsUpdateRef.current;
                                    if (delta >= 1000) {
                                        const currentFps = Math.round((frameCountRef.current * 1000) / delta);
                                        setFps(currentFps);
                                        frameCountRef.current = 0;
                                        lastFpsUpdateRef.current = now;
                                    }
                                }
                            }
                            if (isLoading) setIsLoading(false);
                        };
                        img.src = `data:image/webp;base64,${message.screenshot_base64}`;
                    }
                }
                else if (message.type === 'takeover') {
                    console.log('[ExtensionVncView] User has taken control');
                    setIsUserControlled(true);
                }
                else if (message.type === 'resume') {
                    console.log('[ExtensionVncView] Control handed back to agent');
                    setIsUserControlled(false);
                }
            } catch (e) {
                console.error('[ExtensionVncView] Failed to parse message', e);
            }
        };

        socket.onclose = (event) => {
            setIsConnected(false);
            onConnectionChange?.(false);
            if (!event.wasClean) {
                setError('Lost connection to stream relay');
            }
        };

        socket.onerror = (e) => {
            console.error('[ExtensionVncView] Socket error', e);
            setError('Connection error occurred');
            setIsLoading(false);
        };

        return () => {
            clearInterval(pingInterval);
            socket.close();
            if (decoderRef.current && decoderRef.current.state !== 'closed') {
                decoderRef.current.close();
            }
        };
    }, [browserId, onMetadata, onConnectionChange]);

    // Coordinate scaling helper
    const getCoordinates = (e: React.MouseEvent | React.WheelEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: Math.round((e.clientX - rect.left) * scaleX),
            y: Math.round((e.clientY - rect.top) * scaleY)
        };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const { x, y } = getCoordinates(e);
        sendInteraction('mouse_move', { x, y });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        const { x, y } = getCoordinates(e);
        const button = e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle';
        sendInteraction('click', { x, y, button });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        sendInteraction('key_down', { key: e.key });
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(e.key)) {
            e.preventDefault();
        }
    };

    const handleKeyUp = (e: React.KeyboardEvent) => {
        sendInteraction('key_up', { key: e.key });
    };

    const handleWheel = (e: React.WheelEvent) => {
        sendInteraction('scroll', { deltaX: e.deltaX * 2, deltaY: e.deltaY * 2 });
    };

    return (
        <div
            className={cn(
                "relative w-full h-full bg-transparent flex flex-col items-center justify-center overflow-hidden rounded-xl border border-white/5 shadow-2xl",
                className
            )}
            ref={containerRef}
        >
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay z-0 bg-repeat"
                style={{
                    backgroundImage: "var(--noise-pattern)",
                    backgroundColor: 'rgba(255, 255, 255, 0.01)'
                }}
            />

            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center space-y-4 z-10"
                    >
                        <div className="relative">
                            <div className="absolute inset-0 blur-2xl bg-primary/20 rounded-full animate-pulse" />
                            <Loader2 className="w-10 h-10 animate-spin text-primary relative" />
                        </div>
                        <p className="text-sm font-medium tracking-tight text-white/70 animate-pulse">
                            Establishing Secure Stream...
                        </p>
                    </motion.div>
                ) : error ? (
                    <motion.div
                        key="error"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center space-y-4 p-8 text-center z-10"
                    >
                        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
                            <AlertCircle className="w-8 h-8 text-destructive" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Stream Failed</h3>
                            <p className="text-sm text-white/50 max-w-xs mx-auto mt-1">
                                {error}. Ensure your extension is connected and online.
                            </p>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors border border-white/10"
                        >
                            Retry Connection
                        </button>
                    </motion.div>
                ) : (
                    <motion.div
                        key="canvas"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="relative w-full h-full flex items-center justify-center"
                    >
                        <canvas
                            ref={canvasRef}
                            onMouseMove={handleMouseMove}
                            onMouseDown={handleMouseDown}
                            onKeyDown={handleKeyDown}
                            onKeyUp={handleKeyUp}
                            onWheel={handleWheel}
                            tabIndex={0}
                            className="max-w-full max-h-full object-contain cursor-none focus:outline-none shadow-2xl border border-white/5 active:border-primary/30 transition-colors"
                        />
                        <div className="absolute inset-0 pointer-events-none border border-white/5 rounded-lg overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="absolute top-4 right-4 flex items-center gap-3 z-20 pointer-events-none">
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 shadow-lg">
                    {isConnected ? (
                        <>
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Live</span>
                            <div className="w-px h-3 bg-white/10 mx-1" />
                            <span className="text-[10px] text-white/60 font-mono tracking-tighter uppercase">{fps} FPS</span>
                        </>
                    ) : (
                        <>
                            <div className="w-2 h-2 rounded-full bg-rose-500" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400">Offline</span>
                        </>
                    )}
                </div>
            </div>



            {!isConnected && !isLoading && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-10 flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center gap-2 text-white/40">
                        <WifiOff className="w-12 h-12" />
                        <span className="text-sm font-medium">Reconnecting...</span>
                    </div>
                </div>
            )}
        </div>
    );
}
