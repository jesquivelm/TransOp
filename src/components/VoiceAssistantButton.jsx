import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { LoaderCircle, MessageSquare, Mic, MicOff, Sparkles, X, GripHorizontal } from 'lucide-react';
import { T } from '../theme';

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result);
    };
    reader.onerror = () => reject(new Error('No se pudo leer el audio grabado.'));
    reader.readAsDataURL(blob);
  });
}

export default function VoiceAssistantButton({ token, onInterpretation, sidebar }) {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Puedo ayudarte a crear una proforma o abrir un socio nuevo. Pulsa el micrófono y dime qué necesitas.',
    },
  ]);
  const [pos, setPos] = useState({ x: window.innerWidth - 420, y: 80 });
  const [drag, setDrag] = useState(null);

  const popoverRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const messagesRef = useRef(messages);
  const permissionRequestedRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const canRecord = useMemo(
    () => typeof window !== 'undefined' && Boolean(window.MediaRecorder) && Boolean(navigator?.mediaDevices?.getUserMedia),
    []
  );

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (event) => {
      if (sidebar && popoverRef.current && !popoverRef.current.contains(event.target)) {
        const btn = document.querySelector('[data-va-button]');
        if (btn && btn.contains(event.target)) return;
        closePopover();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, sidebar]);

  useEffect(() => {
    if (!open || permissionRequestedRef.current || !canRecord) return;
    permissionRequestedRef.current = true;
    ensureStream().catch(() => { permissionRequestedRef.current = false; });
  }, [canRecord, open]);

  useEffect(() => () => {
    streamRef.current?.getTracks?.().forEach(track => track.stop());
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!sidebar) return;
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    setPos(prev => ({
      x: clamp(prev.x, 10, window.innerWidth - 410),
      y: clamp(prev.y, 10, window.innerHeight - 360),
    }));
  }, [open, sidebar]);

  const onDragStart = useCallback((e) => {
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    if (clientX == null) return;
    setDrag({ startX: clientX, startY: clientY, originX: pos.x, originY: pos.y });
  }, [pos]);

  const onDragMove = useCallback((e) => {
    if (!drag) return;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    if (clientX == null) return;
    const dx = clientX - drag.startX;
    const dy = clientY - drag.startY;
    const nextX = Math.max(10, Math.min(window.innerWidth - 410, drag.originX + dx));
    const nextY = Math.max(10, Math.min(window.innerHeight - 360, drag.originY + dy));
    setPos({ x: nextX, y: nextY });
  }, [drag]);

  const onDragEnd = useCallback(() => {
    setDrag(null);
  }, []);

  useEffect(() => {
    if (!drag) return;
    const handleMouseMove = (e) => onDragMove(e);
    const handleMouseUp = () => onDragEnd();
    const handleTouchMove = (e) => onDragMove(e);
    const handleTouchEnd = () => onDragEnd();
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [drag, onDragMove, onDragEnd]);

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    setRecording(false);
  };

  const ensureStream = async () => {
    const currentStream = streamRef.current;
    const activeTrack = currentStream?.getAudioTracks?.().find(track => track.readyState === 'live');
    if (activeTrack) return currentStream;
    const nextStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = nextStream;
    return nextStream;
  };

  const startRecording = async () => {
    if (!canRecord || recording || processing) return;
    setError('');
    try {
      const stream = await ensureStream();
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : undefined,
      });
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        if (!audioBlob.size) { setError('No se capturó audio en la grabación.'); return; }
        if (audioBlob.size > 24 * 1024 * 1024) { setError('La grabacion es demasiado grande.'); return; }
        setProcessing(true);
        try {
          const audioBase64 = await toBase64(audioBlob);
          const conversationHistory = messagesRef.current.map(({ role, text }) => ({ role, text }));
          const res = await fetch('/api/tms/voice/interpret', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64, mimeType, conversationHistory }),
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok || !payload.success) throw new Error(payload.error || `Error ${res.status}`);
          const transcript = payload.transcript?.trim();
          const assistantMessage = payload.interpretation?.assistantMessage?.trim();
          setMessages(prev => {
            const next = [...prev];
            if (transcript) next.push({ role: 'user', text: transcript });
            if (assistantMessage) next.push({ role: 'assistant', text: assistantMessage });
            return next;
          });
          if (payload.interpretation) onInterpretation?.(payload.interpretation, transcript);
        } catch (requestError) {
          setError(requestError.message || 'No se pudo interpretar el audio.');
        } finally { setProcessing(false); }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (recordError) {
      setError(recordError.message || 'No se pudo activar el micrófono.');
      setRecording(false);
    }
  };

  const toggleRecording = () => {
    if (recording) { stopRecording(); return; }
    startRecording();
  };

  const closePopover = () => {
    setOpen(false);
    streamRef.current?.getTracks?.().forEach(track => track.stop());
    streamRef.current = null;
    permissionRequestedRef.current = false;
  };

  const boxShadow = sidebar
    ? '0 24px 80px rgba(15,23,42,0.35)'
    : '0 24px 80px rgba(15,23,42,0.28)';

  return (
    <div style={{ position: sidebar ? 'static' : 'relative' }}>
      <button
        ref={ref => { if (ref) ref.dataset.vaButton = 'true'; }}
        type="button"
        data-va-button
        onClick={() => {
          if (open) { closePopover(); return; }
          setOpen(true);
          if (sidebar) {
            setPos({ x: Math.min(window.innerWidth - 420, 20), y: 80 });
          }
        }}
        style={{
          width: sidebar ? 36 : 42,
          height: sidebar ? 36 : 42,
          borderRadius: 10,
          border: `1px solid ${recording ? `${T.RED}55` : `${T.AMB}44`}`,
          background: recording ? T.redDim : `linear-gradient(135deg, ${T.ambDim}, ${T.card2})`,
          color: recording ? T.RED : T.AMB,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: recording ? '0 0 0 4px rgba(239,68,68,0.12)' : '0 10px 30px rgba(15,23,42,0.12)',
          flex: 1,
          maxWidth: 48,
        }}
        title="Asistente por voz"
      >
        {recording ? <MicOff size={15} /> : <Mic size={15} />}
      </button>

      {open && sidebar ? (
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            width: 380,
            maxWidth: 'calc(100vw - 48px)',
            background: T.card,
            border: `1px solid ${T.bdr}`,
            borderRadius: 18,
            boxShadow,
            overflow: 'hidden',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              padding: '12px 18px',
              background: `linear-gradient(135deg, ${T.card2}, ${T.ambDim})`,
              borderBottom: `1px solid ${T.bdr}`,
              cursor: drag ? 'grabbing' : 'grab',
              userSelect: 'none',
            }}
            onMouseDown={onDragStart}
            onTouchStart={onDragStart}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <GripHorizontal size={14} color={T.mute} />
                <Sparkles size={15} color={T.AMB} />
                <span style={{ fontSize: 13, fontWeight: 800, color: T.txt }}>Asistente TransOP</span>
              </div>
              <button type="button" onClick={closePopover}
                style={{ background: 'transparent', border: 'none', color: T.mute, cursor: 'pointer', padding: 0 }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ fontSize: 11, color: T.mute, marginTop: 4, marginLeft: 22 }}>
              Arrástrame desde aquí
            </div>
          </div>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
              {messages.map((msg, i) => {
                const isAssistant = msg.role === 'assistant';
                return (
                  <div key={`${msg.role}-${i}`} style={{
                    alignSelf: isAssistant ? 'stretch' : 'flex-end',
                    background: isAssistant ? T.card2 : T.ambDim,
                    color: isAssistant ? T.sub : T.txt,
                    border: `1px solid ${isAssistant ? T.bdr : `${T.AMB}33`}`,
                    borderRadius: 14, padding: '10px 12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      {isAssistant ? <MessageSquare size={12} color={T.AMB} /> : <Mic size={12} color={T.sub} />}
                      <span style={{ fontSize: 11, fontWeight: 700, color: isAssistant ? T.AMB : T.mute }}>
                        {isAssistant ? 'ASISTENTE' : 'TÚ'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.55 }}>{msg.text}</div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div style={{ padding: '10px 12px', borderRadius: 12, background: T.redDim, color: T.RED, fontSize: 12 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={toggleRecording} disabled={!canRecord || processing}
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: 12, border: 'none',
                  background: recording ? T.RED : T.AMB,
                  color: recording ? '#fff' : '#000',
                  cursor: processing ? 'wait' : 'pointer',
                  fontSize: 13, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: !canRecord ? 0.6 : 1,
                }}>
                {processing ? <LoaderCircle size={16} style={{ animation: 'spin 0.9s linear infinite' }} />
                  : recording ? <MicOff size={16} /> : <Mic size={16} />}
                {processing ? 'Interpretando...' : recording ? 'Detener grabación' : 'Hablar ahora'}
              </button>
            </div>

            {!canRecord && (
              <div style={{ fontSize: 12, color: T.mute, lineHeight: 1.5 }}>
                Este navegador no expone `MediaRecorder`.
              </div>
            )}
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : open && !sidebar ? (
        <div
          style={{
            position: 'absolute',
            top: 52,
            right: 0,
            width: 380,
            maxWidth: 'calc(100vw - 48px)',
            background: T.card,
            border: `1px solid ${T.bdr}`,
            borderRadius: 18,
            boxShadow,
            overflow: 'hidden',
            zIndex: 60,
          }}
        >
          <div style={{
            padding: 18, background: `linear-gradient(135deg, ${T.card2}, ${T.ambDim})`,
            borderBottom: `1px solid ${T.bdr}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={15} color={T.AMB} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: T.txt }}>Asistente TransOP</span>
                </div>
                <div style={{ fontSize: 12, color: T.sub, marginTop: 6, lineHeight: 1.5 }}>
                  Te escucho desde cualquier pantalla.
                </div>
              </div>
              <button type="button" onClick={closePopover}
                style={{ background: 'transparent', border: 'none', color: T.mute, cursor: 'pointer', padding: 0 }}>
                <X size={16} />
              </button>
            </div>
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
              {messages.map((msg, i) => {
                const isAssistant = msg.role === 'assistant';
                return (
                  <div key={`${msg.role}-${i}`} style={{
                    alignSelf: isAssistant ? 'stretch' : 'flex-end',
                    background: isAssistant ? T.card2 : T.ambDim,
                    color: isAssistant ? T.sub : T.txt,
                    border: `1px solid ${isAssistant ? T.bdr : `${T.AMB}33`}`,
                    borderRadius: 14, padding: '10px 12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      {isAssistant ? <MessageSquare size={12} color={T.AMB} /> : <Mic size={12} color={T.sub} />}
                      <span style={{ fontSize: 11, fontWeight: 700, color: isAssistant ? T.AMB : T.mute }}>
                        {isAssistant ? 'ASISTENTE' : 'TÚ'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.55 }}>{msg.text}</div>
                  </div>
                );
              })}
            </div>
            {error && (
              <div style={{ padding: '10px 12px', borderRadius: 12, background: T.redDim, color: T.RED, fontSize: 12 }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={toggleRecording} disabled={!canRecord || processing}
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: 12, border: 'none',
                  background: recording ? T.RED : T.AMB,
                  color: recording ? '#fff' : '#000',
                  cursor: processing ? 'wait' : 'pointer',
                  fontSize: 13, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: !canRecord ? 0.6 : 1,
                }}>
                {processing ? <LoaderCircle size={16} style={{ animation: 'spin 0.9s linear infinite' }} />
                  : recording ? <MicOff size={16} /> : <Mic size={16} />}
                {processing ? 'Interpretando...' : recording ? 'Detener grabación' : 'Hablar ahora'}
              </button>
            </div>
            {!canRecord && (
              <div style={{ fontSize: 12, color: T.mute, lineHeight: 1.5 }}>
                Este navegador no expone `MediaRecorder`.
              </div>
            )}
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : null}
    </div>
  );
}
