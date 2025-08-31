import { useLocation, useNavigate } from "react-router-dom";

const GameOverScreen = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Se espera que la razón llegue por state
    // { reason: "no-selection" | "wrong-answer" | "eliminated" | "saved" }
    const reason = location.state?.reason;

    let message = "¡Juego terminado!";
    if (reason === "no-selection") {
        message = "Perdiste porque no seleccionaste ninguna opción a tiempo.";
    } else if (reason === "wrong-answer") {
        message = "Perdiste porque seleccionaste una opción incorrecta.";
    } else if (reason === "eliminated") {
        message = "Has sido eliminado por decisión del grupo.";
    } else if (reason === "saved") {
        message = "¡Has sido salvado por el grupo! Continúa en el juego.";
    }

    return (
        <div style={{ textAlign: "center", marginTop: "10vh" }}>
            <h1>{reason === "saved" ? "¡Salvado!" : "Game Over"}</h1>
            <p>{message}</p>
            <button onClick={() => navigate("/")}>Volver al inicio</button>
        </div>
    );
};

export default GameOverScreen;
