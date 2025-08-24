import { useNavigate } from "react-router-dom";

const ResultsScreen = () => {
    const navigate = useNavigate();

    return (
        <div style={{ textAlign: "center", marginTop: "10vh" }}>
            <h1>¡Felicidades!</h1>
            <p>¡Has sobrevivido y completado el juego con todas las respuestas correctas!</p>
            <button
                style={{
                    marginTop: "2em",
                    padding: "1em 2em",
                    fontSize: "1.2em",
                    borderRadius: "10px",
                    background: "#111",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer"
                }}
                onClick={() => navigate("/")}
            >
                Volver al inicio
            </button>
        </div>
    );
};

export default ResultsScreen;