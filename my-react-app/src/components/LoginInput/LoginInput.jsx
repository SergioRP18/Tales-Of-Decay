import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { signInAnonymous, saveUsername } from "../../store/store";
import { joinRoom } from "../../services/roomService"; // Debes crear este archivo y función


const LoginInput = () => {
    const [username, setUsername] = useState("");
    const [roomCode, setRoomCode] = useState("");
    const [error, setError] = useState("");
    const dispatch = useDispatch();

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
            // Aquí puedes redirigir a la sala o mostrar mensaje de éxito
        } catch (err) {
            setError(err.message || "Error al unirse a la sala");
        }
    };

    return (
        <>
            <div className="general-login">
                <form onSubmit={handleJoin}>
                    <input
                        type="text"
                        name="username"
                        id="username"
                        placeholder="Ingresa tu username"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                    />
                    <input
                        type="text"
                        name="room"
                        id="room"
                        placeholder="Código de sala"
                        value={roomCode}
                        onChange={e => setRoomCode(e.target.value)}
                    />
                    <button type="submit">Unirme</button>
                </form>
                {error && <div style={{ color: "red" }}>{error}</div>}
            </div>
        </>
    );
};

export default LoginInput;