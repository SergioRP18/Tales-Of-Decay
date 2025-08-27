import { useNavigate } from "react-router-dom";

const HomeScreen = () => {
  const navigate = useNavigate();

  return (
    <div>
      <img src="https://raw.githubusercontent.com/SergioRP18/Logo-The-Last-Card/63b41668478c96474e4e0ef35e1d5abee18ea249/Logo_ToD.svg" alt="" />
      <button onClick={() => navigate("/lobby")}>Crear sala</button>
      <button onClick={() => navigate("/join-room")}>Unirse a sala</button>
      <div>
        <p>© 2025 DMI - Salazar, Lopera & Sergio. Todos los derechos reservados.</p>
      </div>
    </div>
  );
};

export default HomeScreen;