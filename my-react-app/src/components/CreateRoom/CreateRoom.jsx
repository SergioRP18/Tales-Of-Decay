import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { signInAnonymous, saveUsername } from "../../store/store";
import { createRoom } from "../../services/roomService";
import { useNavigate } from "react-router-dom";
import "./CreateRoom.css"

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
    <div className="generalCreateRoom">
      <img className="logoRoom" src="https://raw.githubusercontent.com/SergioRP18/Logo-The-Last-Card/63b41668478c96474e4e0ef35e1d5abee18ea249/Logo_ToD.svg" alt="" />
      <form onSubmit={handleCreate}>
              <div className="createRoomForm">

        <input
          className="enterUser"
          type="text"
          placeholder="Tu username"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
        <button className = "crearSalaB" type="submit">Crear sala</button>
           </div>

      </form>
      {error && <div style={{ color: "red" }}>{error}</div>}
    </div>
  );
};

export default CreateRoom;
