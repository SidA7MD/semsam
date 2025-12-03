import { DoorOpen, Key, Mic, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// ==========================================
// COMPOSANT PRINCIPAL : VoiceAuth
// ==========================================
const VoiceAuth = () => {
  const [mode, setMode] = useState('welcome'); // welcome, register, login
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [pattern, setPattern] = useState(null);
  const [currentPattern, setCurrentPattern] = useState(null);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const recordingDataRef = useRef([]);

  // Charger le pattern sauvegardé au démarrage
  useEffect(() => {
    const saved = localStorage.getItem('voicePattern');
    if (saved) {
      setPattern(JSON.parse(saved));
    }
  }, []);

  // ==========================================
  // FONCTION : Démarrer l'enregistrement vocal
  // ==========================================
  const startRecording = async () => {
    try {
      setStatus('🎤 Prononcez votre phrase magique...');
      recordingDataRef.current = [];

      // Demander l'accès au micro
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // Créer le contexte audio
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);

      // Créer l'analyseur
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);

      setIsRecording(true);

      // Démarrer l'analyse en temps réel
      analyzeAudio();

      // Arrêter automatiquement après 5 secondes
      setTimeout(() => {
        if (isRecording) {
          stopRecording();
        }
      }, 5000);

    } catch (err) {
      setStatus('❌ Erreur : accès au micro refusé');
      console.error(err);
    }
  };

  // ==========================================
  // FONCTION : Analyser l'audio en temps réel
  // ==========================================
  const analyzeAudio = () => {
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const analyze = () => {
      analyserRef.current.getByteTimeDomainData(dataArray);

      // Calculer le volume (RMS)
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const volume = Math.sqrt(sum / bufferLength);

      // Enregistrer les données
      recordingDataRef.current.push({
        time: Date.now(),
        volume: volume,
        peak: Math.max(...dataArray)
      });

      animationFrameRef.current = requestAnimationFrame(analyze);
    };

    analyze();
  };

  // ==========================================
  // FONCTION : Arrêter l'enregistrement
  // ==========================================
  const stopRecording = () => {
    setIsRecording(false);

    // Arrêter l'analyse
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Fermer le micro
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Fermer le contexte audio
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    // Traiter les données enregistrées
    processRecording();
  };

  // ==========================================
  // FONCTION : Créer le pattern vocal
  // ==========================================
  const processRecording = () => {
    const data = recordingDataRef.current;

    if (data.length < 10) {
      setStatus('❌ Enregistrement trop court. Réessayez !');
      return;
    }

    // Filtrer le silence (seuil minimal)
    const activeData = data.filter(d => d.volume > 0.01);

    if (activeData.length < 5) {
      setStatus('❌ Aucun son détecté. Parlez plus fort !');
      return;
    }

    // Créer le pattern simplifié
    const voicePattern = {
      duration: activeData.length,
      avgVolume: activeData.reduce((sum, d) => sum + d.volume, 0) / activeData.length,
      maxVolume: Math.max(...activeData.map(d => d.volume)),
      rhythm: calculateRhythm(activeData),
      peaks: countPeaks(activeData)
    };

    setCurrentPattern(voicePattern);

    if (mode === 'register') {
      // Enregistrer le pattern
      localStorage.setItem('voicePattern', JSON.stringify(voicePattern));
      setPattern(voicePattern);
      setStatus('✅ Pattern vocal enregistré !');
      setTimeout(() => {
        setMode('welcome');
        setStatus('');
      }, 2000);
    } else if (mode === 'login') {
      // Vérifier le pattern
      verifyPattern(voicePattern);
    }
  };

  // ==========================================
  // FONCTION : Calculer le rythme
  // ==========================================
  const calculateRhythm = (data) => {
    const changes = [];
    for (let i = 1; i < data.length; i++) {
      changes.push(Math.abs(data[i].volume - data[i - 1].volume));
    }
    return changes.reduce((sum, c) => sum + c, 0) / changes.length;
  };

  // ==========================================
  // FONCTION : Compter les pics vocaux
  // ==========================================
  const countPeaks = (data) => {
    let peaks = 0;
    const threshold = 0.1;
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i].volume > threshold &&
        data[i].volume > data[i - 1].volume &&
        data[i].volume > data[i + 1].volume) {
        peaks++;
      }
    }
    return peaks;
  };

  // ==========================================
  // FONCTION : Vérifier le pattern vocal
  // ==========================================
  const verifyPattern = (newPattern) => {
    if (!pattern) {
      setStatus('❌ Aucun pattern enregistré');
      return;
    }

    // Calculer la similarité (tolérance : 30%)
    const durationMatch = Math.abs(newPattern.duration - pattern.duration) / pattern.duration < 0.3;
    const volumeMatch = Math.abs(newPattern.avgVolume - pattern.avgVolume) / pattern.avgVolume < 0.3;
    const rhythmMatch = Math.abs(newPattern.rhythm - pattern.rhythm) / pattern.rhythm < 0.4;
    const peaksMatch = Math.abs(newPattern.peaks - pattern.peaks) <= 2;

    const score = [durationMatch, volumeMatch, rhythmMatch, peaksMatch].filter(Boolean).length;

    if (score >= 3) {
      setStatus('✨ SÉSAME OUVRE-TOI ! ✨');
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setMode('welcome');
        setStatus('');
      }, 3000);
    } else {
      setStatus('❌ Pattern incorrect. Ali te reconnaît pas !');
      setTimeout(() => setStatus(''), 2000);
    }
  };

  // ==========================================
  // FONCTION : Réinitialiser le pattern
  // ==========================================
  const resetPattern = () => {
    localStorage.removeItem('voicePattern');
    setPattern(null);
    setStatus('Pattern supprimé');
    setTimeout(() => setStatus(''), 1500);
  };

  // ==========================================
  // RENDU : Interface
  // ==========================================
  return (
    <div className="container">
      {/* Animation de succès */}
      {showSuccess && (
        <div className="success-overlay">
          <div className="door-animation">
            <DoorOpen size={120} className="door-icon" />
            <div className="particles">
              {[...Array(20)].map((_, i) => (
                <Sparkles key={i} className="particle" style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.5}s`
                }} />
              ))}
            </div>
          </div>
          <h1 className="success-text">🎉 Bienvenue, ô voyageur ! 🎉</h1>
        </div>
      )}

      {/* En-tête */}
      <header className="header">
        <div className="logo">
          <Key size={40} className="key-icon" />
          <h1>Sésame Sonore</h1>
        </div>
        <p className="subtitle">Authentification vocale des Mille et Une Nuits</p>
      </header>

      {/* Contenu principal */}
      <main className="main-content">
        {mode === 'welcome' && (
          <div className="welcome-screen">
            <div className="lamp-container">
              <div className="lamp">✨</div>
            </div>
            <h2>Choisissez votre destinée</h2>
            <div className="button-group">
              <button
                onClick={() => setMode('register')}
                className="btn btn-primary"
                disabled={pattern}
              >
                <Mic size={20} />
                Enregistrer ma voix
              </button>
              <button
                onClick={() => setMode('login')}
                className="btn btn-secondary"
                disabled={!pattern}
              >
                <DoorOpen size={20} />
                Ouvrir le Sésame
              </button>
            </div>
            {pattern && (
              <button onClick={resetPattern} className="btn-reset">
                Réinitialiser le pattern
              </button>
            )}
            <div className="info-box">
              <p><strong>Phrases magiques suggérées :</strong></p>
              <p>• "Sésame ouvre-toi !"</p>
              <p>• "Ali, laisse-moi entrer !"</p>
              <p>• "Je suis le 41e voleur !"</p>
              <p>• "Abracadabraaa !"</p>
            </div>
          </div>
        )}

        {(mode === 'register' || mode === 'login') && (
          <div className="recording-screen">
            <h2>{mode === 'register' ? '📝 Enregistrement' : '🔐 Connexion'}</h2>
            <div className="mic-container">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`mic-button ${isRecording ? 'recording' : ''}`}
              >
                <Mic size={60} />
              </button>
              {isRecording && <div className="pulse-ring"></div>}
            </div>
            <p className="instruction">
              {isRecording ? 'Parlez maintenant...' : 'Cliquez sur le micro'}
            </p>
            {status && <p className={`status ${status.includes('❌') ? 'error' : 'success'}`}>{status}</p>}
            <button onClick={() => setMode('welcome')} className="btn-back">
              ← Retour
            </button>
          </div>
        )}
      </main>

      {/* Pied de page */}
      <footer className="footer">
        <p>🌙 Créé avec la magie de React et Web Audio API 🌙</p>
      </footer>

      {/* Styles CSS */}
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Georgia', serif;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          color: #f0e6d2;
          min-height: 100vh;
        }

        .container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .header {
          text-align: center;
          padding: 2rem;
          background: rgba(0, 0, 0, 0.3);
          border-bottom: 2px solid #d4af37;
        }

        .logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }

        .key-icon {
          color: #ffd700;
          animation: rotate 3s infinite;
        }

        @keyframes rotate {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(15deg); }
        }

        h1 {
          font-size: 2.5rem;
          color: #ffd700;
          text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
        }

        .subtitle {
          color: #d4af37;
          font-style: italic;
          font-size: 1.1rem;
        }

        .main-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .welcome-screen, .recording-screen {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 2px solid #d4af37;
          border-radius: 20px;
          padding: 3rem;
          max-width: 600px;
          width: 100%;
          box-shadow: 0 10px 40px rgba(212, 175, 55, 0.3);
        }

        .lamp-container {
          display: flex;
          justify-content: center;
          margin-bottom: 2rem;
        }

        .lamp {
          font-size: 4rem;
          animation: glow 2s infinite;
        }

        @keyframes glow {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        h2 {
          text-align: center;
          color: #ffd700;
          margin-bottom: 2rem;
          font-size: 1.8rem;
        }

        .button-group {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1rem 2rem;
          font-size: 1.1rem;
          font-family: 'Georgia', serif;
          border: 2px solid;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.3s;
          font-weight: bold;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: linear-gradient(135deg, #d4af37 0%, #ffd700 100%);
          border-color: #ffd700;
          color: #1a1a2e;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 5px 20px rgba(255, 215, 0, 0.5);
        }

        .btn-secondary {
          background: linear-gradient(135deg, #0f3460 0%, #16213e 100%);
          border-color: #d4af37;
          color: #ffd700;
        }

        .btn-secondary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 5px 20px rgba(212, 175, 55, 0.5);
        }

        .btn-reset {
          display: block;
          margin: 1rem auto;
          padding: 0.5rem 1rem;
          background: rgba(255, 0, 0, 0.2);
          border: 1px solid #ff6b6b;
          color: #ff6b6b;
          border-radius: 5px;
          cursor: pointer;
          font-family: 'Georgia', serif;
          transition: all 0.3s;
        }

        .btn-reset:hover {
          background: rgba(255, 0, 0, 0.3);
        }

        .info-box {
          background: rgba(212, 175, 55, 0.1);
          border: 1px solid #d4af37;
          border-radius: 10px;
          padding: 1.5rem;
          margin-top: 1.5rem;
        }

        .info-box p {
          margin: 0.5rem 0;
          font-size: 0.95rem;
        }

        .mic-container {
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          margin: 2rem 0;
        }

        .mic-button {
          width: 150px;
          height: 150px;
          border-radius: 50%;
          background: linear-gradient(135deg, #d4af37 0%, #ffd700 100%);
          border: 4px solid #ffd700;
          color: #1a1a2e;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 2;
        }

        .mic-button:hover {
          transform: scale(1.05);
          box-shadow: 0 5px 30px rgba(255, 215, 0, 0.6);
        }

        .mic-button.recording {
          animation: pulse 1s infinite;
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
          border-color: #ff6b6b;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .pulse-ring {
          position: absolute;
          width: 150px;
          height: 150px;
          border-radius: 50%;
          border: 4px solid #ff6b6b;
          animation: ring 1.5s infinite;
        }

        @keyframes ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }

        .instruction {
          text-align: center;
          font-size: 1.2rem;
          color: #d4af37;
          margin: 1rem 0;
        }

        .status {
          text-align: center;
          font-size: 1.1rem;
          font-weight: bold;
          margin: 1rem 0;
          padding: 1rem;
          border-radius: 10px;
        }

        .status.success {
          background: rgba(0, 255, 0, 0.1);
          color: #4ade80;
        }

        .status.error {
          background: rgba(255, 0, 0, 0.1);
          color: #ff6b6b;
        }

        .btn-back {
          display: block;
          margin: 2rem auto 0;
          padding: 0.7rem 1.5rem;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid #d4af37;
          color: #d4af37;
          border-radius: 8px;
          cursor: pointer;
          font-family: 'Georgia', serif;
          transition: all 0.3s;
        }

        .btn-back:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .success-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.5s;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .door-animation {
          position: relative;
          margin-bottom: 2rem;
        }

        .door-icon {
          color: #ffd700;
          animation: doorOpen 1s ease-out;
        }

        @keyframes doorOpen {
          0% { transform: scale(0) rotate(-180deg); }
          60% { transform: scale(1.2) rotate(10deg); }
          100% { transform: scale(1) rotate(0deg); }
        }

        .particles {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 300px;
          height: 300px;
        }

        .particle {
          position: absolute;
          color: #ffd700;
          animation: float 2s infinite;
        }

        @keyframes float {
          0% { transform: translateY(0) scale(0); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(-100px) scale(1.5); opacity: 0; }
        }

        .success-text {
          font-size: 2.5rem;
          color: #ffd700;
          text-align: center;
          animation: bounce 1s;
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }

        .footer {
          text-align: center;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.3);
          border-top: 1px solid #d4af37;
          color: #d4af37;
          font-size: 0.9rem;
        }

        @media (max-width: 768px) {
          h1 { font-size: 2rem; }
          .welcome-screen, .recording-screen { padding: 2rem; }
          .mic-button { width: 120px; height: 120px; }
        }
      `}</style>
    </div>
  );
};

export default VoiceAuth;
