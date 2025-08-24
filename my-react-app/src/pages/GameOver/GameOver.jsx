import { useLocation, useNavigate } from "react-router-dom";

const GameOverScreen = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Se espera que la razón llegue por state: { reason: "no-selection" | "wrong-answer" }
    const reason = location.state?.reason;

    let message = "¡Juego terminado!";
    if (reason === "no-selection") {
        message = "Perdiste porque no seleccionaste ninguna opción a tiempo.";
    } else if (reason === "wrong-answer") {
        message = "Perdiste porque seleccionaste una opción incorrecta.";
    }

    return (
        <div style={{ textAlign: "center", marginTop: "10vh" }}>
            <h1>Game Over</h1>
            <p>{message}</p>
            <button onClick={() => navigate("/")}>Volver al inicio</button>
        </div>
    );
};

export default GameOverScreen;