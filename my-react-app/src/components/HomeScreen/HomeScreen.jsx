import { useNavigate } from "react-router-dom";

const HomeScreen = () => {
  const navigate = useNavigate();

  return (
    <div>
      <h1>The Last Card</h1>
      <button onClick={() => navigate("/lobby")}>Crear sala</button>
      <button onClick={() => navigate("/join-room")}>Unirse a sala</button>
    </div>
  );
};

export default HomeScreen;