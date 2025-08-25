import { useNavigate } from "react-router-dom";

const HomeScreen = () => {
  const navigate = useNavigate();

  return (
    <div>
      <img src="https://github.com/SergioRP18/Logo-The-Last-Card/blob/main/Logo-TheLastCard.png?raw=true" alt="" />
      <button onClick={() => navigate("/lobby")}>Crear sala</button>
      <button onClick={() => navigate("/join-room")}>Unirse a sala</button>
      <div>
        <p>© 2025 DMI - Salazar, Lopera & Sergio. Todos los derechos reservados.</p>
      </div>
    </div>
  );
};

export default HomeScreen;