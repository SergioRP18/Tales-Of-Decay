import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
    getFirestore, 
    doc, 
    onSnapshot, 
    updateDoc, 
    collection,  // ← ESTE IMPORT FALTABA
    where, 
    query 
} from "firebase/firestore";
import { auth } from "../../services/firebaseConfig";
import "./WaitingScreen.css"

const COUNTDOWN_SECONDS = 10;

const WaitingScreen = ({ sessionId }) => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [isHost, setIsHost] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [count, setCount] = useState(COUNTDOWN_SECONDS);
    const [showPreview, setShowPreview] = useState(false);
    const [players, setPlayers] = useState([]); // ← ESTE STATE FALTABA

    // Escucha los jugadores en tiempo real
    useEffect(() => {
        const db = getFirestore();
        
        // Crear query con where clause
        const playersQuery = query(
            collection(db, 'players'), 
            where('sessionId', '==', sessionId || roomId)
        );
        
        const unsubscribe = onSnapshot(playersQuery, (snapshot) => {
            const playersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPlayers(playersData);
        });
        
        return () => unsubscribe();
    }, [sessionId, roomId]);

    // Detecta si el usuario actual es el host y escucha el estado de la sala
    useEffect(() => {
  const db = getFirestore();
  const roomRef = doc(db, "rooms", roomId);

  const unsubscribe = onSnapshot(roomRef, (snap) => {
    const data = snap.data();
    if (!data) return;

    // aquí están los jugadores
    setPlayers(data.players || []);

    setGameStarted(!!data.gameStarted);

    // Busca si el usuario actual es host
    const player = data.players?.find(p => p.uid === auth.currentUser?.uid);
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
    }, [gameStarted, count, navigate, roomId]);

    // El host inicia el juego
    const handleStart = async () => {
        try {
            const db = getFirestore();
            const roomRef = doc(db, "rooms", roomId);
            await updateDoc(roomRef, { gameStarted: true });
        } catch (error) {
            console.error("Error starting game:", error);
        }
    };

    if (showPreview) {
        return (
            <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
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

            
            <div className="loading"> 
                <h2>¡El juego comenzará pronto!</h2>
                <h3 style={{ fontSize: "2em", color: "#ff4444" }}>
                    Comenzando en {count}...
                </h3>
            </div>
        );
    }

    return (
        <div  className="generalWaitingScreen">
            <h2>¡Sala creada!</h2>
            <p>Código de sala: <strong>{roomId}</strong></p>
            <p>Comparte este código con tus amigos para que se unan.</p>
            
            {/* Lista de jugadores */}
            <div style={{ 
                maxWidth: "600px", 
                margin: "30px auto",
                borderRadius: "10px",
                padding: "20px"
            }}>
                <h3 style={{ color: "#ff4444" }}>
                    Supervivientes Unidos ({players.length})
                </h3>
                
                {players.length === 0 ? (
                    <p style={{ color: "#888", fontStyle: "italic" }}>
                        Esperando que lleguen supervivientes...
                    </p>
                ) : (
                    <div style={{ marginTop: "20px" }}>
                        {players.map((player, index) => (
                            <div 
                                key={player.id || index}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "10px 15px",
                                    margin: "10px 0",
                                    backgroundColor: "#3a3a3a",
                                    borderRadius: "8px",
                                    borderLeft: player.isHost ? "4px solid #ffd700" : "4px solid #666"
                                }}
                            >
                                <div>
                                    <strong>{player.username || `Jugador ${index + 1}`}</strong>
                                    {player.isHost && (
                                        <span style={{ 
                                            color: "#ffd700", 
                                            marginLeft: "8px",
                                            fontSize: "12px"
                                        }}>
                                            👑 HOST
                                        </span>
                                    )}
                                </div>
                                <div style={{
                                    color: player.isReady ? "#4ade80" : "#fbbf24",
                                    fontSize: "14px",
                                    fontWeight: "bold"
                                }}>
                                    {player.isReady ? " Listo" : " Esperando"}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Información del estado */}
            <div style={{ margin: "20px 0", color: "#888" }}>
                <p>Jugadores conectados: {players.length}</p>
                <p>Listos: {players.filter(p => p.isReady).length}</p>
            </div>

            {isHost && (
                <button 
                    onClick={handleStart}
                    style={{
                        backgroundColor: "#ff4444",
                        color: "white",
                        border: "none",
                        padding: "15px 30px",
                        fontSize: "18px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        marginTop: "20px"
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = "#cc3333"}
                    onMouseOut={(e) => e.target.style.backgroundColor = "#ff4444"}
                >
                    Iniciar
                </button>
            )}
        </div>
    );
};

export default WaitingScreen;