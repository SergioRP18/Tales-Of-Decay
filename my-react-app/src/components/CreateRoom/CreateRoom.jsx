import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { signInAnonymous, saveUsername } from "../../store/store";
import { createRoom } from "../../services/roomService";
import { useNavigate } from "react-router-dom";

const CreateRoom = () => {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    if (!username) {
      setError("Debes ingresar un username");
      return;
    }
    try {
      await dispatch(signInAnonymous()).unwrap();
      await dispatch(saveUsername(username)).unwrap();
      const code = await createRoom(username);
      // Redirige a la pantalla de espera con el código de sala
      navigate(`/waiting/${code}`);
    } catch (err) {
      setError(err.message || "Error al crear la sala");
    }
  };

  return (
    <div>
      <form onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Tu username"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
        <button type="submit">Crear sala</button>
      </form>
      {error && <div style={{ color: "red" }}>{error}</div>}
    </div>
  );
};

export default CreateRoom;