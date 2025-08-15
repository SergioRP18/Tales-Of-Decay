import { useParams } from "react-router-dom";

const WaitingScreen = () => {
    const { roomId } = useParams();

    return (
        <div>
            <h2>¡Sala creada!</h2>
            <p>Código de sala: <strong>{roomId}</strong></p>
            <p>Comparte este código con tus amigos para que se unan.</p>
            <p>Esperando jugadores...</p>
        </div>
    );
};

export default WaitingScreen;