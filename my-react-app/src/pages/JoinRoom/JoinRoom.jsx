import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { signInAnonymous, saveUsername } from "../../store/store";
import { joinRoom } from "../../services/roomService";
import { useNavigate } from "react-router-dom";

const JoinRoomScreen = () => {
    const [username, setUsername] = useState("");
    const [roomCode, setRoomCode] = useState("");
    const [error, setError] = useState("");
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const handleJoin = async (e) => {
        e.preventDefault();
        setError("");
        if (!username || !roomCode) {
            setError("Debes ingresar username y código de sala");
            return;
        }
        try {
            await dispatch(signInAnonymous()).unwrap();
            await dispatch(saveUsername(username)).unwrap();
            await joinRoom(roomCode, username);
            navigate(`/waiting/${roomCode}`);
        } catch (err) {
            setError(err.message || "Error al unirse a la sala");
        }
    };

    return (
        <div>
            <img src="https://github.com/SergioRP18/Logo-The-Last-Card/blob/main/Logo-TheLastCard.png?raw=true" alt="logo-app" />
            <form onSubmit={handleJoin}>
                <input
                    type="text"
                    placeholder="Tu username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Código de sala"
                    value={roomCode}
                    onChange={e => setRoomCode(e.target.value)}
                />
                <button type="submit">Unirme</button>
            </form>
            {error && <div style={{ color: "red" }}>{error}</div>}
            <div>
                <p>© 2025 DMI - Salazar, Lopera & Sergio. Todos los derechos reservados.</p>
            </div>
        </div>
    );
};

export default JoinRoomScreen;