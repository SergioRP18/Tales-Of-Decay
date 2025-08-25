import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getFirestore, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { auth } from "../../services/firebaseConfig";

const COUNTDOWN_SECONDS = 10;

const WaitingScreen = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [isHost, setIsHost] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [count, setCount] = useState(COUNTDOWN_SECONDS);
    const [showPreview, setShowPreview] = useState(false);

    // Detecta si el usuario actual es el host y escucha el estado de la sala
    useEffect(() => {
        const db = getFirestore();
        const roomRef = doc(db, "rooms", roomId);
        const unsubscribe = onSnapshot(roomRef, (snap) => {
            const data = snap.data();
            if (!data) return;
            setGameStarted(!!data.gameStarted);

            // Busca si el usuario actual es el host
            const player = data.players?.find(p => p.uid === auth.currentUser.uid);
            setIsHost(player?.isHost || false);
        });
        return unsubscribe;
    }, [roomId]);

    // Cuenta regresiva cuando el juego inicia
    useEffect(() => {
        if (!gameStarted) return;
        if (count === 0) {
            setShowPreview(true);
            // Muestra la preview por 2 segundos antes de navegar
            const previewTimer = setTimeout(() => {
                navigate(`/game/${roomId}`);
            }, 2000);
            return () => clearTimeout(previewTimer);
        }
        const timer = setTimeout(() => setCount(count - 1), 1000);
        return () => clearTimeout(timer);
    }, [gameStarted, count, navigate]);

    // El host inicia el juego
    const handleStart = async () => {
        const db = getFirestore();
        const roomRef = doc(db, "rooms", roomId);
        await updateDoc(roomRef, { gameStarted: true });
    };

    if (showPreview) {
        return (
            <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                background: "#181818"
            }}>
                <span className="preview-message">
                    Debes ser rápido, tu vida depende de ello
                </span>
                <style>
                {`
                    .preview-message {
                        font-size: 2em;
                        color: #fff;
                        animation: zoomFade 2s forwards;
                    }
                    @keyframes zoomFade {
                        0% {
                            opacity: 0;
                            transform: scale(0.8);
                        }
                        20% {
                            opacity: 1;
                            transform: scale(1.1);
                        }
                        80% {
                            opacity: 1;
                            transform: scale(1.2);
                        }
                        100% {
                            opacity: 0;
                            transform: scale(1.4);
                        }
                    }
                `}
                </style>
            </div>
        );
    }

    if (gameStarted) {
        return (
            <div style={{ textAlign: "center", marginTop: "10vh" }}>
                <h2>¡El juego comenzará pronto!</h2>
                <h3>Comenzando en {count}...</h3>
            </div>
        );
    }

    return (
        <div style={{ textAlign: "center", marginTop: "10vh" }}>
            <h2>¡Sala creada!</h2>
            <p>Código de sala: <strong>{roomId}</strong></p>
            <p>Comparte este código con tus amigos para que se unan.</p>
            <p>Esperando jugadores...</p>
            {isHost && (
                <button onClick={handleStart}>Iniciar</button>
            )}
        </div>
    );
};

export default WaitingScreen;