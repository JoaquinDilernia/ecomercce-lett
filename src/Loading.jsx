import React from "react";
import "./App.css";

const Loading = ({ message = "Cargando..." }) => {
  return (
    <div className="loading-container">
      <div className="modern-loader"></div>
      <p className="loading-text">{message}</p>
    </div>
  );
};

export default Loading;
