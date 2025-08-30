import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { signInAnonymous, saveUsername } from "../../store/store";
import { joinRoom } from "../../services/roomService";
import { useNavigate } from "react-router-dom";
import "./JoinRoom.css";

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
    <div className="joinGeneral">
      <img
        className="joinLogo"
        src="https://raw.githubusercontent.com/SergioRP18/Logo-The-Last-Card/63b41668478c96474e4e0ef35e1d5abee18ea249/Logo_ToD.svg"
        alt="logo-app"
      />

      <form className="joinForm" onSubmit={handleJoin}>
        <input
          className="joinInput"
          type="text"
          placeholder="Tu username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="joinInput"
          type="text"
          placeholder="Código de sala"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
        />
        <button className="joinBtn" type="submit">Unirme</button>
      </form>

      {error && <div className="joinError">{error}</div>}

      <p className="joinCredits">
        © 2025 DMI - Salazar, Lopera & Sergio. Todos los derechos reservados.
      </p>
    </div>
  );
};

export default JoinRoomScreen;
