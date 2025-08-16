import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const LoadingComponent = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/select");
    }, 2000); // 2000 ms = 2 segundos

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      background: "#181818",
      color: "#fff"
    }}>
      <img
        src="/logo192.png" // Cambia por la ruta de tu logo si tienes uno
        alt="Logo"
        style={{ width: 100, marginBottom: 24 }}
      />
      <h2>Cargando...</h2>
      <div style={{
        marginTop: 20,
        width: 40,
        height: 40,
        border: "4px solid #fff",
        borderTop: "4px solid #888",
        borderRadius: "50%",
        animation: "spin 1s linear infinite"
      }} />
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg);}
            100% { transform: rotate(360deg);}
          }
        `}
      </style>
    </div>
  );
};

export default LoadingComponent;