import { useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import LoadingComponent from "../../components/LoadingComponent/LoadingComponent";

const ResultsScreen = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 2000); // 2 segundos de loading
        return () => clearTimeout(timer);
    }, []);

    if (loading) {
        return <LoadingComponent />;
    }

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