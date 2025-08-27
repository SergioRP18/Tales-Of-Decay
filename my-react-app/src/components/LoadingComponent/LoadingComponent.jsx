import React from "react";

const LoadingComponent = () => (
  <div style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    color: "#fff"
  }}>
    <img
      src="https://raw.githubusercontent.com/SergioRP18/Logo-The-Last-Card/63b41668478c96474e4e0ef35e1d5abee18ea249/Logo_ToD.svg"
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

export default LoadingComponent;