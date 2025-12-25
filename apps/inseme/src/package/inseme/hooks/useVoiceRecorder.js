// src/package/inseme/hooks/useVoiceRecorder.js

import { useState, useRef, useCallback, useEffect } from 'react';

export function useVoiceRecorder(onTranscription) {
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const durationRef = useRef(0);
    const [timeLeft, setTimeLeft] = useState(30);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const isCancelledRef = useRef(false);

    const stopRecording = useCallback((cancelled = false) => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            isCancelledRef.current = cancelled;
            mediaRecorderRef.current.stop();
        }
        
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        
        setIsRecording(false);
    }, []);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];
            isCancelledRef.current = false;
            setDuration(0);
            durationRef.current = 0;
            setTimeLeft(30);

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const tracks = stream.getTracks();
                tracks.forEach(track => track.stop());

                if (!isCancelledRef.current && chunksRef.current.length > 0) {
                    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                    if (onTranscription) {
                        // Capture the final duration at the moment of stopping
                        onTranscription(blob, durationRef.current);
                    }
                }
            };

            mediaRecorder.start();
            setIsRecording(true);

            timerRef.current = setInterval(() => {
                setDuration(prev => {
                    const next = prev + 1;
                    durationRef.current = next;
                    return next;
                });
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        stopRecording(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

        } catch (err) {
            console.error("Erreur d'accès au microphone:", err);
            alert("Impossible d'accéder au microphone.");
        }
    }, [onTranscription, stopRecording]);

    const addTime = useCallback(() => {
        setTimeLeft(30);
    }, []);

    const cancelRecording = useCallback(() => {
        stopRecording(true);
    }, [stopRecording]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    return {
        isRecording,
        duration,
        timeLeft,
        startRecording,
        stopRecording: () => stopRecording(false),
        cancelRecording,
        addTime
    };
}
