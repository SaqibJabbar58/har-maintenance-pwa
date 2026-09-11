import { useRef, useState, useCallback } from 'react'

// MediaRecorder-based voice note recorder (Step 4)
// Returns: { isRecording, seconds, audioBlob, start, stop, reset }
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [audioBlob, setAudioBlob] = useState(null)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const streamRef = useRef(null)

  const start = useCallback(async () => {
    setAudioBlob(null)
    chunksRef.current = []

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream

    const mimeType = MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/mp4'
    const recorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      setAudioBlob(blob)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }

    recorder.start()
    setIsRecording(true)
    setSeconds(0)
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
  }, [])

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop()
    clearInterval(timerRef.current)
    setIsRecording(false)
  }, [])

  const reset = useCallback(() => {
    setAudioBlob(null)
    setSeconds(0)
  }, [])

  return { isRecording, seconds, audioBlob, start, stop, reset }
}
