"use client";

import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { Button } from "@/shared/ui/button";

interface VideoPlayerProps {
    url: string;
    poster?: string;
    title?: string;
}

export function VideoPlayer({ url, poster, title = "Video walkthrough" }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            const current = video.currentTime;
            const duration = video.duration;
            if (duration > 0) {
                setProgress((current / duration) * 100);
            }
        };

        video.addEventListener("timeupdate", handleTimeUpdate);
        return () => video.removeEventListener("timeupdate", handleTimeUpdate);
    }, []);

    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            void video.play().catch(() => setIsPlaying(false));
        } else {
            video.pause();
        }
    };

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const toggleFullscreen = () => {
        if (containerRef.current) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                containerRef.current.requestFullscreen();
            }
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.currentTime = (value / 100) * videoRef.current.duration;
            setProgress(value);
        }
    };

    return (
        <div
            ref={containerRef}
            className="relative group bg-black rounded-xl overflow-hidden shadow-lg border border-border"
        >
            <video
                ref={videoRef}
                src={url}
                poster={poster}
                preload="metadata"
                playsInline
                aria-label={title}
                className="w-full h-auto max-h-[70vh] object-contain"
                onClick={togglePlay}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
            >
                Your browser does not support HTML5 video.
            </video>

            {/* Custom Controls (fade in on hover) */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300">

                {/* Progress Bar */}
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={progress}
                    onChange={handleSeek}
                    aria-label={`Seek ${title}`}
                    className="w-full h-1 mb-4 appearance-none bg-white/30 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
                />

                <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/20 hover:text-white"
                            onClick={togglePlay}
                            aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
                        >
                            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/20 hover:text-white"
                            onClick={toggleMute}
                            aria-label={isMuted ? `Unmute ${title}` : `Mute ${title}`}
                        >
                            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </Button>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20 hover:text-white"
                        onClick={toggleFullscreen}
                        aria-label={`View ${title} fullscreen`}
                    >
                        <Maximize className="w-5 h-5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
